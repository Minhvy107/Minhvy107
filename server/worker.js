// Máy chủ nạp kim cương cho Chợ Lá Xanh — Cloudflare Worker + KV.
// Luồng: game tạo đơn (POST /order) → người chơi chuyển khoản VietQR với nội dung = mã đơn
// → SePay báo tiền về (POST /sepay) → game hỏi trạng thái (GET /order/:code) → nhận kim cương (POST /order/:code/claim).
// Giá gói và số kim cương chỉ lấy ở đây, không tin số liệu gửi từ trình duyệt.

import { Room, Lobby, handleRooms } from './rooms.js';
import { handleSocial } from './social.js';
import { handleAdmin, histAdd, histFlag, histKey } from './admin.js';
export { Room, Lobby };

const PACKS = {
  p1: { vnd: 22000, gems: 60 },
  p2: { vnd: 99000, gems: 350 },
  p3: { vnd: 199000, gems: 800 },
  p4: { vnd: 399000, gems: 1800 },
  p5: { vnd: 999000, gems: 5200 },
  // Gói ưu đãi (vật phẩm, thẻ tháng và thưởng x2 lần đầu do game tự cộng)
  starter: { vnd: 29000, gems: 300 },
  card: { vnd: 49000, gems: 150 },
  lux: { vnd: 149000, gems: 700 },
  // Season Pass (game tự mở Pass cao cấp + giao diện mùa)
  pass_s1: { vnd: 40000, gems: 0 },
};
const CODE_RE = /CLX[A-Z0-9]{10}/;
const PENDING_TTL = 24 * 3600;      // đơn chưa trả hết hạn sau 1 ngày
const DONE_TTL = 90 * 24 * 3600;    // lưu đơn đã trả 90 ngày để đối soát

function cors(env) {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
const json = (env, data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors(env) } });

