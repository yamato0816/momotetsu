// Rail Trip v3 — server-authoritative, graph-based railway board game.
// Money is represented in units of 10,000 JPY (万円).
export const MAX_PLAYERS = 4;
export const CARDS = Object.freeze({
  express: { name:'特急カード', price:220, icon:'🚄', description:'次のサイコロの移動が+2マス' },
  shinkansen: { name:'新幹線カード', price:450, icon:'🚅', description:'次のサイコロの移動が+4マス' },
  local: { name:'ぴったりカード', price:250, icon:'🎯', description:'次のサイコロを1にする' },
  grant: { name:'研究費カード', price:350, icon:'🔬', description:'SITの研究助成で400万円を獲得' },
  guard: { name:'単位取得カード', price:160, icon:'🎓', description:'悪いイベントや貧乏神を1回防ぐ' },
  warp: { name:'ぶっとびカード', price:400, icon:'✈️', description:'ランダムな物件駅へ瞬間移動してターンを終える' },
});
export const SHOP_ITEMS = CARDS;
export const CARD_LIMIT = 8;

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

// Existing 36 station IDs stay fixed; v2 saved properties and locations remain valid.
const fillerRoutes = {
 '札幌-函館':'小樽,倶知安,長万部,八雲',
 '函館-青森':'新函館北斗,木古内,奥津軽いまべつ',
 '青森-盛岡':'八戸,二戸',
 '盛岡-仙台':'一ノ関,古川',
 '仙台-福島':'白石',
 '福島-宇都宮':'郡山,那須塩原',
 '宇都宮-東京':'小山,東大宮,大宮,上野',
 '東京-横浜':'品川,川崎',
 '横浜-小田原':'戸塚,大船,平塚',
 '小田原-静岡':'熱海,三島,沼津',
 '静岡-浜松':'焼津,掛川',
 '浜松-名古屋':'豊橋,岡崎',
 '名古屋-京都':'米原,彦根,草津',
 '京都-大阪':'高槻,新大阪',
 '大阪-神戸':'尼崎,西宮,三ノ宮',
 '神戸-姫路':'明石,加古川',
 '姫路-岡山':'相生,備前',
 '岡山-広島':'倉敷,福山,尾道,三原',
 '広島-山口':'宮島口,岩国,徳山',
 '山口-博多':'下関,小倉',
 '博多-熊本':'久留米,大牟田',
 '熊本-鹿児島':'八代,川内',
 '青森-秋田':'弘前,大館',
 '秋田-新潟':'酒田,鶴岡,村上',
 '新潟-富山':'長岡,上越,糸魚川',
 '富山-金沢':'高岡',
 '金沢-京都':'福井,敦賀',
 '長野-宇都宮':'軽井沢,高崎',
 '長野-東京':'上田,熊谷',
 '東京-千葉':'豊洲キャンパス,新木場,船橋',
 '大阪-高松':'鳴門,徳島',
 '岡山-高松':'児島,坂出',
 '博多-長崎':'鳥栖,佐賀,武雄温泉',
 '熊本-宮崎':'人吉,都城',
 '山形-仙台':'天童',
};
const specialProperties = {
 '豊洲キャンパス':'キャンパスカフェ:240:22,AI研究ラボ:760:17,ロボット開発拠点:960:14',
 '大宮キャンパス':'学食:210:24,研究棟:820:15,学園祭屋台:340:21',
 '東大宮':'スクールバス運行会社:300:20,学生向け食堂:260:21',
 '新木場':'湾岸ロジスティクス:490:14,物流倉庫:320:16',
 '上野':'公園カフェ:320:21,博物館ショップ:580:14',
};
const existingNames = new Set(raw.map(row=>row[0]));
for (const [pair, list] of Object.entries(fillerRoutes)) {
  const [from,to] = pair.split('-');
  const a=raw.find(r=>r[0]===from), b=raw.find(r=>r[0]===to);
  if (!a || !b) throw Error('Bad route ' + pair);
  const names=list.split(',');
  names.forEach((name,i)=>{
    if (existingNames.has(name)) throw Error('Duplicate station '+name);
    existingNames.add(name);
    const t=(i+1)/(names.length+1);
    const x=Math.round(a[1]+(b[1]-a[1])*t), y=Math.round(a[2]+(b[2]-a[2])*t);
    const slot=raw.length;
    const type = specialProperties[name] || name.includes('キャンパス') || i%4===0 ? 'city' : i%4===1 ? 'card' : i%4===2 ? 'event':'shop';
    const props = specialProperties[name] || `${name}のご当地食堂:${170+(slot%5)*65}:${14+slot%8},${name}駅前商店:${340+(slot%7)*90}:${9+slot%7}`;
    raw.push([name,x,y,type,type==='city'?props:'']);
  });
}
// Additional real campus branch (outside the main East Omiya railway).
raw.push(['大宮キャンパス',880,566,'city',specialProperties['大宮キャンパス']]);
raw.push(['羽田空港',925,715,'airport']);
raw.push(['新千歳空港',1111,155,'airport']);
raw.push(['関西空港',476,752,'airport']);
raw.push(['福岡空港',143,680,'airport']);
raw.push(['那覇',44,830,'city','沖縄そば店:350:18,リゾートホテル:1200:10,伝統工芸館:450:16']);
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
  '東大宮-大宮キャンパス', '大宮キャンパス-大宮',
  '東京-羽田空港','札幌-新千歳空港','大阪-関西空港','博多-福岡空港',
];
const edgeMap=new Map();
function addEdge(left,right,mode='rail',fare=0){
  const a=stationId.get(left),b=stationId.get(right);
  if(a==null||b==null||a===b)throw Error('Unknown route '+left+'-'+right);
  const key=[a,b].sort((x,y)=>x-y).join(':');
  edgeMap.set(key,{a,b,mode,fare});
}
for(const line of railway){
  const places=line.split('-');
  for(let i=1;i<places.length;i++){
    const a=places[i-1],b=places[i];
    const mid=fillerRoutes[`${a}-${b}`]?.split(',') ?? fillerRoutes[`${b}-${a}`]?.split(',').reverse() ?? [];
    const path=[a,...mid,b];
    for(let j=1;j<path.length;j++)addEdge(path[j-1],path[j]);
  }
}
for(const line of ['函館-青森','神戸-高松','広島-松山','新潟-小樽','博多-長崎','鹿児島-那覇']){
  const [a,b]=line.split('-');addEdge(a,b,'sea',80);
}
for(const line of ['羽田空港-新千歳空港','羽田空港-関西空港','羽田空港-福岡空港','福岡空港-新千歳空港','関西空港-福岡空港','羽田空港-那覇','福岡空港-那覇']){
  const [a,b]=line.split('-'); if(stationId.has(a)&&stationId.has(b))addEdge(a,b,'air',240);
}
export const EDGES=[...edgeMap.values()];
export const LINKS=EDGES.map(({a,b})=>[a,b]);
export const NEIGHBORS=STATIONS.map(s=>EDGES.filter(e=>e.a===s.id||e.b===s.id).map(e=>e.a===s.id?e.b:e.a));
export const edgeBetween=(a,b)=>EDGES.find(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));
export const START = stationId.get('東京');
const OLD_STATION_NAMES = ['東京','横浜','小田原','静岡','浜松','名古屋','岐阜','京都','大阪','神戸','姫路','岡山','広島','山口','博多','熊本','鹿児島','松山','高松','金沢','富山','新潟','仙台','盛岡','青森','函館','札幌','宇都宮'];

