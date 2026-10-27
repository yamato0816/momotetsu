import { DurableObject } from 'cloudflare:workers';
import { applyAction, joinGame, newGame, publicState, upgradeGame } from './game.js';

const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const ID = /^[a-f0-9-]{30,50}$/i;
const TOKEN = /^[a-f0-9-]{30,50}$/i;
const NAME = /^[^\u0000-\u001f\u007f<>]{1,14}$/u;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const createCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), n => alphabet[n % alphabet.length]).join('');
const validPlayer = p => p && ID.test(p.id ?? '') && TOKEN.test(p.token ?? '') && NAME.test((p.name ?? '').trim());

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ ok: true, service: 'railtrip' });
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return json({ error: '別サイトからは作成できません。' }, 403);
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSONが不正です。' }, 400); }
      if (!validPlayer(body)) return json({ error: '名前または端末情報が不正です。' }, 400);
      for (let tries = 0; tries < 5; tries++) {
        const room = createCode();
        const stub = env.ROOMS.getByName(room);
        const response = await stub.fetch('https://room.internal/init', { method: 'POST', body: JSON.stringify({ ...body, name: body.name.trim() }) });
        if (response.status === 409) continue;
        if (!response.ok) return json({ error: '部屋の作成に失敗しました。' }, 500);
        return json({ room }, 201);
      }
      return json({ error: '部屋の作成をやり直してください。' }, 503);
    }
    const match = url.pathname.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})\/ws$/);
    if (match) {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'WebSocket接続が必要です。' }, 426);
      if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({ error: '接続元が不正です。' }, 403);
      return env.ROOMS.getByName(match[1]).fetch(request);
    }
    if (url.pathname.startsWith('/api/')) return json({ error: '見つかりません。' }, 404);
    return env.ASSETS.fetch(request);
  },
};

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.lastEmotes = new Map();
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  connected() {
    return [...new Set(this.ctx.getWebSockets().map(ws => ws.deserializeAttachment()?.id).filter(Boolean))];
  }

  broadcast(g) {
    const snapshot = JSON.stringify({ type: 'state', state: publicState(g, this.connected()) });
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(snapshot); } catch { /* disconnected mid-broadcast */ }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!validPlayer(body)) return json({ error: 'Invalid player' }, 400);
      return this.ctx.blockConcurrencyWhile(async () => {
        if (await this.ctx.storage.get('game')) return json({ error: 'Already exists' }, 409);
        await this.ctx.storage.put('game', newGame({ ...body, name: body.name.trim() }));
        return json({ ok: true }, 201);
      });
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'Upgrade required' }, 426);
    const input = { id: url.searchParams.get('id'), token: url.searchParams.get('token'), name: url.searchParams.get('name')?.trim() };
    if (!validPlayer(input)) return json({ error: 'Invalid player' }, 400);
    return this.ctx.blockConcurrencyWhile(async () => {
      let game = await this.ctx.storage.get('game');
      if (!game) return json({ error: '部屋が見つかりません。' }, 404);
      if (game.version !== 3) { game = upgradeGame(game); await this.ctx.storage.put('game', game); }
      let joined;
      try { joined = joinGame(game, input); } catch (e) { return json({ error: e.message }, 409); }
      if (joined.players.length !== game.players.length) await this.ctx.storage.put('game', joined);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.serializeAttachment({ id: input.id });
      this.ctx.acceptWebSocket(server);
      this.broadcast(joined);
      return new Response(null, { status: 101, webSocket: client });
    });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > 1024) return;
    let action;
    try { action = JSON.parse(message); } catch { return; }
    const actorId = ws.deserializeAttachment()?.id;
    if (!actorId) return;
    try {
      await this.ctx.blockConcurrencyWhile(async () => {
        let g = await this.ctx.storage.get('game');
        if (g && g.version !== 3) { g = upgradeGame(g); await this.ctx.storage.put('game', g); }
        if (!g || !g.players.some(p => p.id === actorId)) throw Error('参加者ではありません。');
        if (action.type === 'emote') {
          const now = Date.now();
          if (now - (this.lastEmotes.get(actorId) ?? 0) < 1800) return;
          this.lastEmotes.set(actorId, now);
        }
        const next = applyAction(g, actorId, action, { connected: this.connected() });
        await this.ctx.storage.put('game', next);
        this.broadcast(next);
        if (action.type === 'remove' && action.playerId === actorId) {
          for (const socket of this.ctx.getWebSockets()) if (socket.deserializeAttachment()?.id === actorId) socket.close(1000, 'Left room');
        }
      });
    } catch (e) {
      try { ws.send(JSON.stringify({ type: 'error', message: e.message || '操作に失敗しました。' })); } catch { /* ignored */ }
    }
  }

  async webSocketClose(ws) {
    try { ws.close(1000, 'Goodbye'); } catch { /* already closed */ }
    const g = await this.ctx.storage.get('game');
    if (g) this.broadcast(g);
  }

  async webSocketError(ws) {
    try { ws.close(1011, 'Connection error'); } catch { /* ignored */ }
    const g = await this.ctx.storage.get('game');
    if (g) this.broadcast(g);
  }
}
