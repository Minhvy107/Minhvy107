// 🎪 Chơi chung thời gian thực (Durable Objects + WebSocket).
// Lobby: 1 đối tượng duy nhất giữ danh sách phòng. Room: mỗi phòng 1 đối tượng, giữ ván chơi & kết nối.
// Mọi người cược với NHÀ CÁI (game), không ai ăn tiền của người khác. Tiền cược là tiền trong game, máy chủ chỉ tính kết quả.
import { MIL_Q } from './milq.js';

export const GAMES = {
  bc: { name: 'Bầu cua', max: 8 },
  xd: { name: 'Xì dách', max: 5 },
  mil: { name: 'Triệu phú đối kháng', max: 4 },
  soi: { name: 'Ma sói', max: 10 },
  uno: { name: 'Bài Một Lá', max: 6 },
  boom: { name: 'Mèo Nổ', max: 5 },
};
const MAX_BET = 5e6;
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const CODE_A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 4 }, () => CODE_A[rnd(32)]).join('');
const jres = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', ...h } });

// ---------- Lọc chat tự do: từ tục, link, số điện thoại ----------
const BAD = ['đụ', 'địt', 'đĩ', 'lồn', 'buồi', 'cặc', 'đéo', 'đm', 'dm', 'dcm', 'đcm', 'vcl', 'vkl', 'clm', 'cl', 'vl', 'đmm', 'dmm', 'cc', 'cmm', 'óc chó', 'ngu như', 'fuck', 'shit', 'bitch', 'đĩ mẹ', 'mẹ mày', 'con mẹ'];
const norm = s => s.toLowerCase().normalize('NFC');
export function cleanChat(text) {
  let t = String(text || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 120);
  if (!t) return '';
  const flat = norm(t).replace(/[\s._\-*]+/g, '');
  if (/(https?:|www\.|\.com|\.vn|\.net|t\.me|zalo|facebook|fb\.|tele|@\w{3,})/i.test(t) || /\d[\d\s.\-]{7,}\d/.test(t)) return '🚫 (tin nhắn chứa link hoặc số điện thoại đã bị ẩn)';
  for (const w of BAD) {
    const re = new RegExp(`(^|[^\\p{L}])(${w.replace(/\s+/g, '\\s*')})(?=$|[^\\p{L}])`, 'giu');
    t = t.replace(re, (m, a, b) => a + '*'.repeat(b.length));
  }
  if (/(^|[^a-z])(dit|dcm|dmm|vcl|vkl|clgt)([^a-z]|$)/.test(norm(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd'))) t = t.replace(/\S+/g, w => /(dit|dcm|dmm|vcl|vkl|clgt)/i.test(w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')) ? '*'.repeat(w.length) : w);
  return t;
}

// ---------- Lobby ----------
export class Lobby {
  constructor(state, env) { this.state = state; this.rooms = new Map(); }
  async fetch(req) {
    const url = new URL(req.url), p = url.pathname;
    const now = Date.now();
    for (const [c, r] of this.rooms) if (now - r.ts > 90e3 || (r.n === 0 && now - r.ts > 20e3)) this.rooms.delete(c);
    if (p === '/upd') { const b = await req.json(); if (b.n <= 0 && b.gone) this.rooms.delete(b.code); else this.rooms.set(b.code, { ...(this.rooms.get(b.code) || {}), ...b, ts: now }); return jres({ ok: true }); }
    if (p === '/new') { const b = await req.json(); let code; do code = newCode(); while (this.rooms.has(code)); this.rooms.set(code, { code, g: b.g, n: 0, max: GAMES[b.g].max, priv: !!b.priv, host: String(b.name || '').slice(0, 20), ts: now, open: true }); return jres({ code }); }
    if (p === '/quick') { const g = url.searchParams.get('g');
      const r = [...this.rooms.values()].filter(r => r.g === g && !r.priv && r.open !== false && r.n < r.max).sort((a, b) => b.n - a.n)[0];
      if (r) return jres({ code: r.code });
      let code; do code = newCode(); while (this.rooms.has(code)); this.rooms.set(code, { code, g, n: 0, max: GAMES[g].max, priv: false, host: '', ts: now, open: true }); return jres({ code }); }
    if (p === '/list') { const g = url.searchParams.get('g');
      const list = [...this.rooms.values()].filter(r => (!g || r.g === g) && !r.priv && r.n > 0).sort((a, b) => b.n - a.n).slice(0, 30);
      const online = [...this.rooms.values()].reduce((a, r) => a + r.n, 0);
      return jres({ list, online, rooms: this.rooms.size }); }
    if (p === '/has') { const c = url.searchParams.get('code'); const r = this.rooms.get(c); return jres(r ? { ok: true, g: r.g } : { ok: false }); }
    return jres({ error: 'nf' }, 404);
  }
}