const COLORS = ['#ed6758', '#4082eb', '#1daa83', '#9c6cdd'];
const EVENTS = [
  { text: '芝浦工大の学園祭が大成功！', money: 340 },
  { text: 'ロボコンで開発したロボットが入賞！', money: 300 },
  { text: '東大宮のスクールバスが増便！', money: 190 },
  { text: '研究室のGPUが故障した…', money: -260 },
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
const initialPlayer = (p, i = 0) => ({ id:p.id,token:p.token,name:p.name,color:COLORS[i],pos:START,money:2000,cards:['local','guard'],shield:0,rollBonus:0,fixedDie:null });
export function newGame({ id, token, name, rounds = 6 }, rng = Math.random) {
  const g = { version: 3, poorGodId:null, status: 'lobby', hostId: id, players: [initialPlayer({ id, token, name })], owners: {}, rounds: [6,10].includes(rounds) ? rounds : 6, round: 1, turnIndex: 0, phase: 'roll', pending: null, destination: nextGoal(START, rng), lastRoll: null, lastAction: null, actionSeq: 0, logSeq: 0, logs: [], turnStartedAt: Date.now() };
  log(g, `${name}さんが旅の部屋を作成しました！`, 'system');
  return g;
}
// Preserve old rooms after upgrading: map stations/ownership, safely reset unfinished decisions.
export function upgradeGame(game) {
  if (game.version === 3) return game;
  const g = structuredClone(game);
  if (!g.version || g.version < 2) {
    g.players = g.players.map(p => ({ ...p, pos: stationId.get(OLD_STATION_NAMES[p.pos]) ?? START }));
    g.destination = stationId.get(OLD_STATION_NAMES[g.destination]) ?? nextGoal(START);
    const owners={};
    for(const [oldIndex,ownerId] of Object.entries(g.owners ?? {})){
      const station=STATIONS.find(s=>s.name===OLD_STATION_NAMES[Number(oldIndex)]);
      if(station?.properties[0])owners[station.properties[0].id]=ownerId;
    }
    g.owners=owners;
  }
  g.version=3;g.poorGodId=null;g.actionSeq=g.actionSeq ?? 0;g.logSeq=g.logSeq ?? (g.logs?.length ?? 0);
  g.players=g.players.map(p=>({ ...p,cards:[...(p.cards ?? []),...Array(Math.min(p.express ?? 0,3)).fill('express')].slice(0,CARD_LIMIT),shield:p.shield ?? 0,express:0,rollBonus:0,fixedDie:null }));
  g.phase='roll';g.pending=null;g.lastRoll=null;
  log(g,'全国路線が大幅リニューアル！ 進行中の操作を一度リセットしました。','system');
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
function endTurn(g, rng = Math.random) {
  const actor=g.players[g.turnIndex];
  if (g.poorGodId===actor?.id && g.status==='playing') {
    let amount=-(Math.floor(rng()*4)+1)*90;
    let text='貧乏神がムダ遣い！';
    if (actor.shield>0) { actor.shield--;amount=0;text='単位取得のおまもりで貧乏神を防御！'; }
    actor.money+=amount;
    log(g,`👻 ${actor.name}さん：${text} ${amount? '−'+money(amount):''}`,'loss');
    announce(g,'poor',{playerId:actor.id,money:amount,message:text});
  }
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
function attachPoorGod(g, goalPlayer) {
  if(g.players.length<2)return;
  const candidates=g.players.filter(p=>p.id!==goalPlayer.id);
  const worst=[...candidates].sort((a,b)=>shortestPath(b.pos,g.destination).length-shortestPath(a.pos,g.destination).length)[0];
  g.poorGodId=worst.id;
  log(g,`👻 貧乏神が${worst.name}さんに取りついた！ 誰かに接触すると移せます`,'loss');
}
function passPoorGod(g, actor) {
  const other=g.players.find(p=>p.id!==actor.id&&p.pos===actor.pos);
  if(!other)return;
  if(g.poorGodId===actor.id)g.poorGodId=other.id;
  else if(g.poorGodId===other.id)g.poorGodId=actor.id;
  else return;
  log(g,`👻 貧乏神が${nameOf(g,g.poorGodId)}さんに移った！`,'loss');
}
function resolveLanding(g, actor, rng) {
  const station = STATIONS[actor.pos];
  if (station.id === g.destination) {
    actor.money += 1100;
    log(g, `🎯 ${actor.name}さんが目的地「${station.name}」に到着！ +1,100万円`, 'goal');
    announce(g, 'goal', { playerId: actor.id, station: station.name, money: 1100 });
    g.destination = nextGoal(station.id, rng);
    attachPoorGod(g,actor);
  }
  if (station.type === 'event') {
    const evt = choose(EVENTS, rng); let delta = evt.money;
    let message = evt.text;
    if (delta < 0 && actor.shield > 0) { actor.shield--; delta = 0; message = 'おまもりで出費を回避！'; }
    actor.money += delta;
    log(g, `${actor.name}さん：${message} ${delta > 0 ? '+' : delta < 0 ? '−' : ''}${delta ? money(delta) : ''}`, delta < 0 ? 'loss' : 'income');
    announce(g, 'event', { playerId: actor.id, station: station.name, message, money: delta });
  }
  if(station.type==='card') {
    const keys=Object.keys(CARDS);
    const found=choose(keys,rng);
    if(actor.cards.length<CARD_LIMIT){actor.cards.push(found);log(g,`🃏 ${actor.name}さんが「${CARDS[found].name}」を入手！`,'income');announce(g,'card',{playerId:actor.id,message:CARDS[found].name});}
    else {actor.money+=80;log(g,`カード満杯！ ${actor.name}さんに80万円のボーナス`,'income');}
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
    const die = actor.fixedDie ?? Math.floor(rng() * 6) + 1;
    const boost = (actor.express ?? 0) > 0 ? 2 : 0;
    if (boost) actor.express--;
    const extra = actor.rollBonus ?? 0; const fixed = actor.fixedDie; actor.rollBonus=0;actor.fixedDie=null;
    g.phase = 'move';
    g.pending = { type: 'move', playerId: actor.id, remaining: die + boost + extra, total: die + boost + extra, path: [actor.pos] };
    g.lastRoll = { playerId: actorId, die, boost, from: actor.pos, steps: die + boost + extra, at: Date.now() };
    announce(g, 'roll', { playerId: actor.id, die, boost: boost + extra });
    log(g, `🎲 ${actor.name}さんは${die}${boost ? '（特急+2）' : ''}！ 行き先を選択中`, 'move');
  } else if (action?.type === 'move') {
    if (g.status !== 'playing' || !isTurn || g.phase !== 'move' || g.pending?.type !== 'move') throw Error('今は移動できません。');
    const to = action.to;
    if (!Number.isInteger(to) || !NEIGHBORS[actor.pos].includes(to)) throw Error('線路でつながった隣の駅を選んでください。');
    const from = actor.pos;
    const edge=edgeBetween(from,to);
    if(!edge)throw Error('このルートは利用できません。');
    if(actor.money < edge.fare)throw Error('交通費が足りません。');
    actor.money-=edge.fare;
    actor.pos = to;
    passPoorGod(g,actor);
    g.pending.remaining--; g.pending.path.push(to);
    announce(g, 'step', { playerId: actor.id, from, to, mode:edge.mode, fare:edge.fare, remaining: g.pending.remaining });
    if (g.pending.remaining === 0) {
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
    endTurn(g,rng);
  } else if (action?.type === 'shop') {
    if (g.status !== 'playing' || !isTurn || g.phase!=='decide' || g.pending?.type!=='shop' || !(action.item in CARDS)) throw Error('買い物できません。');
    const item=CARDS[action.item];
    if(actor.money<item.price || actor.cards.length>=CARD_LIMIT)throw Error('所持金不足、またはカードは8枚までです。');
    actor.money-=item.price;actor.cards.push(action.item);
    log(g,`${item.icon} ${actor.name}さんが${item.name}を${money(item.price)}で購入`,'income');
    announce(g,'buy',{playerId:actor.id,station:STATIONS[actor.pos].name,money:-item.price,items:1});
    endTurn(g,rng);
  } else if (action?.type === 'play_card') {
    if(g.status!=='playing'||!isTurn||g.phase!=='roll')throw Error('カードはサイコロを振る前に使えます。');
    const type=action.card;
    if(typeof type!=='string'||!(type in CARDS)||!actor.cards.includes(type))throw Error('そのカードを持っていません。');
    if(['express','shinkansen'].includes(type)&&actor.rollBonus)throw Error('移動カードは重ねて使えません。');
    if(type==='local'&&actor.fixedDie!==null)throw Error('サイコロ固定は重ねて使えません。');
    actor.cards.splice(actor.cards.indexOf(type),1);
    if(type==='express')actor.rollBonus=2;
    else if(type==='shinkansen')actor.rollBonus=4;
    else if(type==='local')actor.fixedDie=1;
    else if(type==='grant')actor.money+=400;
    else if(type==='guard')actor.shield++;
    else if(type==='warp'){
      const choices=STATIONS.filter(st=>st.type==='city'&&st.id!==actor.pos);
      actor.pos=choose(choices,rng).id;
      passPoorGod(g,actor);
      log(g,`✈️ ${actor.name}さんが${STATIONS[actor.pos].name}へぶっとび！`,'move');
      announce(g,'warp',{playerId:actor.id,to:actor.pos,message:STATIONS[actor.pos].name});
      resolveLanding(g,actor,rng);
      return g;
    }
    log(g,`🃏 ${actor.name}さんが「${CARDS[type].name}」を使用！`,'income');
    announce(g,'card_use',{playerId:actor.id,message:CARDS[type].name});
  } else if (action?.type === 'skip') {
    if (g.status !== 'playing' || !isTurn || g.phase !== 'decide') throw Error('見送れません。');
    endTurn(g,rng);
  } else if (action?.type === 'skip_offline') {
    if (g.status !== 'playing' || connected.includes(g.players[g.turnIndex].id)) throw Error('オンラインの人はスキップできません。');
    log(g, `${g.players[g.turnIndex].name}さんがオフラインのためパス`, 'system');
    endTurn(g,rng);
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
    stations: STATIONS, links: LINKS, edges: EDGES, neighbors: NEIGHBORS, cardsCatalog: CARDS,
    suggestedRoute, shopItems: SHOP_ITEMS,
  };
}