// So sánh chuỗi không lộ thời gian
function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ===== 🏆 Bảng xếp hạng =====
const LB_MIN_DAY = 14;
const LB_REWARD = {
  week:  [150, 100, 70, 30, 30, 30, 30, 30, 30, 30],
  month: [500, 300, 200, 80, 80, 80, 80, 80, 80, 80],
};
const DAY = 864e5, VN = 7 * 3600e3;
const vnDate = ms => new Date(ms + VN);             // đọc các trường UTC = giờ Việt Nam
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd);
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return `W${y}-${String(w).padStart(2, '0')}`;
}
const monthKey = d => `M${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
function periodInfo(ms) {
  const d = vnDate(ms), wd = d.getUTCDay() || 7;
  const weekEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 8 - wd) - VN;
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - VN;
  const monthEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - VN;
  return {
    week: isoWeek(d), weekEnd, month: monthKey(d), monthEnd,
    prevWeek: isoWeek(vnDate(ms - 7 * DAY)), prevMonth: monthKey(vnDate(monthStart - 1000)),
  };
}
const LB_GAP = 20 * 60 * 1000;   // 20 phút
async function lbUpsert(env, key, row, ttl) {
  const list = JSON.parse((await env.ORDERS.get(key)) || '[]');
  const i = list.findIndex(r => r.pid === row.pid);
  if (i >= 0) {
    const o = list[i];
    if (o.worth === row.worth && o.day === row.day && o.shop === row.shop && (o.frame || '') === row.frame && (o.title || '') === row.title) return i + 1;   // không đổi thì khỏi ghi
    list.splice(i, 1);
  } else if (list.length >= 100 && row.worth <= list[99].worth) return 0;              // không đủ vào top 100
  list.push(row);
  list.sort((a, c) => c.worth - a.worth);
  const top = list.slice(0, 100);
  await env.ORDERS.put(key, JSON.stringify(top), ttl ? { expirationTtl: ttl } : undefined);
  return top.findIndex(r => r.pid === row.pid) + 1;
}
async function leaderboard(req, env, path, url) {
  let now = Date.now(); const P = periodInfo(now);
  const pidOk = p => /^[A-Z0-9]{6}$/.test(p);
  // Gửi điểm
  if (req.method === 'POST' && path === '/lb') {
    const b = await req.json().catch(() => null);
    const pid = String(b && b.pid || '').toUpperCase();
    if (!pidOk(pid)) return json(env, { error: 'bad_request' }, 400);
    if (env.DEV_SPEED && b.at) now = Number(b.at);   // chỉ khi chạy thử (wrangler dev): giả lập thời gian gửi
    const day = Math.max(1, Math.min(100000, Math.round(Number(b.day) || 1)));
    if (day < LB_MIN_DAY) return json(env, { ok: true, eligible: false, need: LB_MIN_DAY });
    const clean = (s, n) => String(s || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n);
    const cap = 40e6 + day * 25e6;                                                    // chặn số liệu phi lý
    const row = {
      pid, shop: clean(b.shop, 28) || 'Tiệm tạp hóa', day,
      worth: Math.max(0, Math.min(cap, Math.round(Number(b.worth) || 0))),
      rep: Math.max(0, Math.min(100, Math.round(Number(b.rep) || 0))),
      stars: Math.max(0, Math.min(5, Math.round((Number(b.stars) || 0) * 10) / 10)), at: now,
      frame: ['hang'].includes(b.frame) ? b.frame : '',
      title: ['haggle', 'kind', 'smart', 'streak', 'lucky', 'hand', 'star', 'trust', 'rich', 'old', 'mil', 'wolf', 'uno', 'boom', 'quiz', 'xom', 'book', 'cat', 'king', 'mart', 'gift', 'thief'].includes(b.title) ? b.title : '',
    };
    // Tiết kiệm lượt ghi KV (gói miễn phí chỉ 1.000 lượt/ngày, cần để dành cho nạp tiền): mỗi tiệm tối đa 1 lần / LB_GAP
    const rankIn = async key => JSON.parse((await env.ORDERS.get(key)) || '[]').findIndex(r => r.pid === pid) + 1;
    const prev = JSON.parse((await env.ORDERS.get('lb:all')) || '[]').find(r => r.pid === pid);
    if (prev && now - (prev.at || 0) < LB_GAP)
      return json(env, { ok: true, eligible: true, throttled: true, rank: { all: await rankIn('lb:all'), week: await rankIn('lb:' + P.week), month: await rankIn('lb:' + P.month) } });
    // 🔐 Lịch sử gửi điểm để kiểm tra gian lận (trang /admin); tiệm đã bị gỡ thì không lên bảng nữa
    const hist = JSON.parse((await env.ORDERS.get(histKey(pid))) || 'null');
    if (hist && hist.ban) return json(env, { ok: true, eligible: true, rank: { all: 0, week: 0, month: 0 } });
    await env.ORDERS.put(histKey(pid), JSON.stringify(histAdd(hist, row, now)), { expirationTtl: 400 * 86400 });
    const all = await lbUpsert(env, 'lb:all', row);
    const week = await lbUpsert(env, 'lb:' + P.week, row, 70 * 86400);
    const month = await lbUpsert(env, 'lb:' + P.month, row, 120 * 86400);
    return json(env, { ok: true, eligible: true, rank: { all, week, month } });
  }
  // Xem bảng
  if (req.method === 'GET' && path === '/lb') {
    const board = url.searchParams.get('board') || 'week', me = String(url.searchParams.get('pid') || '').toUpperCase();
    const key = board === 'all' ? 'lb:all' : board === 'month' ? 'lb:' + P.month : 'lb:' + P.week;
    const list = JSON.parse((await env.ORDERS.get(key)) || '[]');
    const myRank = list.findIndex(r => r.pid === me) + 1;
    return json(env, {
      board, period: board === 'all' ? null : board === 'month' ? P.month : P.week,
      endsAt: board === 'all' ? null : board === 'month' ? P.monthEnd : P.weekEnd,
      minDay: LB_MIN_DAY, rewards: board === 'all' ? null : LB_REWARD[board], myRank, total: list.length,
      list: list.slice(0, 50).map(({ pid, ...r }) => ({ ...r, me: pid === me })),   // không lộ mã người chơi khác
    });
  }
  // Kiểm tra thưởng tuần/tháng trước
  const findRewards = async pid => {
    const out = [];
    if (histFlag(JSON.parse((await env.ORDERS.get(histKey(pid))) || 'null')) === 'bad') return out;   // 🚩 chờ chủ game duyệt
    for (const [type, key] of [['week', P.prevWeek], ['month', P.prevMonth]]) {
      const list = JSON.parse((await env.ORDERS.get('lb:' + key)) || '[]');
      const rank = list.findIndex(r => r.pid === pid) + 1;
      if (rank && rank <= 10 && !(await env.ORDERS.get(`claim:${key}:${pid}`))) out.push({ type, period: key, rank, gems: LB_REWARD[type][rank - 1] });
    }
    return out;
  };
  if (req.method === 'GET' && path === '/lb/reward') {
    const pid = String(url.searchParams.get('pid') || '').toUpperCase();
    if (!pidOk(pid)) return json(env, { error: 'bad_request' }, 400);
    return json(env, { rewards: await findRewards(pid) });
  }
  if (req.method === 'POST' && path === '/lb/claim') {
    const b = await req.json().catch(() => null);
    const pid = String(b && b.pid || '').toUpperCase(), period = String(b && b.period || '');
    if (!pidOk(pid)) return json(env, { error: 'bad_request' }, 400);
    const r = (await findRewards(pid)).find(x => x.period === period);
    if (!r) return json(env, { error: 'no_reward' }, 409);
    await env.ORDERS.put(`claim:${period}:${pid}`, '1', { expirationTtl: 150 * 86400 });
    return json(env, { gems: r.gems, rank: r.rank, type: r.type, period });
  }
  return json(env, { error: 'not_found' }, 404);
}

// ===== 📈 Thống kê người chơi (ẩn danh: chỉ mã người chơi ngẫu nhiên, không có thông tin cá nhân) =====
const vnDay = ms => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10);
async function bump(env, key, ttl) { const n = Number((await env.ORDERS.get(key)) || 0) + 1; await env.ORDERS.put(key, String(n), ttl ? { expirationTtl: ttl } : undefined); return n; }
// Mốc ngày game để xem người chơi đi được bao xa
const REACH = [1, 3, 5, 7, 10, 14, 20, 30, 50, 100];
// Tính năng được đếm (game gửi tên khi người chơi tự bấm mở, mỗi tính năng tối đa 1 lần/người/ngày)
const FEATS = {
  tab_wardrobe: '👗 Tủ đồ', tab_event: '🎪 Sự kiện', tab_pass: '🌙 Season Pass', tab_kho: '📦 Kho', tab_staff: '👥 Nhân viên', tab_reviews: '⭐ Đánh giá',
  tab_equip: '🛠️ Nâng cấp', tab_ads: '📣 Quảng cáo', tab_svc: '🔓 Dịch vụ', tab_report: '📊 Báo cáo', tab_help: '❓ Hướng dẫn',
  openFair: '🎡 Hội chợ', bcOpen: '🦀 Bầu cua', lotOpen: '🎫 Vé số', xdOpen: '🃏 Xì dách', milOpen: '💰 Ai là triệu phú', openMPHub: '🎮 Chơi chung',
  openFriends: '🏘️ Bạn bè', openGuild: '🤝 Hội chủ tiệm', openWheel: '🎡 Vòng quay', openLogin: '📅 Điểm danh', openTitles: '🏅 Danh hiệu',
  openRegulars: '💞 Khách quen', openBook: '📒 Sổ khách', openStory: '📖 Cốt truyện', openMarket: '📈 Chợ đầu mối', openCat: '🐱 Mèo',
  openJuice: '🧃 Quầy nước', openRival: '⚔️ Đối thủ', openOrders: '🛵 Đơn online', openTier: '🏢 Nâng cấp tiệm', openRename: '✏️ Đổi tên',
  payOpen: '💳 Mở nạp', openLeaderboard: '🏆 Bảng xếp hạng', openNews: '📰 Có gì mới', openSaves: '💾 Lưu game', thiefCatch: '🚨 Bắt trộm',
};
async function stats(req, env, path) {
  let now = Date.now(), today = vnDay(now);
  if (req.method === 'POST' && path === '/ping') {
    const b = await req.json().catch(() => null);
    const pid = String(b && b.pid || '').toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(pid)) return json(env, { error: 'bad_request' }, 400);
    if (env.DEV_SPEED && b.now) { now = Number(b.now); today = vnDay(now); }   // chỉ khi chạy thử
    // user:{pid} = {f: ngày đầu, l: ngày gần nhất, r: mốc ngày game đã đạt} (bản cũ chỉ lưu chuỗi ngày gần nhất)
    const raw = await env.ORDERS.get('user:' + pid);
    let u = null; try { u = raw && raw[0] === '{' ? JSON.parse(raw) : null; } catch (e) {}
    const isNew = !raw; if (!u) u = { f: isNew ? today : null, l: isNew ? null : raw, r: -1 };
    let dirty = false;
    if (u.l !== today) {
      if (isNew) { await bump(env, 'stat:total'); await bump(env, 'stat:new:' + today, 400 * 86400); }
      await bump(env, 'stat:dau:' + today, 400 * 86400);
      // 🔁 Giữ chân: người vào game lần đầu ngày F, hôm nay (F + k) quay lại
      if (u.f) { const k = Math.round((Date.parse(today) - Date.parse(u.f)) / 864e5); if (k >= 1 && k <= 30) await bump(env, `stat:act:${u.f}:${k}`, 400 * 86400); }
      u.l = today; dirty = true;
    }
    // 🧭 Đi được bao xa (ngày game)
    const day = Math.max(0, Math.min(100000, Math.round(Number(b.day) || 0)));
    let ri = -1; REACH.forEach((d, i) => { if (day >= d) ri = i; });
    if (ri > (u.r ?? -1)) { for (let i = (u.r ?? -1) + 1; i <= ri; i++) await bump(env, 'stat:reach:' + i); u.r = ri; dirty = true; }
    // 🧩 Tính năng dùng hôm nay
    const fs = Array.isArray(b.f) ? [...new Set(b.f.map(String))].filter(x => FEATS[x]).slice(0, 40) : [];
    for (const f of fs) await bump(env, `stat:feat:${today}:${f}`, 120 * 86400);
    if (dirty) await env.ORDERS.put('user:' + pid, JSON.stringify(u), { expirationTtl: 400 * 86400 });
    return json(env, { ok: true, isNew });
  }
  if (req.method === 'GET' && path === '/stats') {
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = vnDay(now - i * 86400e3);
      days.push({ d, dau: Number((await env.ORDERS.get('stat:dau:' + d)) || 0), nw: Number((await env.ORDERS.get('stat:new:' + d)) || 0) });
    }
    const total = Number((await env.ORDERS.get('stat:total')) || 0);
    const lb = JSON.parse((await env.ORDERS.get('lb:all')) || '[]').length;
    // 🤝 Hội chủ tiệm: chỉ tên, số thành viên, tiến độ tuần (không lộ mã hội, tin nhắn, mã người chơi)
    const gkeys = []; let cur;
    do { const r = await env.ORDERS.list({ prefix: 'guild:', cursor: cur }); gkeys.push(...r.keys.map(k => k.name)); cur = r.list_complete ? null : r.cursor; } while (cur && gkeys.length < 1000);
    const guilds = (await Promise.all(gkeys.slice(0, 50).map(k => env.ORDERS.get(k)))).map(v => { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean)
      .map(g => ({ name: String(g.name || 'Hội chủ tiệm'), n: (g.members || []).length, sold: g.week && g.week.sold || 0, goal: Math.max(5000, 3000 * (g.members || []).length), created: g.created || 0 }))
      .sort((a, b) => b.n - a.n || b.sold - a.sold);
    const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const gMembers = guilds.reduce((a, g) => a + g.n, 0);
    const wk = days.slice(0, 7), sum = (a, k) => a.reduce((x, r) => x + r[k], 0);
    const N = k => env.ORDERS.get(k).then(v => Number(v || 0));
    // 🔁 Giữ chân theo nhóm người chơi mới mỗi ngày (14 ngày gần nhất, bỏ hôm nay)
    const coh = await Promise.all(days.slice(1, 15).map(async r => ({ ...r, a: await Promise.all([1, 3, 7].map(k => N(`stat:act:${r.d}:${k}`))) })));
    const ago = d => Math.round((Date.parse(today) - Date.parse(d)) / 864e5);
    const pct = (a, n) => n ? Math.round(a / n * 100) + '%' : '–';
    const avgRet = k => { const i = [1, 3, 7].indexOf(k), c = coh.filter(r => ago(r.d) >= k && r.nw); const n = c.reduce((x, r) => x + r.nw, 0); return n ? pct(c.reduce((x, r) => x + r.a[i], 0), n) : '–'; };
    // 🧭 Đi được bao xa
    const reach = await Promise.all(REACH.map((_, i) => N('stat:reach:' + i)));
    // 🧩 Tính năng 7 ngày: số lượt người dùng (mỗi người tính 1 lần/ngày)
    const fk = Object.keys(FEATS), fv = await Promise.all(fk.map(f => Promise.all(wk.map(r => N(`stat:feat:${r.d}:${f}`))).then(a => a.reduce((x, y) => x + y, 0))));
    const feats = fk.map((f, i) => ({ f, n: fv[i] })).sort((a, b) => b.n - a.n), fmax = Math.max(1, ...fv), dau7 = sum(wk, 'dau');
    const bar = (v, mx, col) => `<div style="background:#e9f3ec;border-radius:6px;height:10px;overflow:hidden"><div style="width:${Math.round(v / mx * 100)}%;height:100%;background:${col}"></div></div>`;
    const card = (l, v, s) => `<div class="c"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s || ''}</div></div>`;
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thống kê Chợ Lá Xanh</title>
<style>body{margin:0;font:600 15px/1.45 system-ui,sans-serif;background:#f5fbf6;color:#3b2e2a;padding:16px}h1{font-size:22px;margin:0 0 4px}.m{color:#7f8a7f;font-size:13px;margin-bottom:14px}
.g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.c{background:#fff;border:2px solid #cfe6d5;border-radius:14px;padding:10px 12px}.l{font-size:12.5px;color:#7f8a7f}.v{font-size:28px;font-weight:800}.s{font-size:12px;color:#7f8a7f}
table{width:100%;border-collapse:collapse;background:#fff;border:2px solid #cfe6d5;border-radius:14px;overflow:hidden;margin-top:14px;font-size:14px}th,td{padding:7px 10px;border-bottom:1px solid #e3efe6;text-align:right}th:first-child,td:first-child{text-align:left}th{font-size:12px;color:#7f8a7f;background:#f0f8f2}h2{font-size:17px;margin:22px 0 2px}</style></head><body>
<h1>📈 Thống kê người chơi</h1><div class="m">Chợ Lá Xanh · cập nhật lúc ${new Date(now + 7 * 3600e3).toISOString().slice(11, 16)} (giờ VN) · đếm từ khi bật thống kê</div>
<div class="g">${card('👥 Tổng người chơi', total, 'mỗi thiết bị/trình duyệt tính 1 người')}${card('📅 Chơi hôm nay', days[0].dau, `${days[0].nw} người mới`)}${card('🗓️ Lượt chơi 7 ngày', sum(wk, 'dau'), `${sum(wk, 'nw')} người mới`)}${card('🏆 Trên bảng xếp hạng', lb, 'tiệm kinh doanh ≥ 14 ngày')}${card('🤝 Hội chủ tiệm', gkeys.length, `${gMembers} thành viên${gkeys.length > 50 ? ' (50 hội đầu)' : ''}`)}</div>
${guilds.length ? `<table><tr><th>Hội</th><th>Thành viên</th><th>Tuần này</th><th>Lập ngày</th></tr>${guilds.map(g => `<tr><td>${esc(g.name)}</td><td>${g.n}/20</td><td>${g.sold.toLocaleString('vi-VN')}/${g.goal.toLocaleString('vi-VN')}</td><td>${g.created ? vnDay(g.created).slice(8, 10) + '/' + vnDay(g.created).slice(5, 7) : '–'}</td></tr>`).join('')}</table>` : '<div class="m" style="margin-top:12px">🤝 Chưa có hội chủ tiệm nào.</div>'}
<h2>🔁 Người mới có quay lại không?</h2><div class="m">Trong số người vào game lần đầu ngày đó, bao nhiêu % quay lại sau 1 / 3 / 7 ngày. Trung bình: <b>Sau 1 ngày ${avgRet(1)}</b> · <b>3 ngày ${avgRet(3)}</b> · <b>7 ngày ${avgRet(7)}</b></div>
<table><tr><th>Ngày vào</th><th>Người mới</th><th>Sau 1 ngày</th><th>Sau 3 ngày</th><th>Sau 7 ngày</th></tr>${coh.map(r => `<tr><td>${r.d.slice(8, 10)}/${r.d.slice(5, 7)}</td><td>${r.nw}</td>${[1, 3, 7].map((k, i) => `<td>${ago(r.d) >= k ? pct(r.a[i], r.nw) : '<span style="color:#aab">chờ</span>'}</td>`).join('')}</tr>`).join('')}</table>
<h2>🧭 Người chơi đi được bao xa?</h2><div class="m">Số người đã chơi tới ngày game thứ N (tính từ khi bật thống kê này). Chỗ tụt mạnh là chỗ người chơi hay bỏ game.</div>
<table><tr><th>Tới ngày game</th><th>Người chơi</th><th>% so với ngày 1</th><th style="width:38%"></th></tr>${REACH.map((d, i) => `<tr><td>Ngày ${d}</td><td>${reach[i]}</td><td>${pct(reach[i], reach[0])}</td><td>${bar(reach[i], Math.max(1, reach[0]), '#6fc18a')}</td></tr>`).join('')}</table>
<h2>🧩 Tính năng nào được dùng (7 ngày)</h2><div class="m">Số lượt người chơi tự bấm mở mỗi tính năng (mỗi người tính 1 lần/ngày). Tổng lượt chơi 7 ngày: ${dau7}.</div>
<table><tr><th>Tính năng</th><th>Lượt</th><th>% lượt chơi</th><th style="width:38%"></th></tr>${feats.map(x => `<tr><td>${FEATS[x.f]}</td><td>${x.n}</td><td>${pct(x.n, dau7)}</td><td>${bar(x.n, fmax, x.n ? '#e9a23b' : '#ddd')}</td></tr>`).join('')}</table>
<h2>📅 Người chơi theo ngày</h2>
<table><tr><th>Ngày</th><th>Người chơi</th><th>Người mới</th></tr>${days.map(r => `<tr><td>${r.d.slice(8, 10)}/${r.d.slice(5, 7)}</td><td>${r.dau}</td><td>${r.nw}</td></tr>`).join('')}</table>
</body></html>`;
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return json(env, { error: 'not_found' }, 404);
}