// ---------- Room ----------
export class Room {
  constructor(state, env) { this.state = state; this.env = env; this.conns = new Map(); this.g = null; this.code = null; this.G = null; this.timers = []; this.lastLobby = 0; }
  lobby(body) { const id = this.env.LOBBY.idFromName('main'); return this.env.LOBBY.get(id).fetch('https://lobby/upd', { method: 'POST', body: JSON.stringify(body) }).catch(() => {}); }
  players() { return [...this.conns.values()].filter(c => c.p); }
  syncLobby(force) { const n = this.players().length; if (!force && Date.now() - this.lastLobby < 5000) return; this.lastLobby = Date.now();
    this.lobby({ code: this.code, g: this.g, n, max: GAMES[this.g].max, open: this.G ? this.G.open !== false : true, gone: n === 0 }); }
  later(ms, fn) { ms *= +(this.env.DEV_SPEED || 1); const t = setTimeout(() => { this.timers = this.timers.filter(x => x !== t); try { fn(); } catch (e) { } }, ms); this.timers.push(t); return t; }
  clear() { this.timers.forEach(clearTimeout); this.timers = []; }
  send(ws, m) { try { ws.send(JSON.stringify(m)); } catch (e) { } }
  bcast(m, except) { const s = JSON.stringify(m); for (const [ws, c] of this.conns) if (c.p && ws !== except) { try { ws.send(s); } catch (e) { } } }
  pub(c) { return { id: c.p.id, name: c.p.name, look: c.p.look, bot: !!c.p.bot }; }
  push() { if (!this.G) return; for (const [ws, c] of this.conns) if (c.p) this.send(ws, { t: 'state', s: this.G.view(c.p.id) }); }
  async fetch(req) {
    const url = new URL(req.url);
    if (req.headers.get('Upgrade') !== 'websocket') return jres({ error: 'ws' }, 426);
    this.code = url.searchParams.get('code'); const g = url.searchParams.get('g');
    if (!this.g) { if (!GAMES[g]) return jres({ error: 'game' }, 400); this.g = g; }
    if (this.players().length >= GAMES[this.g].max) return jres({ error: 'full' }, 409);
    const pair = new WebSocketPair(); const [client, ws] = Object.values(pair); ws.accept();
    const c = { p: null, last: 0, spam: 0, muteUntil: 0, lastText: '' }; this.conns.set(ws, c);
    ws.addEventListener('message', ev => { try { this.onMsg(ws, c, JSON.parse(ev.data)); } catch (e) { } });
    const bye = () => { if (!this.conns.has(ws)) return; this.conns.delete(ws); if (c.p) { this.G && this.G.leave(c.p.id); this.bcast({ t: 'sys', m: `👋 ${c.p.name} đã rời phòng` }); }
      if (!this.players().length) { this.clear(); this.G = null; } else this.push(); this.syncLobby(true); };
    ws.addEventListener('close', bye); ws.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }
  onMsg(ws, c, m) {
    if (m.t === 'hi') {
      if (c.p) return;
      const id = String(m.pid || '').toUpperCase().slice(0, 8) || newCode();
      for (const [w2, c2] of this.conns) if (c2.p && c2.p.id === id && w2 !== ws) { try { w2.close(4000, 'dup'); } catch (e) { } this.conns.delete(w2); this.G && this.G.leave(id); }
      const name = String(m.name || 'Chủ tiệm').replace(/[<>\u0000-\u001f]/g, '').slice(0, 22);
      c.p = { id, name, look: m.look && typeof m.look === 'object' ? m.look : null, chat: m.chat !== false };
      if (!this.G) { this.G = makeGame(this.g, this); }
      this.G.join(c.p);
      this.send(ws, { t: 'hello', code: this.code, g: this.g, me: id });
      this.bcast({ t: 'sys', m: `🙌 ${name} vào phòng` }, ws);
      this.push(); this.syncLobby(true); return;
    }
    if (!c.p) return;
    const now = Date.now();
    if (m.t === 'emo' || m.t === 'chat') {
      if (now < c.muteUntil) return this.send(ws, { t: 'sys', m: '🔇 Bạn đang bị tạm khóa chat 1 phút vì gửi quá nhanh.' });
      if (now - c.last < 1500) { if (++c.spam >= 4) { c.muteUntil = now + 60e3; c.spam = 0; } return; }
      c.spam = Math.max(0, c.spam - 1); c.last = now;
      if (m.t === 'emo') { const k = String(m.k || '').slice(0, 40); return this.bcast({ t: 'chat', from: c.p.id, name: c.p.name, text: k, emo: true }); }
      if (!this.G.freeChat) return;
      const text = cleanChat(m.text); if (!text) return;
      if (text === c.lastText) { if (++c.spam >= 3) c.muteUntil = now + 60e3; return; } c.lastText = text;
      const ch = this.G.chatScope ? this.G.chatScope(c.p.id) : null;   // Ma sói: người chết / kênh Sói
      if (ch) { for (const [w2, c2] of this.conns) if (c2.p && ch.to.has(c2.p.id)) this.send(w2, { t: 'chat', from: c.p.id, name: c.p.name, text, ch: ch.tag }); return; }
      return this.bcast({ t: 'chat', from: c.p.id, name: c.p.name, text });
    }
    if (m.t === 'act') { this.G.act(c.p.id, m, ws); }
  }
}

