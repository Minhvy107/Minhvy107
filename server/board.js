// 🎲 Board game chơi chung: Ma sói, Bài Một Lá (kiểu UNO), Mèo Nổ (kiểu thẻ boom). Có chat tự do (đã lọc), thiếu người thì máy chơi thay.
import { BOT_NAMES, pick, rnd, shuffle } from './rooms.js';

// Khung chung: phòng chờ → bắt đầu (đủ người hoặc bấm Bắt đầu, thêm máy cho đủ) → ván chơi → kết thúc → phòng chờ
class Board {
  constructor(room, min, max) { this.r = room; this.min = min; this.max = max; this.ps = []; this.phase = 'wait'; this.until = 0; this.freeChat = true; this.open = true; this.log = []; this.winners = null; }
  join(p) { if (this.phase !== 'wait') { p.spect = true; } if (!this.ps.some(x => x.id === p.id)) this.ps.push(p); else Object.assign(this.ps.find(x => x.id === p.id), { name: p.name, look: p.look, bot: false }); }
  leave(id) { const p = this.ps.find(x => x.id === id); if (!p) return;
    if (this.phase === 'wait' || p.spect) { this.ps = this.ps.filter(x => x.id !== id); return; }
    p.bot = true; p.name = p.name + ' (máy)'; this.botTick(); }   // đang chơi thì máy chơi thay
  humans() { return this.ps.filter(p => !p.bot && !p.spect); }
  say(m) { this.log.push(m); if (this.log.length > 30) this.log.shift(); }
  fill() { let i = 0; const names = shuffle(BOT_NAMES.slice()).filter(n => !this.ps.some(p => p.name === n)); while (this.ps.filter(p => !p.spect).length < this.min) { const id = 'BOT' + (i++); if (this.ps.some(p => p.id === id)) continue; this.ps.push({ id, name: names.pop() || 'Máy ' + i, bot: true, look: null }); } }
  start() { if (this.phase !== 'wait' || !this.humans().length) return; this.ps = this.ps.filter(p => !p.spect || !p.bot); this.ps.forEach(p => p.spect = false); this.fill(); this.open = false; this.log = []; this.winners = null; this.r.syncLobby(true); this.begin(); }
  finish(winIds, msg) { this.phase = 'end'; this.winners = winIds; this.say(msg); this.until = Date.now() + 15e3; this.r.push();
    this.r.later(15e3, () => { this.phase = 'wait'; this.ps = this.ps.filter(p => !p.bot); this.ps.forEach(p => { p.spect = false; }); this.open = true; this.r.syncLobby(true); this.r.push(); }); }
  base(me) { return { phase: this.phase, until: this.until, me, log: this.log.slice(-8), winners: this.winners, min: this.min, max: this.max }; }
  botTick() {}
}

// ===================== 🃏 Bài Một Lá =====================
const COL = ['r', 'y', 'g', 'b'];
function unoDeck() { const d = []; let n = 0; for (const c of COL) { d.push({ c, v: '0', id: n++ }); for (const v of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'rev', '+2']) { d.push({ c, v, id: n++ }); d.push({ c, v, id: n++ }); } }
  for (let i = 0; i < 4; i++) { d.push({ c: 'w', v: 'wild', id: n++ }); d.push({ c: 'w', v: '+4', id: n++ }); } return shuffle(d); }
