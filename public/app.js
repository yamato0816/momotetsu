const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const fmt = n => Number(n || 0).toLocaleString('ja-JP');
const money = value => {
  const n = Math.abs(Number(value) || 0);
  const sign = value < 0 ? '−' : '';
  return `${sign}${n >= 10000 ? `${fmt(Math.floor(n / 10000))}億${n % 10000 ? `${fmt(n % 10000)}万` : ''}` : `${fmt(n)}万`}円`;
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const S = (tag, attrs = {}, txt) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); if (txt != null) el.textContent = String(txt); return el; };
const MAP_WIDTH = 1200, MAP_HEIGHT = 850;
const GRID_COLS = 26, GRID_ROWS = 18;
const GRID_LEFT = 54, GRID_TOP = 58, GRID_DX = 42, GRID_DY = 39;
const MAJOR_STATIONS = new Set(['札幌','函館','青森','盛岡','仙台','福島','宇都宮','大宮','東京','上野','品川','横浜','千葉','長野','新潟','金沢','名古屋','京都','大阪','神戸','岡山','広島','博多','熊本','鹿児島','松山','高松','那覇','羽田空港','新千歳空港','関西空港','福岡空港','豊洲キャンパス','大宮キャンパス']);
const GRID_OVERRIDES = new Map(Object.entries({
  '札幌':[23,2],'小樽':[22,2],'函館':[21,4],'青森':[21,5],'八戸':[22,6],'盛岡':[21,7],'仙台':[21,9],'福島':[20,10],
  '秋田':[18,6],'山形':[18,8],'新潟':[16,9],'富山':[14,9],'金沢':[13,9],'長野':[16,11],'宇都宮':[19,11],
  '大宮キャンパス':[18,12],'東大宮':[19,12],'大宮':[19,13],'上野':[18,14],'東京':[18,15],'豊洲キャンパス':[19,15],'新木場':[20,15],
  '品川':[17,15],'羽田空港':[18,16],'千葉':[21,15],'船橋':[20,14],'川崎':[16,15],'横浜':[15,16],
  '小田原':[14,16],'静岡':[13,15],'浜松':[11,15],'名古屋':[10,15],'岐阜':[10,13],'京都':[9,14],
  '新大阪':[8,15],'大阪':[8,16],'神戸':[7,16],'姫路':[6,15],'岡山':[5,15],'広島':[3,15],'博多':[1,16],
  '長崎':[0,16],'熊本':[1,17],'宮崎':[3,17],'鹿児島':[1,18],'高松':[6,17],'松山':[4,17],'高知':[6,18],
  '関西空港':[8,17],'福岡空港':[2,16],'那覇':[0,20],'新千歳空港':[24,1]
}));
let layoutCacheKey = '';
let layoutCache = null;
function displayStations(stations) {
  const key = stations.length + ':' + stations.map(st => st.name).join('|');
  if (key === layoutCacheKey && layoutCache) return layoutCache;
  const minX = Math.min(...stations.map(st => st.x));
  const maxX = Math.max(...stations.map(st => st.x));
  const minY = Math.min(...stations.map(st => st.y));
  const maxY = Math.max(...stations.map(st => st.y));
  const used = new Set();
  const spiral = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2],[2,1],[-2,1],[2,-1],[-2,-1],[1,2],[-1,2],[1,-2],[-1,-2],[3,0],[-3,0],[0,3],[0,-3]];
  const ordered = [...stations].sort((a,b)=>a.y-b.y || a.x-b.x || a.id-b.id);
  const byId = new Map();
  for (const st of ordered) {
    let gx, gy;
    if (GRID_OVERRIDES.has(st.name)) [gx, gy] = GRID_OVERRIDES.get(st.name);
    else {
      gx = Math.round(((st.x - minX) / Math.max(1, maxX - minX)) * (GRID_COLS - 2)) + 1;
      gy = Math.round(((st.y - minY) / Math.max(1, maxY - minY)) * (GRID_ROWS - 2)) + 1;
    }
    let placed = null;
    for (const [dx, dy] of spiral) {
      const px = Math.max(0, Math.min(GRID_COLS, gx + dx));
      const py = Math.max(0, Math.min(GRID_ROWS + 2, gy + dy));
      const token = px + ':' + py;
      if (!used.has(token)) { placed = [px, py]; used.add(token); break; }
    }
    if (!placed) placed = [gx, gy];
    const [pgx, pgy] = placed;
    const x = GRID_LEFT + pgx * GRID_DX;
    const y = GRID_TOP + pgy * GRID_DY;
    byId.set(st.id, { ...st, x, y, gx: pgx, gy: pgy });
  }
  const list = stations.map(st => byId.get(st.id));
  layoutCacheKey = key;
  layoutCache = { byId, list };
  return layoutCache;
}
function stationView(stations, id) { return displayStations(stations).byId.get(id); }
function railPath(a, b) {
  if (!a || !b) return '';
  if (a.x === b.x || a.y === b.y) return 'M' + a.x + ' ' + a.y + ' L' + b.x + ' ' + b.y;
  const horizontalFirst = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y);
  if (horizontalFirst) {
    const midX = Math.round((a.x + b.x) / 2);
    return 'M' + a.x + ' ' + a.y + ' L' + midX + ' ' + a.y + ' L' + midX + ' ' + b.y + ' L' + b.x + ' ' + b.y;
  }
  const midY = Math.round((a.y + b.y) / 2);
  return 'M' + a.x + ' ' + a.y + ' L' + a.x + ' ' + midY + ' L' + b.x + ' ' + midY + ' L' + b.x + ' ' + b.y;
}
function showStationLabel(st, context = {}) {
  return context.reachable || context.isGoal || context.isPlayer || context.isSelected || context.isCampus || context.isAirport || MAJOR_STATIONS.has(st.name);
}
function labelY(st, visible) {
  const top = st.gy <= 4 || st.name.length >= 5 || visible;
  return st.y + (top ? -26 : 28);
}
function islandPaths() {
  return [
    ['M 908 80 L 1005 56 L 1082 78 L 1128 126 L 1098 172 L 1047 194 L 968 188 L 904 146 Z', '#cfe5ba'],
    ['M 186 641 L 250 618 L 356 592 L 451 557 L 555 516 L 662 468 L 732 407 L 803 366 L 882 292 L 940 224 L 1012 196 L 1050 228 L 1022 274 L 972 306 L 952 357 L 913 392 L 876 454 L 819 489 L 748 520 L 676 551 L 602 584 L 528 621 L 436 663 L 354 693 L 272 705 L 216 692 L 176 666 Z', '#dbecc5'],
    ['M 344 727 L 389 709 L 452 700 L 503 709 L 537 733 L 515 753 L 455 762 L 390 757 L 348 744 Z', '#d7e8c0'],
    ['M 84 632 L 139 612 L 190 620 L 208 648 L 184 683 L 139 710 L 87 712 L 56 692 L 58 654 Z', '#d7e8c0'],
    ['M 42 805 L 56 797 L 69 805 L 62 820 L 48 819 Z', '#d7e8c0']
  ];
}