function makeGame(g, room) { return new ({ bc: BauCua, xd: XiDach, mil: MilDuel, soi: MaSoi, uno: MotLa, boom: MeoNo }[g])(room); }
const BOT_NAMES = ['Máy Bé Na', 'Máy Cô Ba', 'Máy Anh Tư', 'Máy Chú Sáu', 'Máy Út Lan', 'Máy Bác Hai', 'Máy Chị Mơ', 'Máy Cậu Tí', 'Máy Dì Bảy'];

// ===== 🦀 Bầu cua chung bát =====
const BC_K = ['bau', 'cua', 'tom', 'ca', 'ga', 'nai'];
class BauCua {
  constructor(room) { this.r = room; this.ps = new Map(); this.phase = 'bet'; this.bets = {}; this.dice = null; this.res = {}; this.until = 0; this.round = 0; this.start(); }
  join(p) { this.ps.set(p.id, p); }
  leave(id) { this.ps.delete(id); delete this.bets[id]; }
  start() { this.phase = 'bet'; this.bets = {}; this.res = {}; this.until = Date.now() + 20e3; this.round++; this.r.later(20e3, () => this.roll()); this.r.G === this && this.r.push(); }
  roll() { if (!this.ps.size) return; this.phase = 'roll'; this.dice = [0, 1, 2].map(() => pick(BC_K)); this.res = {};
    for (const [id, b] of Object.entries(this.bets)) { let net = 0; for (const [k, v] of Object.entries(b)) { const c = this.dice.filter(x => x === k).length; net += c ? v * c : -v; } this.res[id] = net; }
    this.until = Date.now() + 6e3; this.r.push(); this.r.later(6e3, () => this.start()); }
  act(id, m, ws) {
    if (m.a === 'bet' && this.phase === 'bet') { const k = m.k, v = Math.max(0, Math.round(+m.v || 0)); if (!BC_K.includes(k) || !v) return;
      const b = this.bets[id] || (this.bets[id] = {}); const tot = Object.values(b).reduce((a, x) => a + x, 0); const cap = Math.min(MAX_BET, Math.max(0, +m.cap || MAX_BET));
      if (tot + v > cap) return this.r.send(ws, { t: 'sys', m: `Mỗi ván tối đa ${Math.round(cap / 1e3)}k` }); b[k] = (b[k] || 0) + v; this.r.push(); }
    if (m.a === 'clear' && this.phase === 'bet') { delete this.bets[id]; this.r.push(); }
  }
  view(me) { return { g: 'bc', phase: this.phase, until: this.until, round: this.round, dice: this.phase === 'roll' ? this.dice : null,
    players: [...this.ps.values()].map(p => ({ id: p.id, name: p.name, look: p.look, bets: this.bets[p.id] || {}, net: this.phase === 'roll' ? this.res[p.id] : undefined })), me, myNet: this.phase === 'roll' ? this.res[me] : undefined }; }
}