export default {
  // Bọc mọi lỗi (vd. vượt hạn mức KV) thành JSON có CORS, để game hiện đúng lỗi thay vì "Load failed"
  async fetch(req, env) {
    try { return await handle(req, env); }
    catch (e) { return json(env, { error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500); }
  },
};

async function handle(req, env) {
  {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(env) });
    if (path.startsWith('/mp/')) { const r = await handleRooms(req, env, url, path, cors(env)); if (r) return r; }
    if (/^\/(shop|inbox|guild)/.test(path)) { const r = await handleSocial(req, env, url, path, (d, s = 200) => json(env, d, s)); if (r) return r; }
    if (path === '/health') { await env.ORDERS.get('stat:total'); return json(env, { ok: true, t: Date.now() }); }

    // Game tạo đơn
    if (req.method === 'POST' && path === '/order') {
      const body = await req.json().catch(() => ({}));
      const code = String(body.code || '').toUpperCase();
      const pack = PACKS[body.pack];
      if (!CODE_RE.test(code) || code.length !== 13 || !pack) return json(env, { error: 'bad_request' }, 400);
      if (await env.ORDERS.get(code)) return json(env, { error: 'exists' }, 409);
      const order = { code, pack: body.pack, vnd: pack.vnd, gems: pack.gems, status: 'pending', at: Date.now() };
      await env.ORDERS.put(code, JSON.stringify(order), { expirationTtl: PENDING_TTL });
      return json(env, { ok: true, vnd: order.vnd, gems: order.gems });
    }

    // Webhook SePay: báo có giao dịch vào tài khoản
    if (req.method === 'POST' && path === '/sepay') {
      const auth = req.headers.get('authorization') || '';
      if (!env.SEPAY_API_KEY || !safeEq(auth, 'Apikey ' + env.SEPAY_API_KEY)) return json(env, { success: false }, 401);
      const tx = await req.json().catch(() => null);
      if (!tx || tx.transferType !== 'in') return json(env, { success: true });
      const m = String(tx.content || tx.description || '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(CODE_RE);
      if (!m) return json(env, { success: true });
      const raw = await env.ORDERS.get(m[0]);
      if (!raw) return json(env, { success: true });
      const order = JSON.parse(raw);
      if (order.status === 'pending' && Number(tx.transferAmount) >= order.vnd) {
        order.status = 'paid';
        order.txId = tx.id;
        order.paidAt = Date.now();
        await env.ORDERS.put(order.code, JSON.stringify(order), { expirationTtl: DONE_TTL });
      }
      return json(env, { success: true });
    }

    // Game hỏi trạng thái đơn
    let m = path.match(/^\/order\/(CLX[A-Z0-9]{10})$/);
    if (req.method === 'GET' && m) {
      const raw = await env.ORDERS.get(m[1]);
      if (!raw) return json(env, { status: 'missing' });
      const o = JSON.parse(raw);
      return json(env, { status: o.status === 'claimed' ? 'claimed' : o.status });
    }

    // Game nhận kim cương (mỗi đơn chỉ nhận 1 lần)
    m = path.match(/^\/order\/(CLX[A-Z0-9]{10})\/claim$/);
    if (req.method === 'POST' && m) {
      const raw = await env.ORDERS.get(m[1]);
      if (!raw) return json(env, { error: 'missing' }, 404);
      const o = JSON.parse(raw);
      if (o.status !== 'paid') return json(env, { error: o.status }, 409);
      o.status = 'claimed';
      o.claimedAt = Date.now();
      await env.ORDERS.put(o.code, JSON.stringify(o), { expirationTtl: DONE_TTL });
      return json(env, { gems: o.gems });
    }

    // Mã lưu ngắn: lưu bản game (JSON) 30 ngày, trả về mã 8 ký tự
    if (req.method === 'POST' && path === '/save') {
      const text = await req.text();
      if (text.length > 600000) return json(env, { error: 'too_large' }, 413);
      try { const d = JSON.parse(text); if (!d || !d.market || !d.day) throw 0; } catch (e) { return json(env, { error: 'bad_save' }, 400); }
      const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 5; i++) {
        code = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => A[b % 32]).join('');
        if (!(await env.ORDERS.get('save:' + code))) break;
      }
      await env.ORDERS.put('save:' + code, text, { expirationTtl: 30 * 24 * 3600 });
      return json(env, { code, days: 30 });
    }
    m = path.match(/^\/save\/([A-Z0-9]{8})$/);
    if (req.method === 'GET' && m) {
      const raw = await env.ORDERS.get('save:' + m[1]);
      if (!raw) return json(env, { error: 'missing' }, 404);
      return new Response(raw, { headers: { 'content-type': 'application/json', ...cors(env) } });
    }

    // 🏆 Bảng xếp hạng: chỉ tiệm kinh doanh từ LB_MIN_DAY ngày, xếp theo tổng vốn; có bảng tuần/tháng (giờ VN) và thưởng top 10
    if (path === '/admin' || path.startsWith('/admin/')) { const r = await handleAdmin(req, env, url, path, { json: (d, s = 200) => json(env, d, s), safeEq, periodInfo }); if (r) return r; }
    if (path === '/lb' || path.startsWith('/lb/')) return leaderboard(req, env, path, url);
    if (path === '/ping' || path === '/stats') return stats(req, env, path);
    // 🎫 Vé số: số trúng mỗi ngày = HMAC bí mật theo ngày, chỉ trả sau 19:00 giờ VN
    if (req.method === 'GET' && path === '/lot') {
      const d = url.searchParams.get('d') || '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return json(env, { error: 'bad_request' }, 400);
      if (Date.now() < Date.parse(d + 'T19:00:00Z') - 7 * 3600e3) return json(env, { pending: true });
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.LOT_SECRET || env.SEPAY_API_KEY || 'clx-lot'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('lot:' + d)));
      const n = ((sig[0] << 24 >>> 0) + (sig[1] << 16) + (sig[2] << 8) + sig[3]) % 1000000;
      return new Response(JSON.stringify({ d, num: String(n).padStart(6, '0') }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400', ...cors(env) } });
    }

    return json(env, { error: 'not_found' }, 404);
  }
}