export class MotLa extends Board {
  constructor(room) { super(room, 2, 6); }
  begin() { this.deck = unoDeck(); this.pile = []; this.hand = {}; this.called = {}; for (const p of this.ps) this.hand[p.id] = this.deck.splice(0, 7);
    let top; do { top = this.deck.pop(); if (top.c === 'w') this.deck.unshift(top); } while (top.c === 'w'); this.pile.push(top); this.color = top.c; this.dir = 1; this.cur = 0; this.phase = 'play';
    if (top.v === 'skip') this.cur = 1; if (top.v === 'rev') this.dir = -1; if (top.v === '+2') { this.drawN(this.ps[0].id, 2); this.cur = 1; }
    this.cur = (this.cur + this.ps.length) % this.ps.length; this.say('🃏 Chia bài xong, bắt đầu!'); this.turnStart(); }
  get top() { return this.pile[this.pile.length - 1]; }
  ok(card) { return card.c === 'w' || card.c === this.color || card.v === this.top.v; }
  drawN(id, n) { for (let i = 0; i < n; i++) { if (!this.deck.length) { const t = this.pile.pop(); this.deck = shuffle(this.pile.map(c => c.c === 'w' ? { ...c } : c)); this.pile = [t]; } if (this.deck.length) this.hand[id].push(this.deck.pop()); } }
  nextIdx(k = 1) { return ((this.cur + this.dir * k) % this.ps.length + this.ps.length) % this.ps.length; }
  turnStart() { const p = this.ps[this.cur]; this.until = Date.now() + 20e3; this.drew = false; if (this.tT) clearTimeout(this.tT);
    this.tT = this.r.later(20e3, () => { if (this.ps[this.cur] === p && this.phase === 'play') { if (!this.drew) this.drawN(p.id, 1); this.say(`⏰ ${p.name} hết giờ`); this.advance(1); } });
    this.r.push(); if (p.bot) this.r.later(900 + rnd(900), () => this.botPlay(p)); }
  advance(k) { this.cur = this.nextIdx(k); this.turnStart(); }
  play(id, idx, color) { const p = this.ps[this.cur]; if (!p || p.id !== id || this.phase !== 'play') return; const h = this.hand[id], card = h[idx]; if (!card || !this.ok(card)) return;
    h.splice(idx, 1); this.pile.push(card); this.color = card.c === 'w' ? (COL.includes(color) ? color : 'r') : card.c;
    this.say(`${p.name} đánh ${cardName(card)}${card.c === 'w' ? ' → màu ' + CNAME[this.color] : ''}`);
    if (h.length === 1 && !this.called[id]) { this.drawN(id, 2); this.say(`😅 ${p.name} quên hô "MỘT LÁ!" → phạt rút 2`); }
    this.called[id] = false;
    if (!h.length) return this.finish([id], `🏆 ${p.name} hết bài và thắng ván!`);
    let k = 1; if (card.v === 'skip') k = 2; if (card.v === 'rev') { this.dir *= -1; if (this.ps.length === 2) k = 2; }
    if (card.v === '+2') { this.drawN(this.ps[this.nextIdx()].id, 2); k = 2; } if (card.v === '+4') { this.drawN(this.ps[this.nextIdx()].id, 4); k = 2; }
    this.advance(k); }
  draw(id) { const p = this.ps[this.cur]; if (!p || p.id !== id || this.drew || this.phase !== 'play') return; this.drawN(id, 1); this.drew = true; const c = this.hand[id][this.hand[id].length - 1];
    if (!this.ok(c)) { this.say(`${p.name} rút bài và bỏ lượt`); return this.advance(1); } this.r.push(); if (p.bot) this.r.later(700, () => this.botPlay(p)); }
  pass(id) { const p = this.ps[this.cur]; if (p && p.id === id && this.drew) { this.say(`${p.name} bỏ lượt`); this.advance(1); } }
  botPlay(p) { if (this.ps[this.cur] !== p || this.phase !== 'play') return; const h = this.hand[p.id];
    let idx = h.findIndex(c => c.c !== 'w' && this.ok(c)); if (idx < 0) idx = h.findIndex(c => this.ok(c));
    if (idx < 0) { if (!this.drew) return this.draw(p.id); return this.pass(p.id); }
    if (h.length === 2) this.called[p.id] = Math.random() < 0.85;
    const cnt = {}; h.forEach(c => { if (c.c !== 'w') cnt[c.c] = (cnt[c.c] || 0) + 1; }); const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    this.play(p.id, idx, best ? best[0] : pick(COL)); }
  botTick() { const p = this.ps[this.cur]; if (this.phase === 'play' && p && p.bot) this.r.later(800, () => this.botPlay(p)); }
  act(id, m) { if (m.a === 'start') return this.start(); if (this.phase !== 'play') return;
    if (m.a === 'play') this.play(id, +m.i, m.color); else if (m.a === 'draw') this.draw(id); else if (m.a === 'pass') this.pass(id);
    else if (m.a === 'mot') { this.called[id] = true; const p = this.ps.find(x => x.id === id); this.say(`📣 ${p.name}: MỘT LÁ!`); this.r.push(); } }
  view(me) { return { ...this.base(me), g: 'uno', players: this.ps.map((p, i) => ({ id: p.id, name: p.name, look: p.look, bot: p.bot, n: this.hand ? (this.hand[p.id] || []).length : 0, turn: this.phase === 'play' && i === this.cur, spect: p.spect })),
    hand: this.hand && this.hand[me] ? this.hand[me] : [], top: this.pile ? this.top : null, color: this.color, dir: this.dir, drew: this.ps[this.cur] && this.ps[this.cur].id === me ? this.drew : false, deckN: this.deck ? this.deck.length : 0 }; }
}
const CNAME = { r: 'đỏ', y: 'vàng', g: 'xanh lá', b: 'xanh dương', w: '' };
const cardName = c => c.c === 'w' ? (c.v === '+4' ? '🌈 +4' : '🌈 Đổi màu') : `${({ skip: '⊘', rev: '🔄' }[c.v] || c.v)} ${CNAME[c.c]}`;