// ===== 🃏 Xì dách cùng bàn (mỗi người đấu với nhà cái) =====
const XV = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], XS = ['♠', '♥', '♦', '♣'];
const xdDeck = () => shuffle(XS.flatMap(s => XV.map(v => ({ v, s }))));
function xdPts(h) { let t = 0, a = 0; for (const c of h) { if (c.v === 'A') { a++; t += 1; } else t += ['J', 'Q', 'K'].includes(c.v) ? 10 : +c.v; }
  while (a--) { const add = h.length <= 2 ? 10 : h.length === 3 ? 9 : 0; if (add && t + add <= 21) t += add; } return t; }
function xdKind(h) { if (h.length === 2 && h.every(c => c.v === 'A')) return 'xiban'; if (h.length === 2 && h.some(c => c.v === 'A') && h.some(c => ['10', 'J', 'Q', 'K'].includes(c.v))) return 'xidach';
  const p = xdPts(h); if (p > 21) return 'quac'; if (h.length === 5) return 'ngulinh'; return 'pts'; }
const XR = { xiban: 4, xidach: 3, ngulinh: 2 };
function xdNet(p, d, bet) { const pk = xdKind(p), dk = xdKind(d), pr = XR[pk] || 0, dr = XR[dk] || 0;
  if (pk === 'quac') return -bet; if (pr && pr > dr) return Math.round(bet * ({ 4: 1.5, 3: 1, 2: 1 }[pr])); if (dr && dr > pr) return -bet; if (pr && pr === dr) return 0;
  if (dk === 'quac') return bet; const a = xdPts(p), b = xdPts(d); return a > b ? bet : a < b ? -bet : 0; }
