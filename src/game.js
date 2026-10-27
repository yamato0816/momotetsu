// Rail Trip v2 — server-authoritative, graph-based railway board game.
// Money is represented in units of 10,000 JPY (万円).
export const MAX_PLAYERS = 4;
export const SHOP_ITEMS = Object.freeze({
  express: { name: '特急きっぷ', price: 220, icon: '🚄', description: '次のサイコロの出目に+2' },
  shield: { name: 'おまもり', price: 180, icon: '🛡️', description: '損失イベントを1回防ぐ' },
});

const raw = [
  ['札幌',1080,116,'city','味噌ラーメン店:240:15,雪まつりホテル:980:8,乳製品工房:520:12'],
  ['函館',1003,190,'shop'],
  ['青森',926,264,'city','りんご農園:180:18,ねぶた資料館:450:12,海鮮市場:330:14'],
  ['秋田',827,301,'city','きりたんぽ店:220:18,温泉旅館:620:10'],
  ['盛岡',942,344,'event'],
  ['山形',840,408,'event'],
  ['仙台',954,419,'city','牛たん専門店:380:16,七夕商店街:720:9,ずんだ茶屋:240:18'],
  ['福島',928,491,'city','桃パフェ店:190:19,温泉宿:550:12'],
  ['新潟',788,464,'city','お米農場:310:15,日本酒蔵:620:11'],
  ['富山',713,486,'event'],
  ['金沢',643,508,'city','金箔工房:430:14,海鮮丼店:310:17,庭園ホテル:880:8'],
  ['長野',790,550,'city','そば処:250:16,高原リゾート:760:9'],
  ['宇都宮',921,560,'event'],
  ['東京',931,639,'city','たい焼き屋:280:17,駅前ビル:1200:7,デザインホテル:980:9,ゲーム制作会社:660:12'],
  ['千葉',1039,677,'city','落花生農園:240:16,テーマパークホテル:1400:7'],
  ['横浜',874,689,'city','中華街食堂:390:16,港のホテル:1100:8,カフェスタンド:270:18'],
  ['小田原',802,704,'event'],
  ['静岡',742,674,'city','お茶専門店:270:17,富士山ホテル:980:10'],
  ['浜松',667,693,'shop'],
  ['名古屋',601,667,'city','味噌カツ屋:380:16,喫茶店:260:18,駅前デパート:1200:8'],
  ['岐阜',618,589,'event'],
  ['京都',540,646,'city','和菓子店:280:17,老舗旅館:940:10,抹茶カフェ:410:15'],
  ['大阪',488,691,'city','たこ焼き屋:210:20,お笑い劇場:780:11,商業ビル:1250:8'],
  ['神戸',435,699,'city','洋菓子店:330:18,港町ホテル:890:9'],
  ['姫路',370,656,'shop'],
  ['岡山',322,637,'city','白桃農園:280:18,フルーツパーラー:460:13'],
  ['広島',244,619,'city','お好み焼き店:350:17,牡蠣養殖場:620:12,平和通りホテル:820:8'],
  ['山口',154,629,'event'],
  ['博多',111,676,'city','とんこつラーメン店:300:19,明太子工房:440:14,博多駅前ビル:950:9'],
  ['長崎',35,718,'city','カステラ屋:230:19,港のクルーズ施設:750:9'],
  ['熊本',114,744,'city','馬刺し料理店:360:16,城下町ホテル:740:10'],
  ['宮崎',202,770,'event'],
  ['鹿児島',111,794,'city','黒豚食堂:350:18,桜島観光ホテル:900:9'],
  ['高松',369,746,'shop'],
  ['松山',287,783,'city','みかん農園:190:20,道後温泉旅館:860:10'],
  ['高知',391,794,'city','かつお食堂:270:17,土佐市場:470:13'],
];

