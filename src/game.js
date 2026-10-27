// Original railway board game logic. All random draws and money changes happen on the server.
export const MAX_PLAYERS = 4;
export const SHOP_ITEMS = Object.freeze({ express: { name: '特急きっぷ', price: 220, icon: '🚄' }, shield: { name: 'おまもり', price: 180, icon: '🛡️' } });
export const STATIONS = [
  { name: '東京', x: 80, y: 46, type: 'city', price: 900 },
  { name: '横浜', x: 76, y: 55, type: 'city', price: 640 },
  { name: '小田原', x: 69, y: 60, type: 'city', price: 420 },
  { name: '静岡', x: 63, y: 62, type: 'event' },
  { name: '浜松', x: 56, y: 65, type: 'city', price: 390 },
  { name: '名古屋', x: 49, y: 63, type: 'city', price: 840 },
  { name: '岐阜', x: 45, y: 54, type: 'event' },
  { name: '京都', x: 39, y: 59, type: 'city', price: 760 },
  { name: '大阪', x: 34, y: 68, type: 'city', price: 950 },
  { name: '神戸', x: 27, y: 72, type: 'city', price: 650 },
  { name: '姫路', x: 20, y: 68, type: 'shop' },
  { name: '岡山', x: 14, y: 62, type: 'city', price: 500 },
  { name: '広島', x: 12, y: 52, type: 'city', price: 680 },
  { name: '山口', x: 17, y: 43, type: 'event' },
  { name: '博多', x: 22, y: 33, type: 'city', price: 890 },
  { name: '熊本', x: 17, y: 24, type: 'city', price: 470 },
  { name: '鹿児島', x: 10, y: 16, type: 'event' },
  { name: '松山', x: 29, y: 22, type: 'city', price: 430 },
  { name: '高松', x: 38, y: 30, type: 'shop' },
  { name: '金沢', x: 46, y: 34, type: 'city', price: 600 },
  { name: '富山', x: 52, y: 26, type: 'city', price: 470 },
  { name: '新潟', x: 59, y: 19, type: 'city', price: 580 },
  { name: '仙台', x: 67, y: 14, type: 'city', price: 710 },
  { name: '盛岡', x: 74, y: 11, type: 'event' },
  { name: '青森', x: 83, y: 15, type: 'city', price: 480 },
  { name: '函館', x: 89, y: 24, type: 'shop' },
  { name: '札幌', x: 92, y: 35, type: 'city', price: 960 },
  { name: '宇都宮', x: 88, y: 47, type: 'event' },
];

const COLORS = ['#ee7069', '#4c8ce9', '#32b894', '#a777e6'];
const EVENTS = [
  { text: '商店街の福引で大当たり！ +280万円', money: 280 },
  { text: '地域フェスに協賛！ お礼に +180万円', money: 180 },
  { text: 'ラッキーな臨時収入！ +350万円', money: 350 },
  { text: '車両の修理で -180万円', money: -180 },
  { text: '忘れ物をしてしまった！ -230万円', money: -230 },
  { text: '大雨による運休対応… -300万円', money: -300 },
];

const choose = (array, rng) => array[Math.min(array.length - 1, Math.max(0, Math.floor(rng() * array.length)))];
export const distance = (from, to) => (to - from + STATIONS.length) % STATIONS.length;
const money = amount => `${Math.abs(amount).toLocaleString('ja-JP')}万円`;
const log = (g, text, kind = 'info') => { g.logs.unshift({ id: `${Date.now()}-${g.logs.length}-${Math.random()}`, text, kind }); g.logs = g.logs.slice(0, 35); };
const nameOf = (g, id) => g.players.find(p => p.id === id)?.name ?? 'プレイヤー';
const worth = (g, p) => p.money + Object.entries(g.owners).reduce((sum, [station, owner]) => owner === p.id ? sum + (STATIONS[Number(station)]?.price ?? 0) : sum, 0);

export function nextGoal(from, rng = Math.random) {
  const candidates = STATIONS.map((s, i) => ({ s, i, d: distance(from, i) })).filter(o => o.s.type === 'city' && o.d >= 5 && o.d <= 12);
  return choose(candidates.length ? candidates : STATIONS.map((s, i) => ({ s, i })).filter(o => o.s.type === 'city' && o.i !== from), rng).i;
}