class XiDach {
  constructor(room) { this.r = room; this.seats = []; this.phase = 'bet'; this.until = 0; this.bets = {}; this.hands = {}; this.dealer = []; this.turn = null; this.res = {}; this.state = {}; this.betPhase(); }
  join(p) { if (this.seats.length < 5) this.seats.push(p); }
  leave(id) { this.seats = this.seats.filter(p => p.id !== id); delete this.bets[id]; if (this.turn === id) this.next(); }
  betPhase() { this.phase = 'bet'; this.bets = {}; this.hands = {}; this.dealer = []; this.res = {}; this.state = {}; this.turn = null; this.until = Date.now() + 15e3;
    this.r.later(15e3, () => this.deal()); this.r.G === this && this.r.push(); }
  deal() { const ids = Object.keys(this.bets).filter(id => this.seats.some(p => p.id === id));
    if (!ids.length) return this.betPhase();
    this.deck = xdDeck(); this.phase = 'play'; for (const id of ids) { this.hands[id] = [this.deck.pop(), this.deck.pop()]; this.state[id] = 'wait'; } this.dealer = [this.deck.pop(), this.deck.pop()];
    if (XR[xdKind(this.dealer)] >= 3) return this.finish();
    for (const id of ids) if (XR[xdKind(this.hands[id])] >= 3) this.state[id] = 'done';
    this.order = ids; this.next(); }
  next() { if (this.phase !== 'play') return; this.clearTurn(); const id = (this.order || []).find(i => this.state[i] === 'wait' || this.state[i] === 'turn');
    if (!id) return this.finish(); this.turn = id; this.state[id] = 'turn'; this.until = Date.now() + 20e3;
    this.turnT = this.r.later(20e3, () => { if (this.turn === id) { this.state[id] = 'done'; this.next(); } }); this.r.push(); }
  clearTurn() { if (this.turnT) { clearTimeout(this.turnT); this.turnT = null; } }
  act(id, m) { if (this.phase === 'bet' && m.a === 'bet') { const v = Math.max(10e3, Math.min(MAX_BET, Math.round(+m.v || 0), +m.cap || MAX_BET)); if (this.seats.some(p => p.id === id)) { this.bets[id] = v; this.r.push(); } return; }
    if (this.phase !== 'play' || this.turn !== id) return; const h = this.hands[id];
    if (m.a === 'hit' && h.length < 5) { h.push(this.deck.pop()); const k = xdKind(h); if (k === 'quac' || k === 'ngulinh' || this.state[id + 'dbl']) { this.state[id] = 'done'; return this.next(); } this.until = Date.now() + 20e3; this.clearTurn(); this.turnT = this.r.later(20e3, () => { if (this.turn === id) { this.state[id] = 'done'; this.next(); } }); return this.r.push(); }
    if (m.a === 'stand' && xdPts(h) >= 16) { this.state[id] = 'done'; return this.next(); }
    if (m.a === 'double' && h.length === 2 && !this.state[id + 'dbl']) { this.bets[id] = Math.min(this.bets[id] * 2, MAX_BET * 2); this.state[id + 'dbl'] = 1; h.push(this.deck.pop()); this.state[id] = 'done'; return this.next(); }
  }
  finish() { this.clearTurn(); this.turn = null; while (xdPts(this.dealer) < 16 && this.dealer.length < 5 && Object.values(this.hands).some(h => xdKind(h) !== 'quac')) this.dealer.push(this.deck.pop());
    for (const id of Object.keys(this.hands)) this.res[id] = xdNet(this.hands[id], this.dealer, this.bets[id]);
    this.phase = 'done'; this.until = Date.now() + 7e3; this.r.push(); this.r.later(7e3, () => this.betPhase()); }
  view(me) { const show = this.phase === 'done';
    return { g: 'xd', phase: this.phase, until: this.until, turn: this.turn, me,
      dealer: this.dealer.map((c, i) => (i === 0 || show) ? c : null), dealerPts: show ? xdPts(this.dealer) : null, dealerKind: show ? xdKind(this.dealer) : null,
      seats: this.seats.map(p => ({ id: p.id, name: p.name, look: p.look, bet: this.bets[p.id] || 0, hand: this.hands[p.id] || [], pts: this.hands[p.id] ? xdPts(this.hands[p.id]) : null, kind: this.hands[p.id] ? xdKind(this.hands[p.id]) : null, st: this.state[p.id] || '', net: show ? this.res[p.id] : undefined })),
      myNet: show ? this.res[me] : undefined }; }
}

