const $ = id => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const fmt = num => Number(num ?? 0).toLocaleString('ja-JP');
const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const S = (tag, attrs = {}, label = '') => { const el = document.createElementNS(svgNS, tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value); if (label) el.textContent = label; return el; };
const face = n => ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][Math.max(0, Math.min(5, n - 1))];
let state = null;
let room = null;
let socket = null;
let token = null;
let playerId = null;
let reconnectTimer = null;
let reconnectCount = 0;
let intentionalClose = false;
let selectedStation = null;
let toastTimer;
let sessionId = 0;
let leaving = false;

const savedName = localStorage.getItem('rail_name') ?? '';
$('playerName').value = savedName;
$('roomCode').value = new URL(location.href).searchParams.get('room')?.toUpperCase() ?? '';
$('roomCode').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6); });

function notify(message) { const t = $('toast'); t.textContent = message; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3400); }
function setConnection(type, text) { $('connection').className = `connection ${type}`; $('connection').innerHTML = `<i></i> ${esc(text)}`; }
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
  localStorage.setItem('rail_name', name);
  return name;
}
function switchToGame() { $('gate').hidden = true; $('game').hidden = false; }
function switchToGate() { $('gate').hidden = false; $('game').hidden = true; state = null; setConnection('', '未接続'); }
async function createRoom() {
  const name = nameInput(); if (!name) return;
  ensureIdentity(); $('createRoom').disabled = true;
  try {
    const resp = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: playerId, token, name, rounds: 6 }) });
    const json = await resp.json();
    if (!resp.ok) throw Error(json.error ?? '部屋を作れませんでした。');
    connect(json.room, name);
  } catch (e) { notify(e.message); }
  finally { $('createRoom').disabled = false; }
}
function joinRoom() {
  const name = nameInput(); if (!name) return;
  const code = $('roomCode').value.toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) { notify('正しい6ケタの部屋コードを入力してください。'); return; }
  ensureIdentity(); connect(code, name);
}
function connect(code, name, isRetry = false) {
  clearTimeout(reconnectTimer);
  if (!isRetry) { ++sessionId; reconnectCount = 0; }
  const currentSession = sessionId;
  intentionalClose = false;
  if (socket) { const old = socket; socket = null; old.onclose = null; old.close(); }
  room = code;
  switchToGame();
  $('roomDisplay').textContent = code;
  const url = new URL(location.href); url.searchParams.set('room', code); history.replaceState(null, '', url);
  setConnection('reconnecting', '接続中…');
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${proto}//${location.host}/api/rooms/${code}/ws?id=${encodeURIComponent(playerId)}&token=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}`;
  const ws = new WebSocket(wsUrl); socket = ws;
  ws.onopen = () => { if (currentSession !== sessionId) return; reconnectCount = 0; setConnection('online', 'オンライン'); };
  ws.onmessage = event => {
    if (currentSession !== sessionId) return;
    if (event.data === 'pong') return;
    let payload; try { payload = JSON.parse(event.data); } catch { return; }
    if (payload.type === 'error') notify(payload.message);
    if (payload.type === 'state') { state = payload.state; if (leaving && !state.players.some(p => p.id === playerId)) { leaving = false; stopConnection(); notify('退出しました。'); return; } render(); }
  };
  ws.onclose = () => {
    if (currentSession !== sessionId || intentionalClose) return;
    if (leaving) { stopConnection(); notify('退出しました。'); return; }
    setConnection('reconnecting', '再接続中…');
    reconnectCount += 1;
    if (!state && reconnectCount >= 3) { notify('部屋がない・満員・参加不可の可能性があります。コードを確認してください。'); switchToGate(); return; }
    const wait = Math.min(12000, 1200 * 2 ** Math.min(4, reconnectCount - 1));
    reconnectTimer = setTimeout(() => connect(code, name, true), wait);
  };
  ws.onerror = () => { /* onclose handles reconnect */ };
}
function send(type, extra = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) { notify('接続が切れています。再接続してください。'); return; }
  socket.send(JSON.stringify({ type, ...extra }));
}
function stopConnection() {
  leaving = false;
  ++sessionId;
  intentionalClose = true;
  clearTimeout(reconnectTimer);
  if (socket) { const old = socket; socket = null; old.onclose = null; old.close(); }
  room = null; const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null, '', url);
  switchToGate();
}
$('createRoom').addEventListener('click', createRoom);
$('joinRoom').addEventListener('click', joinRoom);
$('roomCode').addEventListener('keydown', event => { if (event.key === 'Enter') joinRoom(); });
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
$('game').addEventListener('click', event => {
  const action = event.target.closest('[data-action]');
  const emote = event.target.closest('[data-emote]');
  if (emote) send('emote', { value: emote.dataset.emote });
  if (!action) return;
  switch (action.dataset.action) {
    case 'start': send('start'); break;
    case 'roll': send('roll'); break;
    case 'buy': send('buy'); break;
    case 'skip': send('skip'); break;
    case 'shop': send('shop', { item: action.dataset.item }); break;
    case 'skip_offline': send('skip_offline'); break;
    case 'restart': send('restart'); break;
    case 'remove': send('remove', { playerId: action.dataset.id }); break;
  }
});

