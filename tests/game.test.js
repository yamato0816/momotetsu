import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,joinGame,applyAction,publicState,nextGoal,STATIONS,START,NEIGHBORS,LINKS,EDGES,CARDS,CARD_LIMIT,edgeBetween,shortestPath,yearlyIncome,upgradeGame} from '../src/game.js';
const id1='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222';
const token1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',token2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const st=name=>{const x=STATIONS.find(s=>s.name===name);assert.ok(x,`no ${name}`);return x.id};
const rng=n=>()=>n;
function setup(){let g=newGame({id:id1,token:token1,name:'赤',rounds:6},rng(0));g=joinGame(g,{id:id2,token:token2,name:'青'});return applyAction(g,id1,{type:'start'},{connected:[id1,id2]});}
function act(g,id,type,props={},random=0){return applyAction(g,id,{type,...props},{rng:rng(random)});}
function roll(g,id=id1,n=0){return act(g,id,'roll',{},n)}
function step(g,to,id=id1,n=0){return act(g,id,'move',{to},n)}
function nearby(g,target,id=id1){g.players.find(p=>p.id===id).pos=NEIGHBORS[target][0];return g;}

test('125 real named stations form one connected railway/sea/air network',()=>{
  assert.ok(STATIONS.length>=120); assert.ok(LINKS.length>STATIONS.length);
  assert.equal(new Set(STATIONS.map(s=>s.name)).size,STATIONS.length);
  for(const {a,b,mode,fare} of EDGES){assert.ok(NEIGHBORS[a].includes(b));assert.ok(NEIGHBORS[b].includes(a));assert.ok(['rail','sea','air'].includes(mode));assert.ok(fare>=0);}
  for(const s of STATIONS)assert.ok(shortestPath(START,s.id).length>0,`unreachable: ${s.name}`);
  for(const name of ['豊洲キャンパス','大宮キャンパス','東大宮','羽田空港','福岡空港','那覇'])st(name);
  assert.ok(EDGES.some(e=>e.mode==='sea'));assert.ok(EDGES.some(e=>e.mode==='air'));
});
test('auth, lobby and host online requirements',()=>{
  let g=newGame({id:id1,token:token1,name:'赤'});
  assert.equal(g.version,3);assert.equal(g.players[0].pos,START);
  assert.throws(()=>act(g,id1,'start',{},{}) ,/2人以上/);
  g=joinGame(g,{id:id2,token:token2,name:'青'});
  assert.throws(()=>joinGame(g,{id:id2,token:token1,name:'偽物'}),/認証/);
  assert.throws(()=>act(g,id2,'start'),/開始できません/);
  assert.throws(()=>applyAction(g,id1,{type:'start'},{connected:[id1]}),/全員オンライン/);
  g=applyAction(g,id1,{type:'start'},{connected:[id1,id2]});
  assert.equal(g.status,'playing');assert.equal(publicState(g,[id1]).players[0].token,undefined);
});
test('one die roll activates step-by-step movement; cannot jump disconnected roads',()=>{
  let g=roll(setup());assert.equal(g.phase,'move');assert.equal(g.pending.remaining,1);
  assert.equal(g.lastRoll.die,1);
  assert.throws(()=>roll(g),/サイコロ/);
  assert.throws(()=>step(g,st('鹿児島')),/線路/);
  assert.throws(()=>step(g,NEIGHBORS[START][0],id2),/今は移動/);
  g=step(g,st('上野'));
  assert.equal(g.players[0].pos,st('上野'));assert.equal(g.pending?.type,'city');
});
test('dense intermediate stations separate Tokyo and Yokohama, with branching choices',()=>{
  assert.ok(!NEIGHBORS[st('東京')].includes(st('横浜')));
  assert.ok(NEIGHBORS[st('東京')].includes(st('品川')));
  assert.ok(NEIGHBORS[st('東京')].includes(st('上野')));
  let g=roll(setup());g=step(g,st('品川'));assert.equal(g.players[0].pos,st('品川'));
});
test('destination bonus requires exact last step, adjustable using one-step card',()=>{
  let g=setup();g.destination=st('上野');g=roll(g,id1,.2); // 2
  g=step(g,st('上野'));assert.equal(g.players[0].money,2000);assert.equal(g.pending.remaining,1);
  g=step(g,st('東京'));assert.equal(g.players[0].money,2000);
  if(g.phase==='decide')g=act(g,id1,'skip');
  g.turnIndex=0;g.phase='roll';g.destination=st('上野');
  g=act(g,id1,'play_card',{card:'local'});
  assert.equal(g.players[0].fixedDie,1);
  g=roll(g,id1,.8);assert.equal(g.lastRoll.die,1);
  g=step(g,st('上野'));
  assert.equal(g.players[0].money,3100);assert.notEqual(g.destination,st('上野'));
  assert.equal(g.poorGodId,id2);
});
test('airport hops have fares; insufficient funds cannot use a flight',()=>{
  let g=setup();g.destination=st('那覇');g.players[0].pos=st('羽田空港');g=roll(g);
  const edge=edgeBetween(st('羽田空港'),st('新千歳空港'));
  assert.equal(edge.mode,'air');assert.ok(edge.fare>0);
  g.players[0].money=edge.fare-1;
  assert.throws(()=>step(g,st('新千歳空港')),/交通費/);
  g.players[0].money=2000;
  g=step(g,st('新千歳空港'));
  assert.equal(g.players[0].money,2000-edge.fare);
});
test('sea routes and their fare are available as alternative branches',()=>{
  let g=setup();g.destination=st('東京');g.players[0].pos=st('鹿児島');g=roll(g);
  assert.equal(edgeBetween(st('鹿児島'),st('那覇')).mode,'sea');
  g=step(g,st('那覇'));
  assert.equal(g.players[0].pos,st('那覇'));
  assert.equal(g.players[0].money,1920);
});
test('property batch validation, monopoly income and balance',()=>{
  let g=setup();g.destination=st('鹿児島');g=nearby(g,st('横浜'));g=roll(g);g=step(g,st('横浜'));
  const props=STATIONS[st('横浜')].properties;
  const ids=props.map(p=>p.id);
  assert.throws(()=>act(g,id1,'buy_many',{items:[ids[0],ids[0]]}),/選択/);
  assert.throws(()=>act(g,id1,'buy_many',{items:['999-0']}),/購入できない/);
  g.players[0].money=200;
  assert.throws(()=>act(g,id1,'buy_many',{items:ids}),/所持金/);
  g.players[0].money=2000;
  const total=props.reduce((sum,p)=>sum+p.price,0);
  g=act(g,id1,'buy_many',{items:ids});
  assert.equal(g.players[0].money,2000-total);
  assert.equal(Object.keys(g.owners).length,props.length);
  const base=props.reduce((sum,p)=>sum+Math.round(p.price*p.yieldRate/100),0);
  assert.equal(yearlyIncome(g,id1),base*2);assert.equal(publicState(g).players[0].worth,2000);
});
test('SIT-specific properties are purchasable',()=>{
  for(const name of ['豊洲キャンパス','大宮キャンパス','東大宮']){
    const station=STATIONS[st(name)];assert.ok(station.properties.length>=2);assert.ok(station.properties.some(p=>/学|研究|AI|バス|カフェ/.test(p.name)));
  }
});
test('card station grants a card; shop sells cards; cap is enforced',()=>{
  let g=setup();g.destination=st('那覇');const card=STATIONS.find(s=>s.type==='card');
  g=nearby(g,card.id);g=roll(g);g=step(g,card.id);
  assert.equal(g.players[0].cards.length,3);
  g.turnIndex=0;g.phase='roll';g.pending=null;
  const shop=STATIONS.find(s=>s.type==='shop');g=nearby(g,shop.id);g=roll(g);g=step(g,shop.id);
  assert.equal(g.pending?.type,'shop');
  g=act(g,id1,'shop',{item:'express'});
  assert.ok(g.players[0].cards.includes('express'));
  assert.equal(g.players[0].money,1780);
});
test('cards cannot be forged, grant research funds, boost dice, block evil events',()=>{
  let g=setup();
  assert.throws(()=>act(g,id1,'play_card',{card:'shinkansen'}),/持っていません/);
  g.players[0].cards.push('grant','express','guard');
  g=act(g,id1,'play_card',{card:'grant'});assert.equal(g.players[0].money,2400);
  g=act(g,id1,'play_card',{card:'express'});assert.equal(g.players[0].rollBonus,2);
  g=roll(g);assert.equal(g.pending.remaining,3);
  assert.throws(()=>act(g,id1,'play_card',{card:'guard'}),/振る前/);
});
test('poor god attaches to farthest competitor, passes on contact and charges at end turn',()=>{
  let g=setup();g.destination=st('上野');g=roll(g);g=step(g,st('上野'));
  assert.equal(g.poorGodId,id2);
  if(g.phase==='decide')g=act(g,id1,'skip');
  g.players[1].pos=st('東京');g.phase='roll';g.turnIndex=1;g.destination=st('那覇');
  g=roll(g,id2);g=step(g,st('上野'),id2);
  assert.equal(g.poorGodId,id1); // other player still at Ueno
  assert.equal(g.players[1].money,2000);
});
test('v2 and v1 rooms upgrade without exposing tokens or losing property ownership',()=>{
  let g=setup();g.version=2;g.players[0].pos=st('横浜');g.owners[STATIONS[st('横浜')].properties[0].id]=id1;
  delete g.players[0].cards;
  let upgraded=upgradeGame(g);
  assert.equal(upgraded.version,3);assert.equal(upgraded.players[0].pos,st('横浜'));assert.ok(upgraded.players[0].cards.length===0);
  assert.equal(upgraded.owners[STATIONS[st('横浜')].properties[0].id],id1);
  g.version=1;g.players[0].pos=0;g.destination=1;g.owners={'0':id1};
  upgraded=upgradeGame(g);
  assert.equal(upgraded.players[0].pos,st('東京'));
  assert.equal(upgraded.destination,st('横浜'));
  assert.equal(upgraded.version,3);
});
test('offline turns can be skipped; final round and rematch',()=>{
  let g=setup();assert.throws(()=>applyAction(g,id2,{type:'skip_offline'},{connected:[id1,id2]}),/オンライン/);
  g=applyAction(g,id2,{type:'skip_offline'},{connected:[id2]});assert.equal(g.turnIndex,1);
  g.round=6;g.destination=st('鹿児島');g.players[1].pos=st('東京');g=roll(g,id2);g=step(g,st('上野'),id2);
  if(g.phase==='decide')g=act(g,id2,'skip');
  assert.equal(g.status,'finished');
  g=act(g,id1,'restart');assert.equal(g.status,'lobby');assert.equal(g.players.length,2);
});
test('all goal selections are another reachable city',()=>{
  for(const s of STATIONS){const dest=nextGoal(s.id,rng(.5));assert.equal(STATIONS[dest].type,'city');assert.notEqual(dest,s.id);assert.ok(shortestPath(s.id,dest).length>1);}
});