const face = n => ['⚀','⚁','⚂','⚃','⚄','⚅'][Math.max(0,Math.min(5,n - 1))];
let state = null, room = null, socket = null, token = null, playerId = null;
let reconnectTimer, reconnectCount = 0, intentionalClose = false, selectedStation = null, toastTimer;
let sessionId = 0, leaving = false, zoom = 1.65, centeredRoom = null, momentTimer;
let overview = false, camera = null;
let lastMomentSeq = null, previousPositions = new Map(), previousMoney = new Map();
let selectedProperties = new Set(), purchaseKey = '';

const savedName = localStorage.getItem('rail_name') ?? '';
$('playerName').value = savedName;
$('roomCode').value = new URL(location.href).searchParams.get('room')?.toUpperCase() ?? '';
$('roomCode').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6); });
function notify(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3500); }
function setConnection(type, label) { $('connection').className = `connection ${type}`; $('connection').innerHTML = `<i></i> ${esc(label)}`; }
function ensureIdentity() {
  if (!playerId || !token) {
    playerId = localStorage.getItem('rail_player_id') || crypto.randomUUID();
    token = localStorage.getItem('rail_player_token') || crypto.randomUUID();
    localStorage.setItem('rail_player_id', playerId);
    localStorage.setItem('rail_player_token', token);
  }
}
function nameInput() {
  const name = $('playerName').value.trim();
  if (!name || name.length > 14 || /[<>]/.test(name)) { notify('名前を1〜14文字で入力してください。'); $('playerName').focus(); return null; }
  localStorage.setItem('rail_name', name); return name;
}
function switchToGame() { $('gate').hidden = true; $('game').hidden = false; }
function switchToGate() { $('gate').hidden = false; $('game').hidden = true; state = null; setConnection('', '未接続'); }
async function createRoom() {
  const name = nameInput(); if (!name) return;
  ensureIdentity(); $('createRoom').disabled = true;
  try {
    const resp = await fetch('/api/rooms', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:playerId, token, name, rounds:6 }) });
    const data = await resp.json(); if (!resp.ok) throw Error(data.error ?? '部屋を作れませんでした。');
    connect(data.room, name);
  } catch(e) { notify(e.message); } finally { $('createRoom').disabled = false; }
}
function joinRoom() {
  const name = nameInput(); if (!name) return;
  const code = $('roomCode').value.toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) { notify('正しい6ケタの部屋コードを入力してください。'); return; }
  ensureIdentity(); connect(code, name);
}
function connect(code, name, isRetry = false) {
  clearTimeout(reconnectTimer);
  if (!isRetry) {
    ++sessionId; reconnectCount = 0; state = null; centeredRoom = null;
    previousPositions.clear(); previousMoney.clear(); lastMomentSeq = null; selectedProperties.clear(); purchaseKey = ''; overview = false; camera = null;
  }
  const currentSession = sessionId; intentionalClose = false;
  if (socket) { const old = socket; socket = null; old.onclose = null; old.close(); }
  room = code; switchToGame(); $('roomDisplay').textContent = code;
  const url = new URL(location.href); url.searchParams.set('room', code); history.replaceState(null, '', url);
  setConnection('reconnecting', '接続中…');
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${location.host}/api/rooms/${code}/ws?id=${encodeURIComponent(playerId)}&token=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}`);
  socket = ws;
  ws.onopen = () => { if (currentSession === sessionId) { reconnectCount = 0; setConnection('online', 'オンライン'); } };
  ws.onmessage = event => {
    if (currentSession !== sessionId || event.data === 'pong') return;
    let payload; try { payload = JSON.parse(event.data); } catch { return; }
    if (payload.type === 'error') notify(payload.message);
    if (payload.type === 'state') {
      state = payload.state;
      if (leaving && !state.players.some(p => p.id === playerId)) { leaving = false; stopConnection(); notify('退出しました。'); return; }
      render();
    }
  };
  ws.onclose = () => {
    if (currentSession !== sessionId || intentionalClose) return;
    if (leaving) { stopConnection(); notify('退出しました。'); return; }
    setConnection('reconnecting', '再接続中…'); reconnectCount++;
    if (!state && reconnectCount >= 3) { notify('部屋がない・満員・参加不可の可能性があります。'); switchToGate(); return; }
    reconnectTimer = setTimeout(() => connect(code, name, true), Math.min(12000, 1200 * 2 ** Math.min(4,reconnectCount - 1)));
  };
  ws.onerror = () => {};
}
function send(type, extra = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) { notify('接続が切れています。'); return; }
  socket.send(JSON.stringify({ type, ...extra }));
}
function stopConnection() {
  leaving = false; ++sessionId; intentionalClose = true; clearTimeout(reconnectTimer);
  if (socket) { const old = socket; socket = null; old.onclose = null; old.close(); }
  room = null;
  const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null, '', url);
  switchToGate();
}
$('createRoom').addEventListener('click', createRoom);
$('joinRoom').addEventListener('click', joinRoom);
$('roomCode').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
$('copyInvite').addEventListener('click', async () => {
  const link = `${location.origin}/?room=${room}`;
  try { await navigator.clipboard.writeText(link); notify('招待リンクをコピーしました！'); }
  catch { window.prompt('このリンクを友達に送ってください：', link); }
});
$('leaveRoom').addEventListener('click', () => {
  if (!window.confirm('この部屋から退出しますか？ 対戦中は戻るまでターンが残ります。')) return;
  if (state?.status === 'lobby' && socket?.readyState === WebSocket.OPEN) { leaving = true; send('remove', { playerId }); }
  else stopConnection();
});
$('game').addEventListener('click', e => {
  const emote = e.target.closest('[data-emote]'); if (emote) send('emote', { value: emote.dataset.emote });
  const button = e.target.closest('[data-action]'); if (!button || button.disabled) return;
  switch(button.dataset.action) {
    case 'start': send('start'); break;
    case 'roll': send('roll'); break;
    case 'step': send('move', { to:Number(button.dataset.to) }); break;
    case 'buy_many': send('buy_many', { items:[...selectedProperties] }); break;
    case 'skip': send('skip'); break;
    case 'shop': send('shop', { item:button.dataset.item }); break;
    case 'play_card': send('play_card',{card:button.dataset.card}); break;
    case 'skip_offline': send('skip_offline'); break;
    case 'restart': send('restart'); break;
    case 'remove': send('remove', { playerId:button.dataset.id }); break;
  }
});
$('game').addEventListener('change', e => {
  if (e.target.matches('#roundSelect')) send('rounds', { value:Number(e.target.value) });
  if (e.target.matches('[data-property]')) {
    const id = e.target.dataset.property;
    if (e.target.checked) selectedProperties.add(id); else selectedProperties.delete(id);
    updatePurchaseSummary();
  }
});
function setZoom(value) {
  zoom = Math.max(.6, Math.min(2.2, value));
  overview=false;
  $('mapOverview').classList.remove('is-on');
  focusMap();
}
$('mapZoomIn').addEventListener('click', () => setZoom(zoom * 1.22));
$('mapZoomOut').addEventListener('click', () => setZoom(zoom / 1.22));
$('mapCenter').addEventListener('click', () => {overview=false;camera=null;$('mapOverview').classList.remove('is-on');focusMap();});
$('mapOverview').addEventListener('click', () => { overview=!overview;camera=null;$('mapOverview').classList.toggle('is-on',overview);focusMap(); });
function focusMap() {
  if(!state)return;
  const me=state.players.find(p=>p.id===playerId) ?? state.players[state.turnIndex];
  const st=stationView(state.stations, me?.pos);if(!st)return;
  camera={x:st.x,y:st.y};
  updateCamera(true);
}
function updateCamera(immediate=false) {
  if(!state)return;
  const svg=$('railMap');
  const me=state.players.find(p=>p.id===playerId) ?? state.players[state.turnIndex];
  const st=stationView(state.stations, me?.pos);if(!st)return;
  if(overview){svg.setAttribute('viewBox', '0 0 ' + MAP_WIDTH + ' ' + MAP_HEIGHT);return;}
  const box=svg.getBoundingClientRect();
  const ratio=Math.max(.72,box.width/Math.max(1,box.height));
  const h=Math.max(260, 430/zoom), w=h*ratio;
  const x=Math.max(0,Math.min(MAP_WIDTH-w,(camera?.x??st.x)-w/2));
  const y=Math.max(0,Math.min(MAP_HEIGHT-h,(camera?.y??st.y)-h/2));
  svg.setAttribute('viewBox', x + ' ' + y + ' ' + w + ' ' + h);
}
window.addEventListener('resize',()=>updateCamera(true));
function render() {
  const s = state; if (!s) return;
  const me = s.players.find(p => p.id === playerId);
  const active = s.players[s.turnIndex]; const isHost = s.hostId === playerId;
  $('roomDisplay').textContent = room;
  $('roundBadge').textContent = s.status === 'lobby' ? '出発準備中' : s.status === 'finished' ? '結果発表' : `${s.round}年目 / 全${s.rounds}年`;
  $('destinationName').textContent = s.stations[s.destination]?.name ?? '未定';
  $('playerCount').textContent = `${s.players.length} / 4人`;
  $('turnIndicator').textContent = s.status !== 'playing' ? 'RAIL TRIP' : active?.id === playerId ? 'あなたの番！' : `${esc(active?.name)}の番`;
  renderHud(s, active);
  renderMap(s, me, active);
  renderActions(s, me, active, isHost);
  renderPlayers(s, active, isHost);
  $('logsList').innerHTML = s.logs.slice(0, 16).map(e => `<div class="log-item log-${esc(e.kind)}">${esc(e.text)}</div>`).join('');
  if (centeredRoom !== room) { centeredRoom = room; requestAnimationFrame(focusMap); }
  else if (!overview) { const st=s.stations[me?.pos]; if(st) { camera={x:st.x,y:st.y}; updateCamera(); } }
  if (lastMomentSeq === null) lastMomentSeq = s.lastAction?.seq ?? 0;
  else if (s.lastAction && s.lastAction.seq !== lastMomentSeq) { lastMomentSeq = s.lastAction.seq; showMoment(s.lastAction, s); }
}
function renderHud(s, active) {
  $('playerHud').innerHTML = s.players.map(p => {
    const delta = previousMoney.has(p.id) ? p.money - previousMoney.get(p.id) : 0;
    previousMoney.set(p.id, p.money);
    return `<div class="money-board ${p.id === active?.id && s.status === 'playing' ? 'is-turn' : ''}" style="--player:${p.color}">
      <div class="money-board-top"><span class="money-player-dot">🚂</span><strong>${esc(p.name)}</strong><small>${p.id === playerId ? 'あなた' : p.online ? '● 接続中' : '○ オフライン'}${s.poorGodId === p.id ? ' 👻 貧乏神' : ''}</small></div>
      <div class="money-label">持ち金</div><div class="money-number">${money(p.money)}</div>
      <div class="money-meta"><span>総資産 <b>${money(p.worth)}</b></span><span>物件 <b>${p.propertyCount}件</b></span><span>カード <b>${p.cards?.length ?? 0}枚</b></span></div>
      ${delta ? `<div class="money-pop ${delta > 0 ? 'positive' : 'negative'}">${delta > 0 ? '+' : '−'}${money(Math.abs(delta))}</div>` : ''}
    </div>`;
  }).join('');
}
function renderActions(s, me, active, isHost) {
  const el = $('actionContent');
  if (!me) { el.innerHTML = '<h2 class="turn-title">観戦モード</h2>'; return; }
  if (s.status === 'lobby') {
    const everyoneOnline = s.players.every(p => p.online);
    el.innerHTML = `<h2 class="turn-title">🚉 みんなで出発！</h2><p class="turn-sub">部屋コードを友達に送ろう。2人以上でスタート！</p><div class="lobby-code">${esc(room)}</div>${isHost ? `<label for="roundSelect" class="turn-sub">勝負する年数</label><select id="roundSelect" class="select-rounds"><option value="6" ${s.rounds === 6 ? 'selected' : ''}>6年勝負・さくっと</option><option value="10" ${s.rounds === 10 ? 'selected' : ''}>10年勝負・じっくり</option></select><button data-action="start" class="move-btn" ${s.players.length < 2 || !everyoneOnline ? 'disabled' : ''}>🚄 ゲームスタート！</button>` : '<p class="turn-sub">ホストのスタートを待っています ☕</p>'}<p class="turn-sub">参加 ${s.players.length}人 / ${everyoneOnline ? '全員オンライン' : '接続待ちの人がいます'}</p>`;
    return;
  }
  if (s.status === 'finished') {
    const winner = [...s.players].sort((a,b) => b.worth - a.worth)[0];
    el.innerHTML = `<h2 class="turn-title">🏆 ${esc(winner.name)}さんが優勝！</h2><p class="turn-sub">最終総資産 <strong class="turn-highlight">${money(winner.worth)}</strong></p>${isHost ? '<button class="move-btn" data-action="restart">🔁 同じメンバーで再戦</button>' : '<p class="turn-sub">ホストの再戦操作を待っています。</p>'}`; return;
  }
  const isMyTurn = active?.id === playerId;
  if (!isMyTurn) {
    el.innerHTML = `<h2 class="turn-title">🚂 ${esc(active?.name)}さんの番</h2><p class="turn-sub">${s.phase === 'move' ? `あと${s.pending?.remaining}マス、ルートを選択中` : '相手が操作しています。作戦を考えよう！'}</p><div class="dice-face">${s.lastRoll ? face(s.lastRoll.die) : '🎲'}</div>${active && !active.online ? '<button data-action="skip_offline" class="outline-btn wide">📡 オフラインの人をスキップ</button>' : ''}`;
    return;
  }
  if (s.phase === 'roll') {
    el.innerHTML = `<h2 class="turn-title">🎲 ${esc(me.name)}さんの番！</h2><p class="turn-sub">出目の数だけ、好きな線路を進めます。<br>目的地まで最短 <b>${me.goalSteps}マス</b></p><div class="dice-face">🎲</div><button class="move-btn" data-action="roll">サイコロを振る！</button><div class="item-summary">🎒 カード${me.cards.length} / 8枚　🛡️ 防御${me.shield}</div>${renderCardInventory(s,me,true)}`;
    return;
  }
  if (s.phase === 'move') {
    const remaining = s.pending.remaining;
    const options = s.neighbors[me.pos];
    const hint = s.suggestedRoute?.[1];
    el.innerHTML = `<h2 class="turn-title">🚂 どっちへ進む？</h2><div class="remaining"><strong>${remaining}</strong><span>マス のこり</span></div><div class="move-progress">${Array.from({ length:s.pending.total }, (_,i) => `<i class="${i < s.pending.total - remaining ? 'done' : ''}"></i>`).join('')}</div><p class="turn-sub">列車の周りに出る<strong>方向矢印をタップ</strong>して1マスずつ進もう。青＝海路、紫＝空路です。</p><div class="route-choices">${options.map(i => `<button type="button" class="route-choice ${i === hint ? 'recommended' : ''}" data-action="step" data-to="${i}"><span>🚉 ${esc(s.stations[i].name)}</span><small>${s.edges.find(e=>(e.a===me.pos&&e.b===i)||(e.b===me.pos&&e.a===i))?.mode==='air'?'✈ 空路':s.edges.find(e=>(e.a===me.pos&&e.b===i)||(e.b===me.pos&&e.a===i))?.mode==='sea'?'⛴ 海路':i===hint?'🎯 最短':'鉄道'} →</small></button>`).join('')}</div><p class="mini-help">移動方向は毎マス変更できます。引き返すことも可能です。</p>`;
    return;
  }
  const pending = s.pending;
  if (pending?.type === 'city') {
    renderPropertyShop(s, me, pending.index, el); return;
  }
  if (pending?.type === 'shop') {
    el.innerHTML = `<h2 class="turn-title">🎁 カードショップ</h2><p class="turn-sub">所持金 <b>${money(me.money)}</b><br>使えるカードを選ぼう（合計8枚まで）</p><div class="shop-row">${Object.entries(s.shopItems).map(([id,item]) => `<button class="shop-btn" data-action="shop" data-item="${id}" ${me.money < item.price || me.cards.length >= 8 ? 'disabled' : ''}>${item.icon} ${esc(item.name)}<small>${esc(item.description)}<br><b>${money(item.price)}</b> ／ 所持 ${me.cards.filter(c=>c===id).length}</small></button>`).join('')}</div><button class="outline-btn wide" data-action="skip">何も買わずに終了</button>`;
  }
}
function renderCardInventory(s,me,enabled) {
  if(!me.cards?.length)return '<p class="turn-sub">カードはまだありません。カード駅でゲットしよう！</p>';
  return `<div class="card-inventory">${me.cards.map((key,i)=>{
    const card=s.cardsCatalog[key];if(!card)return '';
    return `<button type="button" class="inventory-card" data-action="play_card" data-card="${key}" ${enabled?'':'disabled'} title="${esc(card.description)}"><span>${card.icon} ${esc(card.name)}</span><small>${esc(card.description)}</small></button>`;
  }).join('')}</div>`;
}
function renderPropertyShop(s, me, index, el) {
  const station = s.stations[index];
  const key = `${s.round}:${s.turnIndex}:${index}:${s.lastRoll?.at}`;
  if (key !== purchaseKey) { selectedProperties.clear(); purchaseKey = key; }
  // The choice board supports multiple selections, just like a shopping basket.
  const rows = station.properties.map(p => {
    const owner = s.players.find(x => x.id === s.owners[p.id]);
    const unavailable = Boolean(owner) || p.price > me.money;
    return `<label class="property-row ${owner ? 'sold' : ''} ${unavailable ? 'unavailable' : ''}"><input type="checkbox" data-property="${p.id}" ${selectedProperties.has(p.id) ? 'checked' : ''} ${unavailable ? 'disabled' : ''}><span class="property-name"><b>${esc(p.name)}</b><small>${owner ? `🚩 ${esc(owner.name)}の物件` : '購入できます'}</small></span><span class="property-rate">${p.yieldRate}%<small>収益率</small></span><strong class="property-price">${money(p.price)}</strong></label>`;
  }).join('');
  const owned = station.properties.filter(p => s.owners[p.id] === me.id).length;
  el.innerHTML = `<div class="property-header"><div class="property-kicker">🏙️ 物件駅</div><h2>${esc(station.name)}</h2><p>買いたい物件を選択してください</p></div><div class="property-table-head"><span>物件名</span><span>利益</span><span>価格</span></div><div class="property-list">${rows}</div><div class="monopoly-hint">🏅 全物件をそろえると、この駅の年間収益が<span>2倍</span>！ ${owned ? `（現在${owned}件所有）` : ''}</div><div class="purchase-summary"><span>購入額の合計</span><b id="purchaseTotal">0万円</b></div><div class="purchase-after" id="purchaseAfter">購入後の持ち金 ${money(me.money)}</div><button class="move-btn" data-action="buy_many" id="purchaseButton" disabled>物件を選んでください</button><button class="outline-btn wide" data-action="skip">購入を終える / 見送る</button>`;
  updatePurchaseSummary();
}
function updatePurchaseSummary() {
  if (state?.pending?.type !== 'city') return;
  const me = state.players.find(p => p.id === playerId); if (!me) return;
  const st = state.stations[state.pending.index];
  let total = 0;
  for (const id of [...selectedProperties]) {
    const p = st.properties.find(p => p.id === id);
    if (!p || state.owners[id]) selectedProperties.delete(id);
    else total += p.price;
  }
  const enough = total <= me.money;
  $('purchaseTotal').textContent = money(total);
  $('purchaseTotal').classList.toggle('over-budget', !enough);
  $('purchaseAfter').textContent = enough ? `購入後の持ち金 ${money(me.money - total)}` : `持ち金が ${money(total - me.money)} 足りません`;
  $('purchaseButton').disabled = !selectedProperties.size || !enough;
  $('purchaseButton').textContent = !selectedProperties.size ? '物件を選んでください' : enough ? `${selectedProperties.size}件をまとめて購入する` : '所持金が足りません';
}
function renderPlayers(s, active, isHost) {
  const ranking = [...s.players].sort((a,b) => b.worth - a.worth);
  $('playersList').innerHTML = ranking.map((p,i) => `<div class="player-line ${p.id === active?.id && s.status === 'playing' ? 'active' : ''}"><div class="player-rank">${i+1}</div><div class="player-avatar" style="background:${p.color}">${esc(p.name.slice(0,1))}</div><div class="player-text"><div class="player-name">${esc(p.name)}${p.id === playerId ? '（自分）' : ''}${p.id === s.hostId ? ' 👑' : ''}</div><div class="player-details"><span class="${p.online ? 'online-icon' : 'offline-icon'}">●</span> ${esc(s.stations[p.pos]?.name)} ・ 年収${money(p.income)}</div></div><div class="player-money">${money(p.worth)}</div>${isHost && s.status === 'lobby' && !p.online && p.id !== playerId ? `<button data-action="remove" data-id="${esc(p.id)}" class="outline-btn" aria-label="削除">×</button>` : ''}</div>`).join('');
}
function showMoment(a, s) {
  const el = $('gameMoment');
  let title = '', subtitle = '', symbol = '';
  if (a.type === 'roll') { title = `サイコロは ${a.die}！`; subtitle = a.boost ? `特急きっぷで +${a.boost} マス！` : '進む道を選ぼう！'; symbol = face(a.die); }
  else if (a.type === 'goal') { title = '目的地に到着！'; subtitle = `🎉 ${a.station}　+${money(a.money)}`; symbol = '🏆'; }
  else if (a.type === 'event') { title = a.money < 0 ? 'ハプニング！' : 'イベント発生！'; subtitle = `${a.message} ${a.money ? `${a.money > 0 ? '+' : ''}${money(a.money)}` : ''}`; symbol = a.money < 0 ? '💦' : '🎁'; }
  else if (a.type === 'poor') { title='貧乏神のいたずら！';subtitle=`${a.message} ${a.money ? money(a.money) : ''}`;symbol='👻'; }
  else if(a.type==='warp'){title='ぶっとび！';subtitle=`${a.message}へ！`;symbol='✈️';}
  else if(a.type==='card'||a.type==='card_use'){title=a.type==='card'?'カード獲得！':'カード使用！';subtitle=a.message;symbol='🃏';}
  else if (a.type === 'buy') { title = 'お買い上げ！'; subtitle = `${a.station}　${money(a.money)}`; symbol = '🏠'; }
  else return;
  el.innerHTML = `<div class="moment-sheet"><span class="moment-symbol">${symbol}</span><div class="moment-title">${esc(title)}</div><div class="moment-sub">${esc(subtitle)}</div></div>`;
  el.classList.remove('visible'); void el.offsetWidth; el.classList.add('visible');
  clearTimeout(momentTimer); momentTimer = setTimeout(() => el.classList.remove('visible'), a.type === 'roll' ? 1050 : 1750);
}
function renderMap(s, me, active) {
  const svg = $('railMap'); svg.replaceChildren();
  const { byId } = displayStations(s.stations);
  const defs = S('defs');
  const sea = S('linearGradient', { id:'seaTint', x1:'0',y1:'0',x2:'1',y2:'1' });
  sea.append(S('stop',{offset:'0%','stop-color':'#d4eef7'}),S('stop',{offset:'100%','stop-color':'#9bd4e8'}));
  const land = S('linearGradient', { id:'landTint', x1:'0',y1:'0',x2:'1',y2:'1' });
  land.append(S('stop',{offset:'0%','stop-color':'#eef7dd'}),S('stop',{offset:'100%','stop-color':'#bfdca0'}));
  defs.append(sea, land); svg.append(defs);
  svg.append(S('rect',{x:0,y:0,width:MAP_WIDTH,height:MAP_HEIGHT,fill:'url(#seaTint)'}));
  const grid = S('g',{opacity:'.18'});
  for(let x=GRID_LEFT-24;x<=MAP_WIDTH-40;x+=GRID_DX) grid.append(S('path',{d:'M'+x+' 0V'+MAP_HEIGHT,stroke:'#fff','stroke-width':1}));
  for(let y=GRID_TOP-20;y<=MAP_HEIGHT-30;y+=GRID_DY) grid.append(S('path',{d:'M0 '+y+'H'+MAP_WIDTH,stroke:'#fff','stroke-width':1}));
  svg.append(grid);
  const landLayer = S('g', { opacity: '.96' });
  for (const [d, fill] of islandPaths()) landLayer.append(S('path', { d, fill:'url(#landTint)', stroke:'#9fbe87', 'stroke-width':4, 'stroke-linejoin':'round' }));
  svg.append(landLayer);
  for (const [x, y, name] of [[1012,120,'北海道'],[920,352,'東北'],[870,650,'関東'],[648,548,'中部'],[450,646,'近畿'],[230,648,'中国'],[438,742,'四国'],[102,656,'九州'],[60,812,'沖縄']]) svg.append(S('text',{x,y,class:'map-area-name','text-anchor':'middle'},name));

  const rails = S('g',{class:'rail-layer'});
  for (const edge of s.edges) {
    const a = byId.get(edge.a), b = byId.get(edge.b);
    const d = railPath(a, b);
    if (edge.mode === 'rail') {
      rails.append(S('path',{d,class:'rail-shadow'}));
      rails.append(S('path',{d,class:'rail-base'}));
      rails.append(S('path',{d,class:'rail-ties'}));
    } else {
      rails.append(S('path',{d, class:'transport-line ' + edge.mode}));
    }
  }
  svg.append(rails);

  if (s.status === 'playing' && s.suggestedRoute?.length > 1) {
    const pts = s.suggestedRoute.map(i => { const st = byId.get(i); return st.x + ',' + st.y; }).join(' ');
    svg.append(S('polyline',{points:pts,class:'suggested-track'}));
  }

  const canMove = s.phase==='move' && active?.id===playerId;
  const accessible = new Set(canMove && me ? s.neighbors[me.pos] : []);
  const occupied = new Set(s.players.map(p => p.pos));
  for (const station of s.stations) {
    const view = byId.get(station.id);
    const {x,y,id,name,type} = view;
    const isGoal=id===s.destination, reachable=accessible.has(id), isSelected=selectedStation===id, isPlayer=occupied.has(id);
    const owned=station.properties.filter(p=>s.owners[p.id]);
    const owners=[...new Set(owned.map(p=>s.owners[p.id]))];
    const isFullyOwned=station.properties.length>0 && owned.length===station.properties.length;
    const owner=owners.length===1 ? s.players.find(p=>p.id===owners[0]) : null;
    const isAirport = type==='airport';
    const isCampus = /キャンパス/.test(name);
    const showLabel = showStationLabel(view, {reachable,isGoal,isSelected,isPlayer,isAirport,isCampus});
    const markerType = type === 'airport' ? 'shop' : type;
    const group=S('g',{class:'station-marker '+ markerType + (isGoal?' is-goal':'') + (reachable?' reachable':''),tabindex:0,role:'button','aria-label':name + (reachable?'、ここへ移動可能':'')});
    if(isGoal)group.append(S('circle',{cx:x,cy:y,r:22,class:'goal-pulse'}));
    if(reachable)group.append(S('circle',{cx:x,cy:y,r:21,class:'reach-ring'}));
    const fill = owner?.color || (type==='city' ? '#3e83cf' : type==='event' ? '#ef745c' : type==='card' ? '#f3c663' : isAirport ? '#7b75e6' : '#9d7ce1');
    group.append(S('circle',{cx:x,cy:y,r:13,fill, class:'station-outer'}));
    group.append(S('circle',{cx:x,cy:y,r:6.4,fill:'#fff',opacity:'.97'}));
    const symbol = isAirport ? '✈' : isCampus ? '🎓' : type==='city' ? '¥' : type==='event' ? '!' : type==='card' ? 'C' : '★';
    group.append(S('text',{x,y:y+4,class:'station-symbol'},symbol));
    if(showLabel) group.append(S('text',{x,y:labelY(view, reachable||isGoal),class:'station-label ' + (reachable?'can-go':''),'text-anchor':'middle'},name));
    if(isGoal)group.append(S('text',{x,y:y-32,class:'goal-flag','text-anchor':'middle'},'🚩'));
    if(isFullyOwned && owner)group.append(S('text',{x:x+15,y:y-8,class:'owner-flag','text-anchor':'middle'},'★'));
    group.addEventListener('click',()=>{ if(reachable) send('move',{to:id}); else selectStation(s,id); });
    group.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault(); if(reachable)send('move',{to:id}); else selectStation(s,id);} });
    svg.append(group);
  }

  s.players.forEach((p,i)=>{
    const station=byId.get(p.pos);
    const others=s.players.slice(0,i).filter(o=>o.pos===p.pos).length;
    const x=station.x+18+(others%2)*28,y=station.y-18-Math.floor(others/2)*30;
    const group=S('g',{class:'token ' + (p.id===playerId?'me':''),transform:'translate(' + x + ',' + y + ')'});
    group.append(S('rect',{x:-17,y:-16,width:34,height:31,rx:10,fill:p.color,class:'train-token'}));
    group.append(S('text',{x:0,y:4,'text-anchor':'middle',class:'train-symbol'},'🚂'));
    group.append(S('text',{x:0,y:24,'text-anchor':'middle',class:'token-name'},p.name.slice(0,4)));
    if(s.poorGodId===p.id) group.append(S('text',{x:23,y:-16,class:'poor-token'},'👻'));
    svg.append(group);
    const prev=previousPositions.get(p.id);
    const prevSt = prev != null ? byId.get(prev) : null;
    if(prevSt && prev!==p.pos && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) group.animate([{transform:'translate('+(prevSt.x+18+(others%2)*28)+'px,'+(prevSt.y-18-Math.floor(others/2)*30)+'px) scale(.92)'},{transform:'translate('+x+'px,'+y+'px) scale(1.12)',offset:.65},{transform:'translate('+x+'px,'+y+'px) scale(1)'}],{duration:520,easing:'cubic-bezier(.2,.85,.2,1)'});
    previousPositions.set(p.id,p.pos);
  });

  if (canMove && me) {
    const here = byId.get(me.pos);
    const recommended=s.suggestedRoute?.[1];
    const routeChoices=s.neighbors[me.pos].map(to=>{
      const dst=byId.get(to);return {to,angle:Math.atan2(dst.y-here.y,dst.x-here.x)};
    }).sort((a,b)=>a.angle-b.angle);
    routeChoices.forEach(({to,angle},i)=>{
      const dest=byId.get(to);const edge=s.edges.find(e=>(e.a===me.pos&&e.b===to)||(e.b===me.pos&&e.a===to));
      const visualAngle=routeChoices.length>=4 ? routeChoices[0].angle+(Math.PI*2*i/routeChoices.length) : angle;
      const px=here.x+Math.cos(visualAngle)*48,py=here.y+Math.sin(visualAngle)*48;
      const degrees=angle*180/Math.PI;
      const g=S('g',{class:'direction-choice ' + (to===recommended?'recommended ':'') + edge.mode,role:'button',tabindex:'0', 'aria-label':dest.name+'方向へ移動'});
      g.append(S('circle',{cx:px,cy:py,r:19,class:'direction-hit'}));
      g.append(S('path',{d:'M-15 -12 H3 V-20 L24 0 L3 20 V12 H-15 Z', transform:'translate('+px+' '+py+') rotate('+degrees+') scale(.62)',class:'direction-arrow'}));
      g.append(S('text',{x:px,y:py-22,'text-anchor':'middle',class:'direction-label'},(edge.mode==='air'?'✈ ':edge.mode==='sea'?'⛴ ':'') + dest.name));
      g.addEventListener('click',()=>send('move',{to}));
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();send('move',{to});}});
      svg.append(g);
    });
  }
  renderMiniMap(s,me);
  updateCamera();
  if (selectedStation != null) selectStation(s,selectedStation);
  const current = active ? byId.get(active.pos) : null;
  $('mapNotice').textContent = canMove ? '🚂 残り' + s.pending.remaining + 'マス｜列車の周りの矢印をタップ！' : '📍 現在の手番：' + (active ? active.name + '（' + current.name + '）' : '出発待ち') + '　|　駅を押すと物件を確認できます';
  $('mapNotice').classList.toggle('guiding',canMove);
}
function selectStation(s,index) {
  selectedStation=index; const station=s.stations[index]; if(!station)return;
  const available=station.properties.filter(p=>!s.owners[p.id]);
  const summary=station.type==='city'?`物件 ${station.properties.length}件（購入可 ${available.length}件）｜${station.properties.slice(0,2).map(p=>p.name).join('・')}`:station.type==='event'?'イベントマス：臨時収入や出費が発生':station.type==='card'?'カード駅：カードをランダムに1枚獲得':'カードショップ：役立つカードが買えます';
  $('stationInfo').textContent=`${station.name}｜${summary}`;
}
if ($('roomCode').value && savedName) { ensureIdentity(); connect($('roomCode').value,savedName); }

function renderMiniMap(s,me){
  const minimap=$('miniMap');minimap.replaceChildren();
  const { byId } = displayStations(s.stations);
  minimap.append(S('rect',{x:0,y:0,width:MAP_WIDTH,height:MAP_HEIGHT,fill:'#ccecf0'}));
  for (const [d, fill] of islandPaths()) minimap.append(S('path',{d,fill,stroke:'#94b57f','stroke-width':7,'stroke-linejoin':'round'}));
  for(const e of s.edges){
    const a=byId.get(e.a),b=byId.get(e.b);
    minimap.append(S('path',{d:railPath(a,b),stroke:e.mode==='rail'?'#6fa29b':e.mode==='sea'?'#229bb6':'#ad81d3','stroke-width':e.mode==='rail'?8:5,fill:'none','stroke-linecap':'round','stroke-dasharray':e.mode==='rail'?'':e.mode==='sea'?'22 15':'14 18'}));
  }
  const goal=byId.get(s.destination);if(goal)minimap.append(S('circle',{cx:goal.x,cy:goal.y,r:18,fill:'#ed7452',stroke:'white','stroke-width':8}));
  if(me){const pos=byId.get(me.pos);minimap.append(S('circle',{cx:pos.x,cy:pos.y,r:20,fill:me.color,stroke:'#fff','stroke-width':9}));}
}