// ===================== 💣 Mèo Nổ =====================
const KC = { defuse: '🧯 Gỡ bom', bomb: '💣 Boom', see: '👀 Xem trước', skip: '⏭️ Bỏ lượt', attack: '⚡ Tấn công', shuffle: '🔀 Xáo bài', nope: '✋ KHÔNG!', cat: '🐱 Mèo' };
export class MeoNo extends Board {
  constructor(room) { super(room, 2, 5); }
  begin() { const n = this.ps.length; let id = 0; const mk = (k, c) => Array.from({ length: c }, () => ({ k, id: id++ }));
    let deck = shuffle([...mk('see', 5), ...mk('skip', 4), ...mk('attack', 4), ...mk('shuffle', 4), ...mk('nope', 5), ...mk('cat', 12)]);
    this.hand = {}; for (const p of this.ps) this.hand[p.id] = [...mk('defuse', 1), ...deck.splice(0, 5)];
    deck.push(...mk('defuse', Math.max(1, 6 - n)), ...mk('bomb', n - 1)); this.deck = shuffle(deck); this.alive = new Set(this.ps.map(p => p.id));
    this.cur = 0; this.turns = 1; this.phase = 'play'; this.pend = null; this.peek = {}; this.say(`💣 Có ${n - 1} quả bom trong chồng bài. Chúc may mắn!`); this.turnStart(); }
  get P() { return this.ps[this.cur]; }
  turnStart() { this.until = Date.now() + 25e3; if (this.tT) clearTimeout(this.tT); const p = this.P;
    this.tT = this.r.later(25e3, () => { if (this.P === p && this.phase === 'play' && !this.pend) this.drawCard(p.id); }); this.r.push(); if (p.bot) this.r.later(1200 + rnd(1000), () => this.botPlay(p)); }
  nextAlive() { let i = this.cur; do i = (i + 1) % this.ps.length; while (!this.alive.has(this.ps[i].id)); return i; }
  endTurn() { if (--this.turns > 0) return this.turnStart(); this.cur = this.nextAlive(); this.turns = this.nextTurns || 1; this.nextTurns = 0; this.turnStart(); }
  playCard(id, idx, target) { const p = this.P; if (!p || p.id !== id || this.phase !== 'play' || this.pend) return; const h = this.hand[id], c = h[idx]; if (!c || ['defuse', 'nope', 'bomb'].includes(c.k)) return;
    if (c.k === 'cat') { const j = h.findIndex((x, i) => i !== idx && x.k === 'cat'); if (j < 0) return; const tg = this.ps.find(x => x.id === target && x.id !== id && this.alive.has(x.id)) || this.ps.find(x => x.id !== id && this.alive.has(x.id) && this.hand[x.id].length);
      if (!tg) return; h.splice(Math.max(idx, j), 1); h.splice(Math.min(idx, j), 1); this.pending(p, { k: 'cat', tg: tg.id }, `${p.name} đánh đôi 🐱🐱, định lấy 1 lá của ${tg.name}`); return; }
    h.splice(idx, 1); this.pending(p, { k: c.k }, `${p.name} đánh ${KC[c.k]}`); }
  pending(p, eff, msg) { this.say(msg); this.pend = { by: p.id, eff, nopes: 0, until: Date.now() + 3000 }; this.r.push();
    for (const q of this.ps) if (q.bot && q.id !== p.id && this.alive.has(q.id) && Math.random() < 0.25) this.r.later(600 + rnd(1500), () => this.nope(q.id));
    this.pT = this.r.later(3000, () => this.resolve()); }
  nope(id) { if (!this.pend || !this.alive.has(id)) return; const h = this.hand[id], i = h.findIndex(c => c.k === 'nope'); if (i < 0) return; h.splice(i, 1); this.pend.nopes++; this.pend.until = Date.now() + 3000;
    const p = this.ps.find(x => x.id === id); this.say(`✋ ${p.name}: KHÔNG! ${this.pend.nopes % 2 ? '(chặn lại)' : '(chặn cái chặn!)'}`); clearTimeout(this.pT); this.pT = this.r.later(3000, () => this.resolve()); this.r.push(); }
  resolve() { const pe = this.pend; if (!pe) return; this.pend = null; const p = this.ps.find(x => x.id === pe.by); if (pe.nopes % 2) { this.say('❌ Lá bài bị chặn, không có tác dụng'); this.r.push(); if (p && p.bot && this.P === p) this.r.later(900, () => this.botPlay(p)); return; }
    const e = pe.eff;
    if (e.k === 'see') { this.peek[p.id] = this.deck.slice(-3).reverse().map(c => c.k); this.r.push(); }
    else if (e.k === 'shuffle') { shuffle(this.deck); this.peek = {}; this.say('🔀 Chồng bài đã được xáo'); this.r.push(); }
    else if (e.k === 'skip') { this.peek = {}; return this.endTurn(); }
    else if (e.k === 'attack') { this.peek = {}; this.turns = 1; this.nextTurns = 2; this.say(`⚡ ${this.ps[this.nextAlive()].name} phải đi 2 lượt!`); return this.endTurn(); }
    else if (e.k === 'cat') { const th = this.hand[e.tg]; if (th && th.length) { const c = th.splice(rnd(th.length), 1)[0]; this.hand[p.id].push(c); this.say(`🐱 ${p.name} lấy được 1 lá của ${this.ps.find(x => x.id === e.tg).name}`); } this.r.push(); }
    if (p && p.bot && this.P === p) this.r.later(900, () => this.botPlay(p)); }
  drawCard(id) { const p = this.P; if (!p || p.id !== id || this.phase !== 'play' || this.pend) return; const c = this.deck.pop(); this.peek = {};
    if (c.k === 'bomb') { const di = this.hand[id].findIndex(x => x.k === 'defuse');
      if (di >= 0) { this.hand[id].splice(di, 1); this.deck.splice(rnd(this.deck.length + 1), 0, c); this.say(`💣 ${p.name} rút trúng BOOM… nhưng đã gỡ bom 🧯! Bom được giấu lại vào chồng bài.`); }
      else { this.alive.delete(id); this.say(`💥 BÙM! ${p.name} nổ tung!`); const left = this.ps.filter(x => this.alive.has(x.id)); if (left.length === 1) return this.finish([left[0].id], `🏆 ${left[0].name} là người sống sót cuối cùng!`); this.turns = 1; } }
    else this.hand[id].push(c);
    this.endTurn(); }
  botPlay(p) { if (this.P !== p || this.phase !== 'play' || this.pend) return; const h = this.hand[p.id]; const pk = this.peek[p.id];
    const has = k => h.findIndex(c => c.k === k); const bombTop = pk && pk[0] === 'bomb';
    if (bombTop || (this.deck.length < 8 && Math.random() < 0.4)) { for (const k of ['skip', 'attack', 'shuffle']) { const i = has(k); if (i >= 0) return this.playCard(p.id, i); } }
    if (!pk && Math.random() < 0.5 && has('see') >= 0) return this.playCard(p.id, has('see'));
    const cats = h.filter(c => c.k === 'cat').length; if (cats >= 2 && Math.random() < 0.5) return this.playCard(p.id, has('cat'));
    this.drawCard(p.id); }
  botTick() { const p = this.P; if (this.phase === 'play' && p && p.bot) this.r.later(900, () => this.botPlay(p)); }
  act(id, m) { if (m.a === 'start') return this.start(); if (this.phase !== 'play') return;
    if (m.a === 'play') this.playCard(id, +m.i, m.tg); else if (m.a === 'draw') this.drawCard(id); else if (m.a === 'nope') this.nope(id); }
  view(me) { return { ...this.base(me), g: 'boom', players: this.ps.map(p => ({ id: p.id, name: p.name, look: p.look, bot: p.bot, n: this.hand ? (this.hand[p.id] || []).length : 0, alive: this.alive ? this.alive.has(p.id) : true, turn: this.phase === 'play' && this.P === p, spect: p.spect })),
    hand: this.hand && this.hand[me] ? this.hand[me] : [], deckN: this.deck ? this.deck.length : 0, bombs: this.deck ? this.deck.filter(c => c.k === 'bomb').length : 0, turns: this.turns, peek: this.peek ? this.peek[me] || null : null,
    pend: this.pend ? { by: this.pend.by, k: this.pend.eff.k, nopes: this.pend.nopes, until: this.pend.until } : null }; }
}

