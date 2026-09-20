// 欲罷不能 線上對戰後端：/api/room?code=1234 走 WebSocket，其餘交給靜態資產。
// 每個房號一個 Durable Object（Room）。設計重點：
//   1. 骰子一律由伺服器擲（crypto 亂數），兩邊玩家都改不了、也看不到下一擲 —— 公平性不靠客戶端自律
//   2. 事件溯源：伺服器只保存有序事件紀錄（dice / pick / stop），兩邊用同一套 Rules 依序套用；
//      斷線重連時把整份紀錄補給對方重播即可，伺服器不必懂遊戲規則
import { DurableObject } from 'cloudflare:workers';

const IDLE_MS = 2 * 60 * 60 * 1000;          // 房間閒置 2 小時後清空
const MAX_LOG = 4000;                         // 一局不可能超過的事件數，防灌爆

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return Response.json({ ok: true });
    if (url.pathname === '/api/room') {
      const code = url.searchParams.get('code') || '';
      if (!/^\d{4}$/.test(code)) return new Response('bad room code', { status: 400 });
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(req);
    }
    return env.ASSETS.fetch(req);
  }
};

export class Room extends DurableObject {
  async load() {
    if (!this.meta) this.meta = (await this.ctx.storage.get('meta')) || null;
    if (!this.log) this.log = (await this.ctx.storage.get('log')) || [];
  }
  async save() { await this.ctx.storage.put({ meta: this.meta, log: this.log }); await this.ctx.storage.setAlarm(Date.now() + IDLE_MS); }
  async alarm() { await this.ctx.storage.deleteAll(); this.meta = null; this.log = []; for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'room expired'); }

  present(except) { const p = [false, false]; for (const ws of this.ctx.getWebSockets()) { if (ws === except) continue; const a = ws.deserializeAttachment(); if (a) p[a.seat] = true; } return p; }
  cast(msg) { const s = JSON.stringify(msg); for (const ws of this.ctx.getWebSockets()) { try { ws.send(s); } catch (e) {} } }

  async fetch(req) {
    await this.load();
    const q = new URL(req.url).searchParams, action = q.get('action'), token = q.get('token') || '';
    const refuse = why => { const [c, s] = Object.values(new WebSocketPair()); s.accept(); s.send(JSON.stringify({ t: 'refuse', why })); s.close(1000, why); return new Response(null, { status: 101, webSocket: c }); };

    let seat = -1;
    if (action === 'create') {
      if (this.meta && this.present().some(Boolean)) return refuse('taken');          // 房號有人在用 → 客戶端換一個號碼再試
      this.meta = { tokens: [crypto.randomUUID(), null], started: false }; this.log = []; seat = 0;
    } else if (action === 'join') {
      if (!this.meta) return refuse('noroom');
      if (token && this.meta.tokens.includes(token)) seat = this.meta.tokens.indexOf(token);   // 斷線重連：憑 token 回到原座位
      else if (!this.meta.tokens[1]) { this.meta.tokens[1] = crypto.randomUUID(); seat = 1; }
      else return refuse('full');
    } else return refuse('badaction');

    for (const old of this.ctx.getWebSockets()) { const a = old.deserializeAttachment(); if (a && a.seat === seat) old.close(1000, 'replaced'); }   // 同座位只留最新連線
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server); server.serializeAttachment({ seat });
    const present = this.present(); present[seat] = true;
    const begin = !this.meta.started && present[0] && present[1];
    if (begin) this.meta.started = true;
    await this.save();
    server.send(JSON.stringify({ t: 'sync', seat, token: this.meta.tokens[seat], started: this.meta.started, log: this.log, present }));
    this.cast({ t: 'presence', present });
    if (begin) this.cast({ t: 'start' });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 200) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    await this.load();
    const a = ws.deserializeAttachment(); if (!a || !this.meta) return;
    const p = a.seat; let ev = null;
    if (m.t === 'ping') { ws.send('{"t":"pong"}'); return; }
    if (!this.meta.started || this.log.length >= MAX_LOG) return;
    if (m.t === 'roll') { const b = new Uint8Array(4); let dice = []; while (dice.length < 4) { crypto.getRandomValues(b); for (const x of b) if (x < 252 && dice.length < 4) dice.push(1 + x % 6); } ev = { t: 'dice', p, dice }; }   // x<252：去掉取模偏差
    else if (m.t === 'pick' && Number.isInteger(m.i) && Number.isInteger(m.k) && m.i >= 0 && m.i < 3 && m.k >= 0 && m.k < 2) ev = { t: 'pick', p, i: m.i, k: m.k };
    else if (m.t === 'stop') ev = { t: 'stop', p };
    else if (m.t === 'again') { this.log = []; await this.save(); this.cast({ t: 'start' }); return; }
    if (!ev) return;
    ev.n = this.log.length; this.log.push(ev); await this.save(); this.cast(ev);
  }
  async webSocketClose(ws) { try { ws.close(); } catch (e) {} this.cast({ t: 'presence', present: this.present(ws) }); }
  async webSocketError(ws) { this.cast({ t: 'presence', present: this.present(ws) }); }
}