export function newGame({ id, token, name, rounds = 6 }, rng = Math.random) {
  const g = { version: 1, status: 'lobby', hostId: id, players: [{ id, token, name, color: COLORS[0], pos: 0, money: 2000, express: 0, shield: 0 }], owners: {}, rounds: [6, 10].includes(rounds) ? rounds : 6, round: 1, turnIndex: 0, phase: 'roll', pending: null, destination: nextGoal(0, rng), lastRoll: null, logs: [], turnStartedAt: Date.now() };
  log(g, `${name}さんが部屋を作成しました 🚂`, 'system');
  return g;
}

export function joinGame(game, { id, token, name }) {
  const g = structuredClone(game);
  const existing = g.players.find(p => p.id === id);
  if (existing) {
    if (existing.token !== token) throw Error('このプレイヤーの認証情報が一致しません。');
    return g;
  }
  if (g.status !== 'lobby') throw Error('この部屋のゲームはすでに始まっています。');
  if (g.players.length >= MAX_PLAYERS) throw Error('満員です（最大4人）。');
  const color = COLORS.find(c => !g.players.some(p => p.color === c));
  g.players.push({ id, token, name, color, pos: 0, money: 2000, express: 0, shield: 0 });
  if (!g.hostId) g.hostId = id;
  log(g, `${name}さんが参加しました！`, 'system');
  return g;
}

function endTurn(g) {
  g.pending = null;
  g.phase = 'roll';
  if (g.turnIndex === g.players.length - 1) {
    if (g.round >= g.rounds) {
      g.status = 'finished';
      const ranking = [...g.players].sort((a, b) => worth(g, b) - worth(g, a));
      log(g, `🏆 優勝は${ranking[0].name}さん！ 総資産 ${money(worth(g, ranking[0]))}`, 'goal');
      return;
    }
    g.turnIndex = 0;
    g.round += 1;
    const income = new Map(g.players.map(p => [p.id, 0]));
    for (const [index, owner] of Object.entries(g.owners)) income.set(owner, income.get(owner) + Math.round(STATIONS[Number(index)].price * 0.1));
    for (const p of g.players) p.money += income.get(p.id);
    const earners = g.players.filter(p => income.get(p.id) > 0).map(p => `${p.name} +${money(income.get(p.id))}`);
    log(g, `【${g.round}年目】決算！ ${earners.join(' / ') || 'まだ物件収益はありません'}`, 'income');
  } else g.turnIndex += 1;
  g.turnStartedAt = Date.now();
}

