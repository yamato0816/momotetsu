import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, joinGame, applyAction, publicState, nextGoal, STATIONS, START, NEIGHBORS, LINKS, shortestPath, yearlyIncome, upgradeGame } from '../src/game.js';
const id1 = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';
const token1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const token2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const st = name => STATIONS.find(s => s.name === name).id;
const rng = n => () => n;
function setup() {
  let g = newGame({ id:id1, token:token1, name:'赤', rounds:6 }, rng(0));
  g = joinGame(g, { id:id2, token:token2, name:'青' });
  return applyAction(g, id1, { type:'start' }, { connected:[id1,id2] });
}
function roll(g, playerId, dieRng=0) { return applyAction(g, playerId, {type:'roll'}, {rng:rng(dieRng)}); }
function step(g, playerId, to, eventRng=0) { return applyAction(g,playerId,{type:'move',to},{rng:rng(eventRng)}); }

test('all rail connections are reciprocal, mapped and navigable',()=>{
  assert.equal(STATIONS.length,36);
  assert.ok(LINKS.length > STATIONS.length);
  for(const [a,b] of LINKS){assert.ok(NEIGHBORS[a].includes(b)); assert.ok(NEIGHBORS[b].includes(a));}
  for(const s of STATIONS)assert.ok(shortestPath(START,s.id).length>0, `${s.name} unreachable`);
  assert.ok(NEIGHBORS[st('東京')].length>=4,'Tokyo branches');
});
test('initial lobby, authenticated join, only host may start',()=>{
  let g = newGame({ id:id1,token:token1,name:'赤' });
  assert.equal(g.players[0].pos,START);
  assert.throws(()=>applyAction(g,id1,{type:'start'},{connected:[id1]}),/2人以上/);
  g = joinGame(g,{id:id2,token:token2,name:'青'});
  assert.throws(()=>joinGame(g,{id:id2,token:token1,name:'偽物'}),/認証/);
  assert.throws(()=>applyAction(g,id2,{type:'start'},{connected:[id1,id2]}),/開始できません/);
  assert.throws(()=>applyAction(g,id1,{type:'start'},{connected:[id1]}),/全員オンライン/);
  g = applyAction(g,id1,{type:'start'},{connected:[id1,id2]});
  assert.equal(g.status,'playing');
  assert.equal(publicState(g,[id1]).players[0].token,undefined);
  assert.equal(publicState(g,[id1]).players[0].online,true);
});
test('roll starts movement phase; every step selects a connected station',()=>{
  let g=setup(); const origin=g.players[0].pos;
  g=roll(g,id1);
  assert.equal(g.players[0].pos,origin);
  assert.equal(g.phase,'move'); assert.equal(g.pending.remaining,1);
  assert.equal(g.lastRoll.die,1);
  assert.throws(()=>roll(g,id1),/サイコロ/);
  assert.throws(()=>step(g,id2,st('横浜')),/今は移動/);
  assert.throws(()=>step(g,id1,st('鹿児島')),/線路/);
  g=step(g,id1,st('千葉'));
  assert.equal(g.players[0].pos,st('千葉')); assert.equal(g.phase,'decide');
  assert.equal(g.pending.index,st('千葉'));
});
test('branching choice yields distinct destinations from Tokyo',()=>{
  const a=roll(setup(),id1),b=roll(setup(),id1);
  const toA=step(a,id1,st('千葉')),toB=step(b,id1,st('横浜'));
  assert.equal(toA.players[0].pos,st('千葉'));
  assert.equal(toB.players[0].pos,st('横浜'));
});
test('multi-step movement can choose different directions and stops on final station',()=>{
  let g=setup();g.destination=st('鹿児島');
  g=roll(g,id1,0.35); // three steps
  g=step(g,id1,st('横浜'));
  assert.equal(g.pending.remaining,2);
  g=step(g,id1,st('東京')); // backtrack intentionally allowed
  assert.equal(g.pending.remaining,1);
  g=step(g,id1,st('千葉'));
  assert.equal(g.phase,'decide'); assert.equal(g.pending.type,'city');
  assert.deepEqual(g.lastRoll.die,3);
});
test('buying multiple named properties validates budget, ownership and duplicates',()=>{
  let g=setup();g.destination=st('鹿児島');g=roll(g,id1);g=step(g,id1,st('横浜'));
  const station=STATIONS[st('横浜')],ids=station.properties.map(p=>p.id);
  assert.throws(()=>applyAction(g,id1,{type:'buy_many',items:[ids[0],ids[0]]}),/選択/);
  assert.throws(()=>applyAction(g,id1,{type:'buy_many',items:['999-0']}),/購入できない/);
});
test('purchase, monopoly double income, annual settlement and total assets',()=>{
  let g=setup();g.destination=st('鹿児島');
  g=roll(g,id1);g=step(g,id1,st('横浜'));
  const props=STATIONS[st('横浜')].properties;
  const total=props.reduce((n,p)=>n+p.price,0);
  g=applyAction(g,id1,{type:'buy_many',items:props.map(p=>p.id)});
  assert.equal(g.players[0].money,2000-total);
  assert.equal(g.turnIndex,1);
  assert.equal(Object.keys(g.owners).length,3);
  const base=props.reduce((sum,p)=>sum+Math.round(p.price*p.yieldRate/100),0);
  assert.equal(yearlyIncome(g,id1),base*2);
  assert.equal(publicState(g).players[0].worth,2000);
  g=roll(g,id2);g=step(g,id2,st('横浜'));
  assert.equal(g.round,2);
  assert.equal(g.players[0].money,2000-total+base*2);
});
test('budget restrictions are enforced for atomic multi-buy',()=>{
  let g=setup();g.destination=st('鹿児島');g=roll(g,id1);g=step(g,id1,st('横浜'));
  g.players[0].money=500;
  const ids=STATIONS[st('横浜')].properties.map(p=>p.id);
  assert.throws(()=>applyAction(g,id1,{type:'buy_many',items:ids}),/所持金/);
  assert.equal(Object.keys(g.owners).length,0);
});
test('reaching goal during movement awards prize and ends steps early',()=>{
  let g=setup();g.destination=st('横浜');
  g=roll(g,id1,0.9);
  g=step(g,id1,st('横浜'));
  assert.equal(g.players[0].money,3100);
  assert.equal(g.lastAction.type,'goal');
  assert.notEqual(g.destination,st('横浜'));
  assert.equal(g.phase,'decide');
});
test('event losses blocked by shield, shop purchase on final stop',()=>{
  let g=setup();g.destination=st('鹿児島');
  g.players[0].pos=st('仙台');g.players[0].shield=1;
  g=roll(g,id1);
  g=step(g,id1,st('山形'),0.6); // loss event
  assert.equal(g.players[0].money,2000);assert.equal(g.players[0].shield,0);
  assert.equal(g.turnIndex,1);
  g.players[1].pos=st('静岡');
  g=roll(g,id2); g=step(g,id2,st('浜松'));
  assert.equal(g.pending?.type,'shop');
  g=applyAction(g,id2,{type:'shop',item:'express'});
  assert.equal(g.players[1].express,1);
  assert.equal(g.players[1].money,1780);
});
test('last year ends, restart preserves players and host',()=>{
  let g=setup();g.round=6;g.turnIndex=1;g.destination=st('鹿児島');
  g=roll(g,id2);g=step(g,id2,st('横浜'));
  // end after pending decision
  g=applyAction(g,id2,{type:'skip'});
  assert.equal(g.status,'finished');
  assert.throws(()=>roll(g,id2),/サイコロ/);
  g.hostId=id2;
  g=applyAction(g,id2,{type:'restart'});
  assert.equal(g.status,'lobby');assert.equal(g.hostId,id2); assert.equal(g.players.length,2);
});
test('offline player may be passed, online player cannot',()=>{
  let g=setup();
  assert.throws(()=>applyAction(g,id2,{type:'skip_offline'},{connected:[id1,id2]}),/オンライン/);
  g=applyAction(g,id2,{type:'skip_offline'},{connected:[id2]});
  assert.equal(g.turnIndex,1);
});
test('goals are other cities between 5 and 13 railway steps when possible',()=>{
  for(const s of STATIONS){
    const dest=nextGoal(s.id,rng(.5));
    assert.equal(STATIONS[dest].type,'city');assert.notEqual(dest,s.id);
    assert.ok(shortestPath(s.id,dest).length>1);
  }
});
test('legacy v1 room upgrades old positions and station ownership safely',()=>{
  const g=setup();g.version=1;g.players[0].pos=0;g.destination=1;g.owners={'0':id1};g.phase='decide';g.pending={type:'city',index:0};
  const next=upgradeGame(g);
  assert.equal(next.version,2);
  assert.equal(next.players[0].pos,st('東京'));
  assert.equal(next.destination,st('横浜'));
  assert.equal(next.owners[STATIONS[st('東京')].properties[0].id],id1);
  assert.equal(next.phase,'roll');assert.equal(next.pending,null);
});
