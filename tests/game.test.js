import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, joinGame, applyAction, publicState, nextGoal, STATIONS } from '../src/game.js';
const id1 = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';
const token1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const token2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function setup() {
  let g = newGame({ id: id1, token: token1, name: '赤', rounds: 6 }, () => 0);
  g = joinGame(g, { id: id2, token: token2, name: '青' });
  return applyAction(g, id1, { type: 'start' }, { connected: [id1, id2] });
}

test('initial lobby, join, token stays private', () => {
  const g = setup();
  assert.equal(g.status, 'playing');
  assert.equal(g.players.length, 2);
  assert.equal(publicState(g, [id1]).players[0].token, undefined);
  assert.equal(publicState(g, [id1]).players[0].online, true);
  assert.throws(() => joinGame(g, { id: id2, token: token1, name: '偽物' }), /認証/);
  assert.throws(() => joinGame(g, { id: '333', token: 'x', name: 'C' }), /始まって/);
});
test('only host starts; not enough players or offline blocks start', () => {
  let g = newGame({ id: id1, token: token1, name: '赤' });
  assert.throws(() => applyAction(g, id1, { type: 'start' }, { connected: [id1] }), /2人以上/);
  g = joinGame(g, { id: id2, token: token2, name: '青' });
  assert.throws(() => applyAction(g, id2, { type: 'start' }, { connected: [id1, id2] }), /開始できません/);
  assert.throws(() => applyAction(g, id1, { type: 'start' }, { connected: [id1] }), /全員オンライン/);
});
test('roll is server-side and strictly turn based', () => {
  let g = setup();
  assert.throws(() => applyAction(g, id2, { type: 'roll' }), /サイコロ/);
  g = applyAction(g, id1, { type: 'roll' }, { rng: () => 0 });
  assert.equal(g.players[0].pos, 1);
  assert.equal(g.lastRoll.die, 1);
  assert.equal(g.pending.type, 'city');
  assert.equal(g.turnIndex, 0);
  assert.throws(() => applyAction(g, id1, { type: 'roll' }), /サイコロ/);
});
test('purchase, skipped purchase, yearly income and round progression', () => {
  let g = setup();
  g = applyAction(g, id1, { type: 'roll' }, { rng: () => 0 });
  g = applyAction(g, id1, { type: 'buy' });
  assert.equal(g.owners[1], id1);
  assert.equal(g.players[0].money, 2000 - STATIONS[1].price);
  assert.equal(g.turnIndex, 1);
  g = applyAction(g, id2, { type: 'roll' }, { rng: () => 0 });
  assert.equal(g.players[1].money, 2000 - Math.round(STATIONS[1].price * .15));
  assert.equal(g.players[0].money, 2000 - STATIONS[1].price + Math.round(STATIONS[1].price * .15) + Math.round(STATIONS[1].price * .1));
  assert.equal(g.round, 2);
});
test('destination reachable when passing it stops early and pays bonus', () => {
  let g = setup(); g.destination = 2;
  g = applyAction(g, id1, { type: 'roll' }, { rng: () => 0.9 });
  assert.equal(g.players[0].pos, 2);
  assert.equal(g.lastRoll.passedGoal, true);
  assert.equal(g.lastRoll.die, 6);
  assert.equal(g.players[0].money, 3100);
  assert.notEqual(g.destination, 2);
});
test('event loss shield and shop item flow', () => {
  let g = setup(); g.players[0].pos = 2; g.destination = 13;
  g.players[0].shield = 1;
  g = applyAction(g, id1, { type: 'roll' }, { rng: () => 0.58 }); // 4 -> 6 event, 4th event negative
  assert.equal(g.players[0].pos, 6);
  assert.equal(g.players[0].money, 2000);
  assert.equal(g.players[0].shield, 0);
  assert.equal(g.turnIndex, 1);
  g.players[1].pos = 9;
  g = applyAction(g, id2, { type: 'roll' }, { rng: () => 0 });
  assert.equal(g.pending.type, 'shop');
  g = applyAction(g, id2, { type: 'shop', item: 'express' });
  assert.equal(g.players[1].express, 1);
  assert.equal(g.players[1].money, 1780);
});
test('last turn finishes and winner ranking computes property worth', () => {
  let g = setup(); g.round = 6; g.turnIndex = 1; g.players[1].pos = 2;
  g = applyAction(g, id2, { type: 'roll' }, { rng: () => 0 });
  assert.equal(g.status, 'finished');
  assert.equal(g.round, 6);
  assert.equal(publicState(g).players[0].worth, 2000);
  assert.throws(() => applyAction(g, id2, { type: 'roll' }), /サイコロ/);
});
test('offline player can be skipped but online players cannot be skipped', () => {
  let g = setup();
  assert.throws(() => applyAction(g, id2, { type: 'skip_offline' }, { connected: [id1, id2] }), /オンライン/);
  g = applyAction(g, id2, { type: 'skip_offline' }, { connected: [id2] });
  assert.equal(g.turnIndex, 1);
});
test('restart preserves users and host even if host is not first', () => {
  let g = setup(); g.status = 'finished'; g.hostId = id2;
  g = applyAction(g, id2, { type: 'restart' });
  assert.equal(g.status, 'lobby'); assert.equal(g.hostId, id2);
  assert.equal(g.players.length, 2);
});
test('destinations always forward on city station', () => {
  for (let i = 0; i < STATIONS.length; i++) {
    const dest = nextGoal(i, () => .5);
    assert.equal(STATIONS[dest].type, 'city');
    assert.notEqual(dest, i);
  }
});