export const STATIONS = raw.map(([name, x, y, type, catalog], i) => ({
  id: i, name, x, y, type,
  properties: (catalog ?? '').split(',').filter(Boolean).map((item, j) => {
    const [title, price, yieldRate] = item.split(':');
    return { id: `${i}-${j}`, name: title, price: Number(price), yieldRate: Number(yieldRate) };
  }),
}));
const stationId = new Map(STATIONS.map(s => [s.name, s.id]));
const railway = [
  '札幌-函館-青森-盛岡-仙台-福島-宇都宮-東京-横浜-小田原-静岡-浜松-名古屋-京都-大阪-神戸-姫路-岡山-広島-山口-博多-熊本-鹿児島',
  '青森-秋田-山形-仙台', '山形-福島', '秋田-新潟-富山-金沢-京都',
  '新潟-長野-宇都宮', '長野-東京', '長野-岐阜-名古屋', '金沢-岐阜', '富山-岐阜',
  '東京-千葉', '東京-静岡', '大阪-高松-松山-高知-高松', '岡山-高松', '広島-松山',
  '博多-長崎', '熊本-宮崎-鹿児島', '静岡-名古屋', '京都-神戸',
];
const edgeSet = new Set();
for (const chain of railway) {
  const names = chain.split('-');
  for (let i = 1; i < names.length; i++) {
    const a = stationId.get(names[i - 1]); const b = stationId.get(names[i]);
    if (a == null || b == null) throw Error(`Unknown station in route: ${chain}`);
    edgeSet.add([a, b].sort((x, y) => x - y).join(':'));
  }
}
export const LINKS = [...edgeSet].map(key => key.split(':').map(Number));
export const NEIGHBORS = STATIONS.map(s => LINKS.filter(([a, b]) => a === s.id || b === s.id).map(([a, b]) => a === s.id ? b : a));
export const START = stationId.get('東京');
const OLD_STATION_NAMES = ['東京','横浜','小田原','静岡','浜松','名古屋','岐阜','京都','大阪','神戸','姫路','岡山','広島','山口','博多','熊本','鹿児島','松山','高松','金沢','富山','新潟','仙台','盛岡','青森','函館','札幌','宇都宮'];

const COLORS = ['#ed6758', '#4082eb', '#1daa83', '#9c6cdd'];
const EVENTS = [
  { text: '商店街の福引に当選！', money: 280 },
  { text: '沿線グルメ祭が大盛況！', money: 180 },
  { text: '駅のポスターが話題に！', money: 350 },
  { text: '車両の修理費が発生…', money: -180 },
  { text: '忘れ物の対応で出費…', money: -230 },
  { text: '大雨で宿泊費がかかった…', money: -300 },
];
const choose = (array, rng) => array[Math.min(array.length - 1, Math.max(0, Math.floor(rng() * array.length)))];
const money = amount => `${Math.abs(amount).toLocaleString('ja-JP')}万円`;
const log = (g, text, kind = 'info') => { g.logSeq = (g.logSeq ?? 0) + 1; g.logs.unshift({ id: g.logSeq, text, kind }); g.logs = g.logs.slice(0, 35); };
const announce = (g, type, data = {}) => { g.actionSeq = (g.actionSeq ?? 0) + 1; g.lastAction = { seq: g.actionSeq, type, at: Date.now(), ...data }; };
const nameOf = (g, id) => g.players.find(p => p.id === id)?.name ?? 'プレイヤー';
const catalog = new Map(STATIONS.flatMap(st => st.properties.map(p => [p.id, p])));
export const ownedProperties = (g, id) => [...catalog.values()].filter(p => g.owners[p.id] === id);
export const worth = (g, p) => p.money + ownedProperties(g, p.id).reduce((sum, prop) => sum + prop.price, 0);
export const yearlyIncome = (g, id) => ownedProperties(g, id).reduce((sum, prop) => {
  const station = STATIONS[Number(prop.id.split('-')[0])];
  const monopoly = station.properties.every(p => g.owners[p.id] === id);
  return sum + Math.round(prop.price * prop.yieldRate / 100) * (monopoly ? 2 : 1);
}, 0);

