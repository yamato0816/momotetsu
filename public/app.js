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
const face = n => ['⚀','⚁','⚂','⚃','⚄','⚅'][Math.max(0,Math.min(5,n - 1))];
let state = null, room = null, socket = null, token = null, playerId = null;
let reconnectTimer, reconnectCount = 0, intentionalClose = false, selectedStation = null, toastTimer;
let sessionId = 0, leaving = false, zoom = 1, centeredRoom = null, momentTimer;
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
  const st=state.stations[me?.pos];if(!st)return;
  camera={x:st.x,y:st.y};
  updateCamera(true);
}
function updateCamera(immediate=false) {
  if(!state)return;
  const svg=$('railMap');
  const me=state.players.find(p=>p.id===playerId) ?? state.players[state.turnIndex];
  const st=state.stations[me?.pos];if(!st)return;
  if(overview){svg.setAttribute('viewBox','0 0 1200 850');return;}
  const box=svg.getBoundingClientRect();
  const ratio=Math.max(.7,box.width/Math.max(1,box.height));
  const h=420/zoom, w=h*ratio;
  const x=Math.max(0,Math.min(1200-w,(camera?.x??st.x)-w/2));
  const y=Math.max(0,Math.min(850-h,(camera?.y??st.y)-h/2));
  svg.setAttribute('viewBox',`${x} ${y} ${w} ${h}`);
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
      <div class="money-meta"><span>総資産 <b>${money(p.worth)}</b></span><span>物件 <b>${p.propertyCount}件</b></span></div>
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
  const defs = S('defs');
  const sea = S('linearGradient', { id:'seaTint', x1:'0',y1:'0',x2:'1',y2:'1' });
  sea.append(S('stop',{offset:'0%','stop-color':'#cceaf3'}),S('stop',{offset:'100%','stop-color':'#8dc7df'}));
  const land = S('linearGradient', { id:'landTint', x1:'0',y1:'0',x2:'1',y2:'1' });
  land.append(S('stop',{offset:'0%','stop-color':'#ebf4dd'}),S('stop',{offset:'100%','stop-color':'#bcd99e'}));
  defs.append(sea,land); svg.append(defs);
  svg.append(S('rect',{x:0,y:0,width:1200,height:850,fill:'url(#seaTint)'}));
  const grid = S('g',{opacity:'.16'});
  for(let x=0;x<=1200;x+=50)grid.append(S('path',{d:`M${x} 0V850`,stroke:'#fff','stroke-width':1}));
  for(let y=0;y<=850;y+=50)grid.append(S('path',{d:`M0 ${y}H1200`,stroke:'#fff','stroke-width':1}));
  svg.append(grid);
  // Decorative simplified land contours: original schematic, not a geographic survey map.
  const islands = [
    'M 76,814 L 33,776 L 30,695 L 75,642 L 149,630 L 209,659 L 224,719 L 197,820 Z',
    'M 155,609 L 226,577 L 327,599 L 416,623 L 481,643 L 523,605 L 570,612 L 635,621 L 681,646 L 738,622 L 785,639 L 836,669 L 915,649 L 954,608 L 958,561 L 941,523 L 956,449 L 938,414 L 944,369 L 914,343 L 931,274 L 897,268 L 854,283 L 815,324 L 813,392 L 761,433 L 728,479 L 651,480 L 611,505 L 568,559 L 494,572 L 419,584 L 338,576 L 252,576 L 182,589 Z',
    'M 270,798 L 257,758 L 295,724 L 379,712 L 426,748 L 409,811 L 319,824 Z',
    'M 979,216 L 978,181 L 1019,147 L 1011,92 L 1051,53 L 1115,80 L 1160,108 L 1139,162 L 1094,199 L 1040,217 Z',
  ];
  for(const d of islands)svg.append(S('path',{d,fill:'url(#landTint)',stroke:'#9aba86','stroke-width':3,'stroke-linejoin':'round',opacity:'.84'}));
  for (const [x,y,r] of [[1090,250,17],[704,572,17],[536,536,20],[842,349,17],[159,769,13],[469,746,15]]) {
    svg.append(S('circle',{cx:x,cy:y,r,fill:'#fff',opacity:'.16'}));
    svg.append(S('text',{x,y:y+5,'text-anchor':'middle',class:'map-decoration'},'✿'));
  }
  for (const [x,y,name] of [[1025,273,'北海道'],[854,345,'東北'],[966,715,'関東'],[690,578,'中部'],[473,586,'近畿'],[242,562,'中国'],[320,830,'四国'],[75,605,'九州']])
    svg.append(S('text',{x,y,class:'map-area-name','text-anchor':'middle'},name));
  // Rails: shadow, ties, and animated main line, each edge rendered once.
  const rails = S('g',{class:'rail-layer'});
  for (const {a,b,mode} of s.edges) {
    const start=s.stations[a],end=s.stations[b];
    const d=`M${start.x} ${start.y} L${end.x} ${end.y}`;
    if(mode==='rail'){
      rails.append(S('path',{d,class:'rail-shadow'}));
      rails.append(S('path',{d,class:'rail-base'}));
      rails.append(S('path',{d,class:'rail-ties'}));
    } else rails.append(S('path',{d,class:`transport-line ${mode}`}));
  }
  svg.append(rails);
  if (s.status==='playing' && s.suggestedRoute?.length>1) {
    const pts=s.suggestedRoute.map(i=>`${s.stations[i].x},${s.stations[i].y}`).join(' ');
    svg.append(S('polyline',{points:pts,class:'suggested-track'}));
  }
  const canMove = s.phase==='move' && active?.id===playerId;
  const accessible = new Set(canMove ? s.neighbors[me.pos] : []);
  for (const station of s.stations) {
    const {x,y,id,name,type}=station;
    const isGoal=id===s.destination, reachable=accessible.has(id);
    const owned=station.properties.filter(p=>s.owners[p.id]);
    const owners=[...new Set(owned.map(p=>s.owners[p.id]))];
    const isFullyOwned=station.properties.length>0 && owned.length===station.properties.length;
    const owner=owners.length===1 ? s.players.find(p=>p.id===owners[0]) : null;
    const group=S('g',{class:`station-marker ${type} ${isGoal?'is-goal':''} ${reachable?'reachable':''}`,tabindex:0,role:'button','aria-label':`${name}${reachable?'、ここへ移動可能':''}`});
    if(isGoal)group.append(S('circle',{cx:x,cy:y,r:28,class:'goal-pulse'}));
    if(reachable)group.append(S('circle',{cx:x,cy:y,r:27,class:'reach-ring'}));
    group.append(S('circle',{cx:x,cy:y,r:17,fill:owner?.color || (type==='city'?'#3979c5':type==='event'?'#ef745c':type==='card'?'#ecb94a':'#9a6bd1'),class:'station-outer'}));
    group.append(S('circle',{cx:x,cy:y,r:9,fill:'#fff',opacity:'.95'}));
    group.append(S('text',{x,y:y+5,class:'station-symbol'},type==='city'?'¥':type==='event'?'!':type==='card'?'C':'★'));
    const yOffset= id%2===0?-28:37;
    const label=S('text',{x,y:y+yOffset,class:`station-label ${reachable?'can-go':''}`,'text-anchor':'middle'},name);
    group.append(label);
    if(isGoal)group.append(S('text',{x,y:y-43,class:'goal-flag','text-anchor':'middle'},'🚩'));
    if(name.includes('キャンパス'))group.append(S('text',{x:x+24,y:y-15,class:'campus-marker'},'🎓'));
    if(isFullyOwned && owner)group.append(S('text',{x:x+18,y:y-11,class:'owner-flag','text-anchor':'middle'},'★'));
    group.addEventListener('click',()=>selectStation(s,id));
    group.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault(); selectStation(s,id);} });
    svg.append(group);
  }
  s.players.forEach((p,i)=>{
    const station=s.stations[p.pos];
    const others=s.players.slice(0,i).filter(o=>o.pos===p.pos).length;
    const x=station.x+23+(others%2)*38,y=station.y-23-Math.floor(others/2)*37;
    const group=S('g',{class:`token ${p.id===playerId?'me':''}`,transform:`translate(${x},${y})`});
    group.append(S('rect',{x:-21,y:-20,width:42,height:39,rx:13,fill:p.color,class:'train-token'}));
    group.append(S('text',{x:0,y:4,'text-anchor':'middle',class:'train-symbol'},'🚂'));
    group.append(S('text',{x:0,y:31,'text-anchor':'middle',class:'token-name'},p.name.slice(0,4)));
    if(s.poorGodId===p.id)group.append(S('text',{x:24,y:-24,class:'poor-token'},'👻'));
    svg.append(group);
    const prev=previousPositions.get(p.id);
    if(prev!=null && prev!==p.pos && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const start=s.stations[prev];
      if(start)group.animate([{transform:`translate(${start.x+23+(others%2)*38}px, ${start.y-23-Math.floor(others/2)*37}px) scale(.92)`},{transform:`translate(${x}px, ${y}px) scale(1.13)`,offset:.65},{transform:`translate(${x}px, ${y}px) scale(1)`}],{duration:550,easing:'cubic-bezier(.2,.85,.2,1)'});
    }
    previousPositions.set(p.id,p.pos);
  });
  if(canMove && me){
    const here=s.stations[me.pos];
    const recommended=s.suggestedRoute?.[1];
    s.neighbors[me.pos].forEach((to,i)=>{
      const dest=s.stations[to];const edge=s.edges.find(e=>(e.a===me.pos&&e.b===to)||(e.b===me.pos&&e.a===to));
      const dx=dest.x-here.x,dy=dest.y-here.y;
      const len=Math.hypot(dx,dy)||1;
      const dX=dx/len,dY=dy/len;
      const px=here.x+dX*63,py=here.y+dY*63;
      const angle=Math.atan2(dy,dx)*180/Math.PI;
      const g=S('g',{class:`direction-choice ${to===recommended?'recommended':''} ${edge.mode}`,role:'button',tabindex:'0', 'aria-label':`${dest.name}方向へ移動`});
      g.append(S('circle',{cx:px,cy:py,r:30,class:'direction-hit'}));
      g.append(S('g',{transform:`translate(${px} ${py}) rotate(${angle})`,'pointer-events':'none'}));
      const arrow=S('path',{d:`M-17 -14 H4 V-24 L29 0 L4 24 V14 H-17 Z`, transform:`translate(${px} ${py}) rotate(${angle})`,class:'direction-arrow'});
      g.append(arrow);
      g.append(S('text',{x:px,y:py-32,'text-anchor':'middle',class:'direction-label'},`${edge.mode==='air'?'✈ ':edge.mode==='sea'?'⛴ ':''}${dest.name}`));
      g.addEventListener('click',()=>send('move',{to}));
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();send('move',{to});}});
      svg.append(g);
    });
  }
  renderMiniMap(s,me);
  updateCamera();
  if (selectedStation != null) selectStation(s,selectedStation);
  const current=s.stations[active?.pos];
  $('mapNotice').textContent = canMove ? `🚂 残り${s.pending.remaining}マス｜黄色い駅を選んで進もう！` : `📍 現在の手番：${active ? `${active.name}（${current.name}）` : '出発待ち'}　|　駅を押すと物件を確認できます`;
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
  for(const e of s.edges){
    const a=s.stations[e.a],b=s.stations[e.b];
    minimap.append(S('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:e.mode==='rail'?'#7db4b1':e.mode==='sea'?'#229bb6':'#ad81d3','stroke-width':e.mode==='rail'?3:2}));
  }
  const goal=s.stations[s.destination];if(goal)minimap.append(S('circle',{cx:goal.x,cy:goal.y,r:18,fill:'#ed7452',stroke:'white','stroke-width':5}));
  if(me){const pos=s.stations[me.pos];minimap.append(S('circle',{cx:pos.x,cy:pos.y,r:20,fill:me.color,stroke:'#fff','stroke-width':7}));}
}