export function applyAction(game, actorId, action, { rng = Math.random, connected = [] } = {}) {
  const g = structuredClone(game);
  const actor = g.players.find(p => p.id === actorId);
  if (!actor) throw Error('参加プレイヤーではありません。');
  const isHost = actorId === g.hostId;
  const isTurn = g.players[g.turnIndex]?.id === actorId;
  if (action?.type === 'rounds') {
    if (!isHost || g.status !== 'lobby' || ![6, 10].includes(action.value)) throw Error('設定を変更できません。');
    g.rounds = action.value;
  } else if (action?.type === 'start') {
    if (!isHost || g.status !== 'lobby') throw Error('開始できません。');
    if (g.players.length < 2 || g.players.some(p => !connected.includes(p.id))) throw Error('2人以上、全員オンラインで開始してください。');
    g.status = 'playing';
    g.turnStartedAt = Date.now();
    log(g, `ゲームスタート！ ${g.rounds}年勝負です 🎲`, 'system');
  } else if (action?.type === 'roll') {
    if (g.status !== 'playing' || !isTurn || g.phase !== 'roll') throw Error('今はサイコロを振れません。');
    const die = Math.floor(rng() * 6) + 1;
    const boost = actor.express > 0 ? 2 : 0;
    if (boost) actor.express -= 1;
    const from = actor.pos;
    const steps = die + boost;
    let to = (from + steps) % STATIONS.length;
    const d = distance(from, g.destination);
    let passedGoal = false;
    if (d > 0 && d <= steps) {
      to = g.destination;
      passedGoal = true;
      actor.money += 1100;
      log(g, `🎯 ${actor.name}さんが目的地「${STATIONS[to].name}」に到着！ +1,100万円`, 'goal');
      g.destination = nextGoal(to, rng);
    }
    actor.pos = to;
    const station = STATIONS[to];
    let eventText = '';
    log(g, `🎲 ${actor.name}さんは${die}（${boost ? '特急+2 / ' : ''}${steps}マス）で${station.name}へ`, 'move');
    if (station.type === 'event') {
      const evt = choose(EVENTS, rng);
      let delta = evt.money;
      if (delta < 0 && actor.shield > 0) { actor.shield -= 1; delta = 0; eventText = '🛡️ おまもりで出費を回避！'; }
      else eventText = evt.text;
      actor.money += delta;
      log(g, `${actor.name}さん：${eventText}`, delta < 0 ? 'loss' : 'income');
    }
    if (station.type === 'city' && g.owners[to] && g.owners[to] !== actorId) {
      const rent = Math.round(station.price * 0.15);
      actor.money -= rent;
      const owner = g.players.find(p => p.id === g.owners[to]);
      if (owner) owner.money += rent;
      log(g, `${actor.name}さんは${nameOf(g, g.owners[to])}さんに通行料 ${money(rent)} を支払い`, 'loss');
    }
    g.lastRoll = { playerId: actorId, die, boost, from, to, steps, passedGoal, eventText, at: Date.now() };
    if (station.type === 'city' && g.owners[to] === undefined && actor.money >= station.price) {
      g.phase = 'decide'; g.pending = { type: 'city', index: to };
    } else if (station.type === 'shop') {
      g.phase = 'decide'; g.pending = { type: 'shop', index: to };
    } else endTurn(g);
  } else if (action?.type === 'buy') {
    if (g.status !== 'playing' || !isTurn || g.pending?.type !== 'city') throw Error('購入できる物件がありません。');
    const i = g.pending.index;
    const station = STATIONS[i];
    if (g.owners[i] !== undefined || actor.money < station.price) throw Error('所持金不足か、売却済みです。');
    actor.money -= station.price;
    g.owners[i] = actorId;
    log(g, `🏠 ${actor.name}さんが${station.name}の物件を ${money(station.price)} で購入！`, 'income');
    endTurn(g);
  } else if (action?.type === 'shop') {
    if (g.status !== 'playing' || !isTurn || g.pending?.type !== 'shop' || !(action.item in SHOP_ITEMS)) throw Error('買い物できません。');
    const item = SHOP_ITEMS[action.item];
    if (actor.money < item.price || actor[action.item] >= 3) throw Error('所持金不足、または所持上限（3個）です。');
    actor.money -= item.price; actor[action.item] += 1;
    log(g, `${item.icon} ${actor.name}さんが${item.name}を ${money(item.price)} で購入`, 'income');
    endTurn(g);
  } else if (action?.type === 'skip') {
    if (g.status !== 'playing' || !isTurn || g.phase !== 'decide') throw Error('見送れません。');
    endTurn(g);
  } else if (action?.type === 'skip_offline') {
    if (g.status !== 'playing' || connected.includes(g.players[g.turnIndex].id)) throw Error('オンラインの人はスキップできません。');
    log(g, `${g.players[g.turnIndex].name}さんがオフラインのためパス`, 'system');
    endTurn(g);
  } else if (action?.type === 'remove') {
    if (g.status !== 'lobby' || !(isHost || actorId === action.playerId)) throw Error('ロビーでのみ退出・整理できます。');
    const target = g.players.find(p => p.id === action.playerId);
    if (!target || (actorId !== action.playerId && connected.includes(target.id))) throw Error('オンラインの人は削除できません。');
    g.players = g.players.filter(p => p.id !== target.id);
    if (g.hostId === target.id) g.hostId = g.players[0]?.id ?? null;
    log(g, `${target.name}さんが退出しました`, 'system');
  } else if (action?.type === 'restart') {
    if (!isHost || g.status !== 'finished') throw Error('再戦はホストのみ可能です。');
    const reset = newGame({ ...g.players[0], rounds: g.rounds }, rng);
    reset.players = g.players.map((p, i) => ({ ...p, color: COLORS[i], pos: 0, money: 2000, express: 0, shield: 0 }));
    reset.hostId = g.hostId;
    log(reset, '同じメンバーで再戦の準備ができました！', 'system');
    return reset;
  } else if (action?.type === 'emote') {
    if (!['👏', '😂', '🔥', '😱'].includes(action.value)) throw Error('使用できないリアクションです。');
    log(g, `${actor.name}さん ${action.value}`, 'emote');
  } else throw Error('不明な操作です。');
  return g;
}

export function publicState(g, connected = []) {
  return {
    ...g,
    players: g.players.map(({ token, ...p }) => ({ ...p, worth: worth(g, p), online: connected.includes(p.id), propertyCount: Object.values(g.owners).filter(id => id === p.id).length })),
    stations: STATIONS,
    shopItems: SHOP_ITEMS,
  };
}