export function shortestPath(from, to) {
  if (!STATIONS[from] || !STATIONS[to]) return [];
  const parent = new Map([[from, null]]);
  const queue = [from];
  for (let k = 0; k < queue.length && !parent.has(to); k++) {
    for (const next of NEIGHBORS[queue[k]]) if (!parent.has(next)) { parent.set(next, queue[k]); queue.push(next); }
  }
  if (!parent.has(to)) return [];
  const path = []; let here = to;
  while (here !== null) { path.push(here); here = parent.get(here); }
  return path.reverse();
}
export function nextGoal(from, rng = Math.random) {
  const cities = STATIONS.filter(s => s.type === 'city' && s.id !== from);
  const distant = cities.filter(s => { const d = shortestPath(from, s.id).length - 1; return d >= 5 && d <= 13; });
  return choose(distant.length ? distant : cities, rng).id;
}
const initialPlayer = (p, i = 0) => ({ id: p.id, token: p.token, name: p.name, color: COLORS[i], pos: START, money: 2000, express: 0, shield: 0 });
export function newGame({ id, token, name, rounds = 6 }, rng = Math.random) {
  const g = { version: 2, status: 'lobby', hostId: id, players: [initialPlayer({ id, token, name })], owners: {}, rounds: [6,10].includes(rounds) ? rounds : 6, round: 1, turnIndex: 0, phase: 'roll', pending: null, destination: nextGoal(START, rng), lastRoll: null, lastAction: null, actionSeq: 0, logSeq: 0, logs: [], turnStartedAt: Date.now() };
  log(g, `${name}さんが旅の部屋を作成しました！`, 'system');
  return g;
}
// Preserve old rooms after upgrading: map stations/ownership, safely reset unfinished decisions.
export function upgradeGame(game) {
  if (game.version === 2) return game;
  const g = structuredClone(game);
  g.version = 2; g.actionSeq = 0; g.lastAction = null; g.logSeq = g.logs.length;
  g.players = g.players.map(p => ({ ...p, pos: stationId.get(OLD_STATION_NAMES[p.pos]) ?? START }));
  g.destination = stationId.get(OLD_STATION_NAMES[g.destination]) ?? nextGoal(START);
  const owners = {};
  for (const [oldIndex, ownerId] of Object.entries(g.owners)) {
    const station = STATIONS.find(s => s.name === OLD_STATION_NAMES[Number(oldIndex)]);
    if (station?.properties[0]) owners[station.properties[0].id] = ownerId;
  }
  g.owners = owners; g.phase = 'roll'; g.pending = null; g.lastRoll = null;
  log(g, '路線マップがリニューアル！ 進行中のターンをリセットしました。', 'system');
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
  g.players.push(initialPlayer({ id, token, name }, g.players.length));
  if (!g.hostId) g.hostId = id;
  log(g, `${name}さんが参加しました！`, 'system');
  return g;
}
function endTurn(g) {
  g.pending = null; g.phase = 'roll';
  if (g.turnIndex === g.players.length - 1) {
    if (g.round >= g.rounds) {
      g.status = 'finished';
      const ranking = [...g.players].sort((a, b) => worth(g, b) - worth(g, a));
      log(g, `🏆 優勝は${ranking[0].name}さん！ 総資産 ${money(worth(g, ranking[0]))}`, 'goal');
      return;
    }
    g.turnIndex = 0; g.round += 1;
    const earners = [];
    for (const p of g.players) {
      const revenue = yearlyIncome(g, p.id); p.money += revenue;
      if (revenue) earners.push(`${p.name} +${money(revenue)}`);
    }
    log(g, `【${g.round}年目】決算！ ${earners.join(' / ') || 'まだ物件収益はありません'}`, 'income');
  } else g.turnIndex++;
  g.turnStartedAt = Date.now();
}
function resolveLanding(g, actor, rng) {
  const station = STATIONS[actor.pos];
  if (station.id === g.destination) {
    actor.money += 1100;
    log(g, `🎯 ${actor.name}さんが目的地「${station.name}」に到着！ +1,100万円`, 'goal');
    announce(g, 'goal', { playerId: actor.id, station: station.name, money: 1100 });
    g.destination = nextGoal(station.id, rng);
  }
  if (station.type === 'event') {
    const evt = choose(EVENTS, rng); let delta = evt.money;
    let message = evt.text;
    if (delta < 0 && actor.shield > 0) { actor.shield--; delta = 0; message = 'おまもりで出費を回避！'; }
    actor.money += delta;
    log(g, `${actor.name}さん：${message} ${delta > 0 ? '+' : delta < 0 ? '−' : ''}${delta ? money(delta) : ''}`, delta < 0 ? 'loss' : 'income');
    announce(g, 'event', { playerId: actor.id, station: station.name, message, money: delta });
  }
  if (station.type === 'city' && station.properties.some(prop => !g.owners[prop.id])) {
    g.phase = 'decide'; g.pending = { type: 'city', index: station.id };
  } else if (station.type === 'shop') {
    g.phase = 'decide'; g.pending = { type: 'shop', index: station.id };
  } else endTurn(g);
}