function render() {
  if (!state) return;
  const s = state;
  const me = s.players.find(p => p.id === playerId);
  const active = s.players[s.turnIndex];
  const isHost = s.hostId === playerId;
  $('roomDisplay').textContent = room;
  $('roundBadge').textContent = s.status === 'lobby' ? '出発準備中' : s.status === 'finished' ? 'ゲーム終了' : `${s.round} / ${s.rounds}年目`;
  $('destinationName').textContent = s.stations[s.destination]?.name ?? '未定';
  $('playerCount').textContent = `${s.players.length} / 4人`;
  renderMap(s);
  renderActions(s, me, active, isHost);
  renderPlayers(s, active, isHost);
  renderLogs(s);
}
function renderActions(s, me, active, isHost) {
  const el = $('actionContent');
  if (!me) { el.innerHTML = '<h2 class="turn-title">観戦モード</h2>'; return; }
  if (s.status === 'lobby') {
    const everyoneOnline = s.players.every(p => p.online);
    el.innerHTML = `<h2 class="turn-title">🚉 出発までもう少し！</h2><p class="turn-sub">友達に6ケタのコードを送ろう。<br>2〜4人が揃ったらスタート！</p><div class="lobby-code">${esc(room)}</div>${isHost ? `<label for="roundSelect" class="turn-sub">プレイ時間</label><select id="roundSelect" class="select-rounds"><option value="6" ${s.rounds === 6 ? 'selected' : ''}>6年勝負・短め（約10〜15分）</option><option value="10" ${s.rounds === 10 ? 'selected' : ''}>10年勝負・じっくり</option></select><button data-action="start" class="move-btn" ${s.players.length < 2 || !everyoneOnline ? 'disabled' : ''}>🚄 全員で出発する！</button>` : `<p class="turn-sub">ホストの出発を待っています ☕</p>`}<p class="turn-sub">現在 ${s.players.length}人が参加中${everyoneOnline ? '' : '（未接続の人がいます）'}</p>`;
    $('roundSelect')?.addEventListener('change', event => send('rounds', { value: Number(event.target.value) }));
    return;
  }
  if (s.status === 'finished') {
    const winner = [...s.players].sort((a, b) => b.worth - a.worth)[0];
    el.innerHTML = `<h2 class="turn-title">🏆 ${esc(winner.name)}さんの優勝！</h2><p class="turn-sub">最終総資産 <strong class="turn-highlight">${fmt(winner.worth)}万円</strong><br>お疲れさまでした！</p>${isHost ? '<button data-action="restart" class="move-btn">🔁 もう一度遊ぶ</button>' : '<p class="turn-sub">ホストが再戦の準備をするのを待っています。</p>'}`;
    return;
  }
  const isMyTurn = active?.id === playerId;
  if (!isMyTurn) {
    el.innerHTML = `<h2 class="turn-title">${esc(active?.name)}さんの番！</h2><p class="turn-sub">次の一手を待っています。<br>いまは自分の資産をチェックしよう。</p><div class="dice-face">${s.lastRoll ? face(s.lastRoll.die) : '🎲'}</div>${active && !active.online ? '<button data-action="skip_offline" class="outline-btn" style="width:100%">📡 オフラインの人をスキップ</button>' : ''}`;
    return;
  }
  if (s.phase === 'roll') {
    el.innerHTML = `<h2 class="turn-title">✨ あなたの番です！</h2><p class="turn-sub">サイコロを振って次の駅へ。目的地に一番乗りしよう！${me.express ? '<br>🚄 特急きっぷで +2 マス！' : ''}</p><div class="dice-face">🎲</div><button data-action="roll" class="move-btn">🎲 サイコロを振る！</button><p class="turn-sub" style="margin-bottom:0">所持金 ${fmt(me.money)}万円 · 🚄 ${me.express} · 🛡️ ${me.shield}</p>`;
    return;
  }
  const pending = s.pending;
  if (pending?.type === 'city') {
    const station = s.stations[pending.index];
    el.innerHTML = `<h2 class="turn-title">🏠 物件を買いますか？</h2><p class="turn-sub">${esc(station.name)}に到着しました！ 物件を買うと年末に10%の収益が入ります。</p><div class="choice-card"><strong>📍 ${esc(station.name)}エリア</strong><small>購入価格 ${fmt(station.price)}万円 / 年間収益 ${fmt(Math.round(station.price * .1))}万円</small></div><div class="action-buttons"><button data-action="buy" class="move-btn">💰 ${fmt(station.price)}万円で購入</button><button data-action="skip" class="outline-btn">今回は見送る</button></div>`;
  } else if (pending?.type === 'shop') {
    const shop = s.shopItems;
    el.innerHTML = `<h2 class="turn-title">🛒 駅のショップ</h2><p class="turn-sub">旅に役立つアイテムを買おう！<br>所持金 ${fmt(me.money)}万円</p><div class="shop-row"><button class="shop-btn" data-action="shop" data-item="express" ${me.money < shop.express.price || me.express >= 3 ? 'disabled' : ''}>🚄 特急きっぷ<small>次のサイコロ +2<br>${fmt(shop.express.price)}万円</small></button><button class="shop-btn" data-action="shop" data-item="shield" ${me.money < shop.shield.price || me.shield >= 3 ? 'disabled' : ''}>🛡️ おまもり<small>次の損失イベント無効<br>${fmt(shop.shield.price)}万円</small></button></div><button data-action="skip" class="outline-btn" style="width:100%">何も買わない</button>`;
  }
}
function renderPlayers(s, active, isHost) {
  const ranking = [...s.players].sort((a, b) => b.worth - a.worth);
  $('playersList').innerHTML = ranking.map((p, i) => `<div class="player-line ${p.id === active?.id && s.status === 'playing' ? 'active' : ''}"><div class="player-rank">${i + 1}</div><div class="player-avatar" style="background:${p.color}">${esc(p.name.slice(0, 1))}</div><div class="player-text"><div class="player-name">${esc(p.name)}${p.id === playerId ? ' (自分)' : ''}${p.id === s.hostId ? ' 👑' : ''}</div><div class="player-details"><span class="${p.online ? 'online-icon' : 'offline-icon'}">●</span> ${esc(s.stations[p.pos]?.name)} · 物件 ${p.propertyCount}件 · 現金 ${fmt(p.money)}万</div></div><div class="player-money">${fmt(p.worth)}<small>万</small></div>${isHost && s.status === 'lobby' && !p.online && p.id !== playerId ? `<button data-action="remove" data-id="${esc(p.id)}" class="outline-btn" title="未接続のプレイヤーを削除">×</button>` : ''}</div>`).join('');
}
function renderLogs(s) { $('logsList').innerHTML = s.logs.slice(0, 17).map(e => `<div class="log-item">${esc(e.text)}</div>`).join(''); }
function renderMap(s) {
  const svg = $('railMap');
  svg.replaceChildren();
  // Draw simple infographic geography, avoiding external images and reducing cellular data usage.
  const defs = S('defs');
  const gradient = S('linearGradient', { id: 'seaTint', x1: '0', x2: '1', y1: '0', y2: '1' });
  gradient.append(S('stop', { offset: '0%', 'stop-color': '#f6faff' }), S('stop', { offset: '100%', 'stop-color': '#e7effa' }));
  defs.append(gradient); svg.append(defs);
  svg.append(S('rect', { x: 0, y: 0, width: 1000, height: 720, fill: 'url(#seaTint)' }));
  const bg = S('g', { opacity: '.55' });
  for (let x = 40; x < 1000; x += 60) bg.append(S('line', { x1: x, x2: x, y1: 0, y2: 720, stroke: '#c7d8ea', 'stroke-width': 1, 'stroke-dasharray': '2 12' }));
  for (let y = 30; y < 720; y += 60) bg.append(S('line', { x1: 0, x2: 1000, y1: y, y2: y, stroke: '#c7d8ea', 'stroke-width': 1, 'stroke-dasharray': '2 12' }));
  svg.append(bg);
  svg.append(S('text', { x: 460, y: 530, class: 'map-watermark', 'text-anchor': 'middle' }, 'JAPAN'));
  for (const [x, y, label] of [[85, 88, 'KYUSHU'], [340, 195, 'SHIKOKU'], [450, 475, 'HONSHU'], [833, 82, 'HOKKAIDO']]) svg.append(S('text', { x, y, class: 'map-area-name' }, label));
  const coordinates = s.stations.map(st => [st.x * 10, st.y * 7.2]);
  const trackPoints = [...coordinates, coordinates[0]].map(p => p.join(',')).join(' ');
  for (const cls of ['track-shadow', 'track-line', 'track-rail']) svg.append(S('polyline', { points: trackPoints, class: cls }));
  s.stations.forEach((st, i) => {
    const [x, y] = coordinates[i];
    const isGoal = i === s.destination;
    const color = st.type === 'city' ? '#4d94e6' : st.type === 'event' ? '#f5b64b' : '#9d78e1';
    const owner = s.players.find(p => p.id === s.owners[i]);
    const grp = S('g', { class: `station-marker${isGoal ? ' current-destination' : ''}`, role: 'button', tabindex: 0, 'aria-label': `${st.name}${st.price ? ' 物件' : ''}` });
    if (isGoal) grp.append(S('circle', { cx: x, cy: y, r: 25, class: 'goal-pulse' }));
    grp.append(S('circle', { cx: x, cy: y, r: 16, fill: owner?.color || color, class: 'station-outer' }));
    if (st.type === 'event') grp.append(S('text', { x, y: y + 6, 'font-size': 15, fill: '#fff', 'text-anchor': 'middle', 'font-weight': 900, 'pointer-events': 'none' }, '!'));
    if (st.type === 'shop') grp.append(S('text', { x, y: y + 5, 'font-size': 14, fill: '#fff', 'text-anchor': 'middle', 'pointer-events': 'none' }, '★'));
    const above = y > 250 && (i % 3 !== 0 || y > 400);
    grp.append(S('text', { x, y: y + (above ? -27 : 37), class: 'station-label' }, `${isGoal ? '🎯 ' : ''}${st.name}`));
    grp.addEventListener('click', () => selectStation(s, i));
    grp.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectStation(s, i); } });
    svg.append(grp);
  });
  for (const [i, p] of s.players.entries()) {
    const [x, y] = coordinates[p.pos];
    const occupants = s.players.slice(0, i).filter(t => t.pos === p.pos).length;
    const group = S('g', { class: `token${p.id === playerId ? ' me' : ''}`, transform: `translate(${x + 19 + (occupants % 2) * 29},${y - 19 - Math.floor(occupants / 2) * 29})` });
    group.append(S('circle', { cx: 0, cy: 0, r: 18, fill: p.color }));
    group.append(S('text', { x: 0, y: 1 }, p.name.slice(0, 1)));
    svg.append(group);
  }
  if (selectedStation != null) selectStation(s, selectedStation);
}
function selectStation(s, index) {
  selectedStation = index;
  const st = s.stations[index];
  if (!st) return;
  const owner = s.players.find(p => p.id === s.owners[index]);
  $('stationInfo').textContent = `${st.name} · ${st.type === 'city' ? `${fmt(st.price)}万円${owner ? `（${owner.name}の物件）` : '（購入可能）'}` : st.type === 'event' ? 'イベントマス 🎁' : 'アイテムショップ 🛒'}`;
}

// Opening an invite link can reconnect to a previously joined room on the same device.
if ($('roomCode').value && savedName) { ensureIdentity(); connect($('roomCode').value, savedName); }