// ===== 💰 Triệu phú đối kháng: 4 người, 10 câu, 10 giây/câu =====
class MilDuel {
  constructor(room) { this.r = room; this.ps = new Map(); this.phase = 'wait'; this.until = Date.now() + 20e3; this.score = {}; this.qi = -1; this.ans = {}; this.open = true; this.r.later(20e3, () => this.begin()); }
  join(p) { if (this.phase !== 'wait') { p.spect = true; } this.ps.set(p.id, p); this.score[p.id] = this.score[p.id] || 0; if (this.phase === 'wait' && [...this.ps.values()].filter(x => !x.bot).length >= 4) this.begin(); }
  leave(id) { this.ps.delete(id); }
  begin() { if (this.phase !== 'wait') return; const humans = [...this.ps.values()].filter(p => !p.bot); if (!humans.length) return;
    let i = 0; while (this.ps.size < 4) { const id = 'BOT' + i; this.ps.set(id, { id, name: BOT_NAMES[i++ % BOT_NAMES.length], bot: true, look: null, skill: 0.45 + Math.random() * 0.4 }); this.score[id] = 0; }
    this.open = false; this.r.syncLobby(true); const used = new Set(); this.qs = [];
    for (let k = 0; k < 10; k++) { const lv = k < 4 ? 0 : k < 7 ? 1 : 2; const pool = MIL_Q[lv].filter(q => !used.has(q[0])); const q = pick(pool); used.add(q[0]); const ord = shuffle([0, 1, 2, 3]); this.qs.push({ q: q[0], a: ord.map(j => q[1][j]), ok: ord.indexOf(q[2]) }); }
    this.ask(0); }
  ask(i) { this.qi = i; this.ans = {}; this.phase = 'q'; this.qStart = Date.now(); this.until = this.qStart + 10e3;
    for (const p of this.ps.values()) if (p.bot) { const t = 1500 + Math.random() * 7000; this.r.later(t, () => { if (this.qi !== i || this.phase !== 'q') return; const q = this.qs[i]; this.answer(p.id, Math.random() < p.skill ? q.ok : rnd(4)); }); }
    this.r.push(); this.qT = this.r.later(10e3, () => this.reveal()); }
  answer(id, k) { if (this.phase !== 'q' || this.ans[id] != null || !this.ps.has(id) || this.ps.get(id).spect) return; const dt = Date.now() - this.qStart; this.ans[id] = { k, dt };
    if (k === this.qs[this.qi].ok) this.score[id] += 500 + Math.round(Math.max(0, 10e3 - dt) / 10);
    if ([...this.ps.values()].filter(p => !p.spect).every(p => this.ans[p.id] != null)) { clearTimeout(this.qT); this.reveal(); } else this.r.push(); }
  reveal() { if (this.phase !== 'q') return; this.phase = 'rev'; this.until = Date.now() + 3e3; this.r.push();
    this.r.later(3e3, () => this.qi < 9 ? this.ask(this.qi + 1) : this.end()); }
  end() { this.phase = 'end'; const rank = [...this.ps.values()].filter(p => !p.spect).sort((a, b) => this.score[b.id] - this.score[a.id]); this.rank = rank.map(p => p.id); this.until = Date.now() + 15e3; this.r.push();
    this.r.later(15e3, () => { this.phase = 'wait'; this.score = {}; for (const [id, p] of this.ps) { if (p.bot) this.ps.delete(id); else { p.spect = false; this.score[id] = 0; } } this.open = true; this.until = Date.now() + 20e3; this.r.syncLobby(true); this.r.push(); this.r.later(20e3, () => this.begin()); }); }
  act(id, m) { if (m.a === 'ans') this.answer(id, +m.k); if (m.a === 'start' && this.phase === 'wait') this.begin(); }
  view(me) { const q = this.qi >= 0 && this.qs ? this.qs[this.qi] : null;
    return { g: 'mil', phase: this.phase, until: this.until, qi: this.qi, me, q: q ? { q: q.q, a: q.a, ok: this.phase === 'rev' ? q.ok : null } : null, rank: this.rank || null,
      players: [...this.ps.values()].map(p => ({ id: p.id, name: p.name, look: p.look, bot: !!p.bot, spect: !!p.spect, score: this.score[p.id] || 0, answered: this.ans[p.id] != null, ans: this.phase === 'rev' && this.ans[p.id] ? this.ans[p.id] : null })) }; }
}

// Board game (Ma sói, Bài Một Lá, Mèo Nổ) ở file riêng
import { MaSoi, MotLa, MeoNo } from './board.js';

export async function handleRooms(req, env, url, path, cors) {
  const lob = () => env.LOBBY.get(env.LOBBY.idFromName('main'));
  if (path === '/mp/list') { const r = await lob().fetch('https://lobby/list' + url.search); return new Response(r.body, { headers: { 'content-type': 'application/json', ...cors } }); }
  if (path === '/mp/quick' || path === '/mp/new') { const g = url.searchParams.get('g'); if (!GAMES[g]) return jres({ error: 'game' }, 400, cors);
    const r = path === '/mp/quick' ? await lob().fetch('https://lobby/quick?g=' + g) : await lob().fetch('https://lobby/new', { method: 'POST', body: JSON.stringify({ g, priv: url.searchParams.get('priv') === '1', name: url.searchParams.get('name') || '' }) });
    return new Response(r.body, { headers: { 'content-type': 'application/json', ...cors } }); }
  if (path === '/mp/has') { const r = await lob().fetch('https://lobby/has' + url.search); return new Response(r.body, { headers: { 'content-type': 'application/json', ...cors } }); }
  if (path === '/mp/ws') { const code = (url.searchParams.get('code') || '').toUpperCase(); if (!/^[A-Z0-9]{4}$/.test(code)) return jres({ error: 'code' }, 400);
    const room = env.ROOM.get(env.ROOM.idFromName(code)); const u = new URL(req.url); u.searchParams.set('code', code); return room.fetch(new Request(u, req)); }
  return null;
}
export { BOT_NAMES, pick, rnd, shuffle };