export function applyAction(game, actorId, action, { rng = Math.random, connected = [] } = {}) {
  const g = structuredClone(game);
  const actor = g.players.find(p => p.id === actorId);
  if (!actor) throw Error('参加プレイヤーではありません。');
  const isHost = actorId === g.hostId;
  const isTurn = g.players[g.turnIndex]?.id === actorId;
  if (action?.type === 'rounds') {
    if (!isHost || g.status !== 'lobby' || ![6,10].includes(action.value)) throw Error('設定を変更できません。');
    g.rounds = action.value;
  } else if (action?.type === 'start') {
    if (!isHost || g.status !== 'lobby') throw Error('開始できません。');
    if (g.players.length < 2 || g.players.some(p => !connected.includes(p.id))) throw Error('2人以上、全員オンラインで開始してください。');
    g.status = 'playing'; g.turnStartedAt = Date.now();
    announce(g, 'start'); log(g, `ゲームスタート！ ${g.rounds}年勝負です 🎲`, 'system');
  } else if (action?.type === 'roll') {
    if (g.status !== 'playing' || !isTurn || g.phase !== 'roll') throw Error('今はサイコロを振れません。');
    const die = Math.floor(rng() * 6) + 1;
    const boost = actor.express > 0 ? 2 : 0;
    if (boost) actor.express--;
    g.phase = 'move';
    g.pending = { type: 'move', playerId: actor.id, remaining: die + boost, total: die + boost, path: [actor.pos] };
    g.lastRoll = { playerId: actorId, die, boost, from: actor.pos, steps: die + boost, at: Date.now() };
    announce(g, 'roll', { playerId: actor.id, die, boost });
    log(g, `🎲 ${actor.name}さんは${die}${boost ? '（特急+2）' : ''}！ 行き先を選択中`, 'move');
  } else if (action?.type === 'move') {
    if (g.status !== 'playing' || !isTurn || g.phase !== 'move' || g.pending?.type !== 'move') throw Error('今は移動できません。');
    const to = action.to;
    if (!Number.isInteger(to) || !NEIGHBORS[actor.pos].includes(to)) throw Error('線路でつながった隣の駅を選んでください。');
    const from = actor.pos; actor.pos = to;
    g.pending.remaining--; g.pending.path.push(to);
    announce(g, 'step', { playerId: actor.id, from, to, remaining: g.pending.remaining });
    if (to === g.destination || g.pending.remaining === 0) {
      log(g, `🚂 ${actor.name}さんが${STATIONS[to].name}に到着！`, 'move');
      resolveLanding(g, actor, rng);
    }
  } else if (action?.type === 'buy_many' || action?.type === 'buy') {
    if (g.status !== 'playing' || !isTurn || g.phase !== 'decide' || g.pending?.type !== 'city') throw Error('購入できる物件がありません。');
    const station = STATIONS[g.pending.index];
    const ids = action.type === 'buy_many' ? action.items : [action.propertyId];
    if (!Array.isArray(ids) || !ids.length || ids.length > station.properties.length || new Set(ids).size !== ids.length) throw Error('購入する物件を選択してください。');
    const selected = ids.map(id => station.properties.find(p => p.id === id));
    if (selected.some(p => !p || g.owners[p.id])) throw Error('購入できない物件が含まれています。');
    const total = selected.reduce((sum, p) => sum + p.price, 0);
    if (total > actor.money) throw Error('所持金が足りません。');
    actor.money -= total;
    for (const p of selected) g.owners[p.id] = actor.id;
    const gained = selected.map(p => p.name).join('・');
    log(g, `🏠 ${actor.name}さんが${station.name}で「${gained}」を購入！ −${money(total)}`, 'income');
    announce(g, 'buy', { playerId: actor.id, station: station.name, items: selected.length, money: -total });
    endTurn(g);
  } else if (action?.type === 'shop') {
    if (g.status !== 'playing' || !isTurn || g.pending?.type !== 'shop' || !(action.item in SHOP_ITEMS)) throw Error('買い物できません。');
    const item = SHOP_ITEMS[action.item];
    if (actor.money < item.price || actor[action.item] >= 3) throw Error('所持金不足、または所持上限（3個）です。');
    actor.money -= item.price; actor[action.item]++;
    log(g, `${item.icon} ${actor.name}さんが${item.name}を ${money(item.price)} で購入`, 'income');
    announce(g, 'buy', { playerId: actor.id, station: STATIONS[actor.pos].name, money: -item.price, items: 1 });
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
    reset.players = g.players.map((p, i) => initialPlayer(p, i));
    reset.hostId = g.hostId;
    log(reset, '同じメンバーで再戦の準備ができました！', 'system');
    return reset;
  } else if (action?.type === 'emote') {
    if (!['👏','😂','🔥','😱'].includes(action.value)) throw Error('使用できないリアクションです。');
    log(g, `${actor.name}さん ${action.value}`, 'emote');
  } else throw Error('不明な操作です。');
  return g;
}

export function publicState(g, connected = []) {
  const active = g.players[g.turnIndex];
  const suggestedRoute = shortestPath(active?.pos ?? START, g.destination);
  return {
    ...g,
    players: g.players.map(({ token, ...p }) => ({
      ...p, worth: worth(g, p), income: yearlyIncome(g, p.id),
      goalSteps: shortestPath(p.pos, g.destination).length - 1,
      online: connected.includes(p.id), propertyCount: ownedProperties(g, p.id).length,
    })),
    stations: STATIONS, links: LINKS, neighbors: NEIGHBORS,
    suggestedRoute, shopItems: SHOP_ITEMS,
  };
}
