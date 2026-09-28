// Máy chủ nạp kim cương cho Chợ Lá Xanh — Cloudflare Worker + KV.
// Luồng: game tạo đơn (POST /order) → người chơi chuyển khoản VietQR với nội dung = mã đơn
// → SePay báo tiền về (POST /sepay) → game hỏi trạng thái (GET /order/:code) → nhận kim cương (POST /order/:code/claim).
// Giá gói và số kim cương chỉ lấy ở đây, không tin số liệu gửi từ trình duyệt.

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

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(env) });

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

    // 🏆 Bảng xếp hạng: lưu top 100 theo tổng tài sản (1 dòng mỗi người chơi)
    if (req.method === 'POST' && path === '/lb') {
      const b = await req.json().catch(() => null);
      const pid = String(b && b.pid || '').toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(pid)) return json(env, { error: 'bad_request' }, 400);
      const clean = (s, n) => String(s || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n);
      const row = {
        pid, shop: clean(b.shop, 28) || 'Tiệm tạp hóa',
        worth: Math.max(0, Math.min(1e13, Math.round(Number(b.worth) || 0))),
        day: Math.max(1, Math.min(100000, Math.round(Number(b.day) || 1))),
        rep: Math.max(0, Math.min(100, Math.round(Number(b.rep) || 0))),
        stars: Math.max(0, Math.min(5, Math.round((Number(b.stars) || 0) * 10) / 10)),
        at: Date.now(),
      };
      const list = JSON.parse((await env.ORDERS.get('lb')) || '[]').filter(r => r.pid !== pid);
      list.push(row);
      list.sort((a, c) => c.worth - a.worth);
      const top = list.slice(0, 100);
      await env.ORDERS.put('lb', JSON.stringify(top));
      const rank = top.findIndex(r => r.pid === pid) + 1;
      return json(env, { ok: true, rank: rank || null, total: top.length });
    }
    if (req.method === 'GET' && path === '/lb') {
      const list = JSON.parse((await env.ORDERS.get('lb')) || '[]');
      return json(env, { list: list.slice(0, 50), total: list.length });
    }

    return json(env, { error: 'not_found' }, 404);
  },
};