// ===================== 🐺 Ma sói =====================
const RN = { wolf: '🐺 Sói', seer: '🔮 Tiên tri', guard: '🛡️ Bảo vệ', witch: '🧪 Phù thủy', hunter: '🏹 Thợ săn', vill: '👨‍🌾 Dân làng' };
const BOT_TALK = ['Tôi là dân lành thôi mà 😇', 'Tôi thấy {x} hơi đáng nghi', 'Đêm qua yên tĩnh quá…', 'Ai là Tiên tri thì lên tiếng đi!', 'Tôi bỏ phiếu {x}', '{x} nói nhiều quá, nghi lắm', 'Bình tĩnh mọi người ơi'];
export class MaSoi extends Board {
  constructor(room) { super(room, 6, 10); }
  begin() { const n = this.ps.length, w = n >= 9 ? 3 : 2; const roles = ['seer', 'guard', 'witch']; if (n >= 8) roles.push('hunter'); while (roles.length + w < n) roles.push('vill'); for (let i = 0; i < w; i++) roles.push('wolf');
    shuffle(roles); this.role = {}; this.ps.forEach((p, i) => this.role[p.id] = roles[i]); this.alive = new Set(this.ps.map(p => p.id)); this.day = 0; this.potion = { save: 1, kill: 1 }; this.lastGuard = null; this.seen = {}; this.votes = {};
    this.say(`🌙 Làng có ${w} con Sói trà trộn. Trời tối rồi…`); this.night(); }
  isWolf = id => this.role[id] === 'wolf';
  aliveP() { return this.ps.filter(p => this.alive.has(p.id)); }
  night() { this.phase = 'night'; this.day++; this.nv = {}; this.wolfVote = {}; this.until = Date.now() + 25e3; this.r.push(); this.nT = this.r.later(25e3, () => this.dawn());
    for (const p of this.aliveP()) if (p.bot) this.r.later(2000 + rnd(8000), () => this.botNight(p)); }
  botNight(p) { if (this.phase !== 'night' || !this.alive.has(p.id)) return; const r = this.role[p.id], others = this.aliveP().filter(x => x.id !== p.id);
    if (r === 'wolf') { const wolfT = Object.values(this.wolfVote)[0]; this.act(p.id, { a: 'kill', tg: wolfT || pick(others.filter(x => !this.isWolf(x.id))).id }); }
    else if (r === 'seer') { const un = others.filter(x => !this.seen[x.id]); if (un.length) this.act(p.id, { a: 'see', tg: pick(un).id }); }
    else if (r === 'guard') { const opts = this.aliveP().filter(x => x.id !== this.lastGuard); this.act(p.id, { a: 'guard', tg: pick(opts).id }); }
    else if (r === 'witch') { this.r.later(9000, () => { if (this.phase !== 'night') return; const v = this.victim(); if (v && this.potion.save && Math.random() < 0.5) this.act(p.id, { a: 'save' }); }); } }
  victim() { const c = {}; for (const t of Object.values(this.wolfVote)) c[t] = (c[t] || 0) + 1; const s = Object.entries(c).sort((a, b) => b[1] - a[1]); return s.length ? s[0][0] : null; }
  dawn() { if (this.phase !== 'night') return; clearTimeout(this.nT); const dead = new Set(); const v = this.victim();
    if (v && v !== this.nv.guard && !this.nv.saved) dead.add(v); if (this.nv.poison) dead.add(this.nv.poison); this.lastGuard = this.nv.guard || null;
    this.phase = 'dawn'; if (!dead.size) this.say(`☀️ Ngày ${this.day}: đêm qua bình yên, không ai chết.`); else this.say(`☀️ Ngày ${this.day}: ${[...dead].map(id => this.nm(id)).join(', ')} đã chết đêm qua.`);
    this.kill([...dead], () => this.discuss()); }
  nm(id) { const p = this.ps.find(x => x.id === id); return p ? p.name : '?'; }
  kill(ids, then) { for (const id of ids) this.alive.delete(id); if (this.checkWin()) return; const h = ids.find(id => this.role[id] === 'hunter');
    if (h) { this.phase = 'hunter'; this.hunter = h; this.until = Date.now() + 15e3; this.say(`🏹 ${this.nm(h)} là Thợ săn, được bắn 1 người trước khi chết!`); this.r.push();
      const go = tg => { if (this.phase !== 'hunter') return; this.phase = 'x'; if (tg && this.alive.has(tg)) { this.say(`🏹 Thợ săn bắn ${this.nm(tg)}!`); this.alive.delete(tg); } if (!this.checkWin()) then(); };
      this.hunterGo = go; const hp = this.ps.find(x => x.id === h); if (hp.bot) this.r.later(3000, () => go(pick(this.aliveP()).id)); this.r.later(15e3, () => go(null)); return; }
    then(); }
  discuss() { this.phase = 'day'; this.votes = {}; this.until = Date.now() + 60e3; this.r.push(); this.r.later(60e3, () => this.votePhase());
    for (const p of this.aliveP()) if (p.bot && Math.random() < 0.7) this.r.later(3000 + rnd(40000), () => { if (this.phase !== 'day' || !this.alive.has(p.id)) return; const x = pick(this.aliveP().filter(q => q.id !== p.id && (!this.isWolf(p.id) || !this.isWolf(q.id)))); if (!x) return;
      this.r.bcast({ t: 'chat', from: p.id, name: p.name, text: pick(BOT_TALK).replace('{x}', x.name) }); }); }
  votePhase() { if (this.phase !== 'day') return; this.phase = 'vote'; this.votes = {}; this.until = Date.now() + 20e3; this.r.push(); this.vT = this.r.later(20e3, () => this.tally());
    for (const p of this.aliveP()) if (p.bot) this.r.later(2000 + rnd(12000), () => { const opts = this.aliveP().filter(q => q.id !== p.id && (!this.isWolf(p.id) || !this.isWolf(q.id))); const known = Object.entries(this.seenBy(p.id)).find(([id, w]) => w && this.alive.has(id)); this.act(p.id, { a: 'vote', tg: known ? known[0] : pick(opts).id }); }); }
  seenBy(id) { return this.role[id] === 'seer' ? this.seen : {}; }
  tally() { if (this.phase !== 'vote') return; clearTimeout(this.vT); const c = {}; for (const t of Object.values(this.votes)) if (t) c[t] = (c[t] || 0) + 1; const s = Object.entries(c).sort((a, b) => b[1] - a[1]);
    if (!s.length || (s[1] && s[1][1] === s[0][1])) { this.say('⚖️ Phiếu hòa, không ai bị treo cổ.'); this.phase = 'x'; return this.night(); }
    const id = s[0][0]; this.say(`⚖️ Cả làng treo cổ ${this.nm(id)} (${RN[this.role[id]]}).`); this.phase = 'x'; this.kill([id], () => this.night()); }
  checkWin() { const al = this.aliveP(), w = al.filter(p => this.isWolf(p.id)).length, v = al.length - w;
    if (!w) { this.finish(this.ps.filter(p => !this.isWolf(p.id)).map(p => p.id), '🎉 Dân làng đã tiêu diệt hết Sói!'); return true; }
    if (w >= v) { this.finish(this.ps.filter(p => this.isWolf(p.id)).map(p => p.id), '🐺 Sói đã chiếm được làng!'); return true; } return false; }
  chatScope(id) { if (this.phase === 'wait' || this.phase === 'end' || !this.alive) return null;
    if (!this.alive.has(id)) return { tag: '💀', to: new Set(this.ps.filter(p => !this.alive.has(p.id)).map(p => p.id)) };
    if (this.phase === 'night') { if (this.isWolf(id)) return { tag: '🐺', to: new Set(this.ps.filter(p => this.isWolf(p.id)).map(p => p.id)) }; return { tag: '🌙', to: new Set([id]) }; }
    return null; }
  act(id, m) { if (m.a === 'start') return this.start(); const al = this.alive && this.alive.has(id); const tg = m.tg && this.alive && this.alive.has(m.tg) ? m.tg : null;
    if (this.phase === 'night' && al) { const r = this.role[id];
      if (r === 'wolf' && m.a === 'kill' && tg && !this.isWolf(tg)) this.wolfVote[id] = tg;
      else if (r === 'seer' && m.a === 'see' && tg && !this.nv.saw) { this.nv.saw = tg; this.seen[tg] = this.isWolf(tg); }
      else if (r === 'guard' && m.a === 'guard' && tg && tg !== this.lastGuard) this.nv.guard = tg;
      else if (r === 'witch' && m.a === 'save' && this.potion.save && this.victim()) { this.potion.save = 0; this.nv.saved = true; }
      else if (r === 'witch' && m.a === 'poison' && this.potion.kill && tg) { this.potion.kill = 0; this.nv.poison = tg; }
      else return; this.r.push(); return; }
    if (this.phase === 'vote' && al && m.a === 'vote') { this.votes[id] = tg; this.r.push(); if (this.aliveP().every(p => this.votes[p.id] !== undefined)) this.tally(); return; }
    if (this.phase === 'day' && al && m.a === 'skipday') { this.skip = this.skip || new Set(); this.skip.add(id); if (this.skip.size >= Math.ceil(this.aliveP().length * 0.6)) { this.skip = null; this.votePhase(); } return; }
    if (this.phase === 'hunter' && id === this.hunter && m.a === 'shoot') this.hunterGo(tg); }
  view(me) { const r = this.role ? this.role[me] : null, end = this.phase === 'end';
    return { ...this.base(me), g: 'soi', day: this.day, myRole: r, roleName: r ? RN[r] : null, alive: this.alive ? this.alive.has(me) : true,
      players: this.ps.map(p => ({ id: p.id, name: p.name, look: p.look, bot: p.bot, spect: p.spect, alive: this.alive ? this.alive.has(p.id) : true,
        role: end || (this.alive && !this.alive.has(p.id)) || p.id === me || (r === 'wolf' && this.isWolf(p.id)) ? (this.role ? RN[this.role[p.id]] : null) : null,
        seen: r === 'seer' && this.seen && p.id in this.seen ? (this.seen[p.id] ? '🐺 Sói' : '😇 Người') : null,
        votes: this.phase === 'vote' ? Object.values(this.votes).filter(t => t === p.id).length : 0 })),
      myVote: this.votes ? this.votes[me] : null, night: this.phase === 'night' && r ? { wolfT: r === 'wolf' ? this.victim() : null, victim: r === 'witch' ? this.victim() : null, potion: r === 'witch' ? this.potion : null, lastGuard: r === 'guard' ? this.lastGuard : null, done: this.nv ? { saw: this.nv.saw, guard: this.nv.guard, saved: this.nv.saved, poison: this.nv.poison } : {} } : null,
      hunter: this.phase === 'hunter' ? this.hunter : null }; }
}
