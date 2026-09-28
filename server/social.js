// 🏘️ Ghé tiệm bạn bè & 🤝 Hội chủ tiệm (lưu trong KV ORDERS).
import { cleanChat } from './rooms.js';

const DAY = 86400;
const vnDay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
function weekKey() { const d = new Date(Date.now() + 7 * 3600e3); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const w = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - w);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `W${t.getUTCFullYear()}-${String(Math.ceil(((t - y) / 864e5 + 1) / 7)).padStart(2, '0')}`; }
const ID = s => /^[A-Z0-9]{4,8}$/.test(s || '');
const clean = (s, n) => String(s || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n);
const GIFT_GEMS = 5;
const G_MILES = [[0.25, 20], [0.5, 50], [1, 150]];

export async function handleSocial(req, env, url, path, json) {
  const KV = env.ORDERS, get = async k => JSON.parse((await KV.get(k)) || 'null'), put = (k, v, ttl) => KV.put(k, JSON.stringify(v), ttl ? { expirationTtl: ttl } : undefined);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const me = String(body.me || body.pid || url.searchParams.get('me') || '').toUpperCase();

  // ---------- Tiệm bạn bè ----------
  if (path === '/shop/pub' && req.method === 'POST') { if (!ID(me)) return json({ error: 'bad' }, 400);
    const old = (await get('shop:' + me)) || { likes: 0, notes: [] };
    const s = { ...old, pid: me, name: clean(body.name, 28) || 'Tiệm tạp hóa', day: +body.day || 1, worth: Math.round(+body.worth || 0), rep: Math.round(+body.rep || 0), stars: +body.stars || 0,
      tier: Math.max(0, Math.min(3, +body.tier || 0)), title: clean(body.title, 12), look: body.look && typeof body.look === 'object' ? body.look : null, at: Date.now() };
    await put('shop:' + me, s, 90 * DAY); return json({ ok: true }); }
  let m = path.match(/^\/shop\/([A-Z0-9]{4,8})(\/(like|gift|note))?$/);
  if (m) { const id = m[1], act = m[3], s = await get('shop:' + id); if (!s) return json({ error: 'missing' }, 404); const d = vnDay();
    if (!act) { const mine = ID(me) ? { liked: !!(await KV.get(`lk:${d}:${me}:${id}`)), gifted: !!(await KV.get(`gf:${d}:${me}:${id}`)), noted: !!(await KV.get(`nt:${d}:${me}:${id}`)) } : {};
      return json({ shop: { ...s, notes: (s.notes || []).slice(-10).reverse() }, mine }); }
    if (!ID(me) || me === id) return json({ error: 'bad' }, 400);
    if (act === 'like') { if (await KV.get(`lk:${d}:${me}:${id}`)) return json({ error: 'done' }, 409); await KV.put(`lk:${d}:${me}:${id}`, '1', { expirationTtl: 2 * DAY }); s.likes = (s.likes || 0) + 1; await put('shop:' + id, s, 90 * DAY); return json({ ok: true, likes: s.likes }); }
    if (act === 'gift') { if (await KV.get(`gf:${d}:${me}:${id}`)) return json({ error: 'done' }, 409); await KV.put(`gf:${d}:${me}:${id}`, '1', { expirationTtl: 2 * DAY });
      const inbox = (await get('inbox:' + id)) || []; inbox.push({ from: me, name: clean(body.name, 28), d }); await put('inbox:' + id, inbox.slice(-30), 30 * DAY); return json({ ok: true, gems: GIFT_GEMS }); }
    if (act === 'note') { const text = cleanChat(body.text); if (!text) return json({ error: 'empty' }, 400); if (await KV.get(`nt:${d}:${me}:${id}`)) return json({ error: 'done' }, 409);
      await KV.put(`nt:${d}:${me}:${id}`, '1', { expirationTtl: 2 * DAY }); s.notes = [...(s.notes || []), { name: clean(body.name, 28), text, d }].slice(-20); await put('shop:' + id, s, 90 * DAY); return json({ ok: true }); } }
  if (path === '/inbox') { if (!ID(me)) return json({ error: 'bad' }, 400); const inbox = (await get('inbox:' + me)) || [];
    if (req.method === 'POST') { if (!inbox.length) return json({ gifts: [], gems: 0 }); await KV.delete('inbox:' + me); const n = Math.min(inbox.length, 10); return json({ gifts: inbox, gems: n * GIFT_GEMS }); }
    return json({ gifts: inbox }); }

  // ---------- Hội chủ tiệm ----------
  const loadG = async id => { const g = await get('guild:' + id); if (!g) return null; const wk = weekKey(); if (!g.week || g.week.key !== wk) { g.last = g.week || null; g.week = { key: wk, sold: 0, contrib: {} }; } return g; };
  const goal = g => Math.max(5000, 3000 * g.members.length);
  const pub = (g, pid) => ({ id: g.id, name: g.name, owner: g.owner, members: g.members, week: g.week, goal: goal(g), chat: (g.chat || []).slice(-30), me: pid, lastWeek: g.last ? { key: g.last.key, sold: g.last.sold } : null });
  if (path === '/guild' && req.method === 'GET') { if (!ID(me)) return json({ error: 'bad' }, 400); const id = await KV.get('gm:' + me); if (!id) return json({ guild: null }); const g = await loadG(id); if (!g) { await KV.delete('gm:' + me); return json({ guild: null }); }
    const claimed = {}; for (const [i] of G_MILES.entries()) claimed[i] = !!(await KV.get(`gc:${g.week.key}:${g.id}:${me}:${i}`)); return json({ guild: pub(g, me), claimed }); }
  if (path === '/guild/new' && req.method === 'POST') { if (!ID(me)) return json({ error: 'bad' }, 400); if (await KV.get('gm:' + me)) return json({ error: 'in' }, 409);
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let id; do id = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * 32)]).join(''); while (await KV.get('guild:' + id));
    const g = { id, name: clean(body.gname, 28) || 'Hội chủ tiệm', owner: me, members: [{ pid: me, name: clean(body.name, 28) }], created: Date.now(), week: { key: weekKey(), sold: 0, contrib: {} }, chat: [] };
    await put('guild:' + id, g); await KV.put('gm:' + me, id); return json({ guild: pub(g, me), claimed: {} }); }
  if (path === '/guild/join' && req.method === 'POST') { const id = String(body.id || '').toUpperCase(); if (!ID(me) || !ID(id)) return json({ error: 'bad' }, 400); if (await KV.get('gm:' + me)) return json({ error: 'in' }, 409);
    const g = await loadG(id); if (!g) return json({ error: 'missing' }, 404); if (g.members.length >= 20) return json({ error: 'full' }, 409);
    g.members.push({ pid: me, name: clean(body.name, 28) }); g.chat = [...(g.chat || []), { sys: 1, text: `🙌 ${clean(body.name, 28)} vừa vào hội`, t: Date.now() }].slice(-30); await put('guild:' + id, g); await KV.put('gm:' + me, id); return json({ guild: pub(g, me), claimed: {} }); }
  const myG = async () => { const id = await KV.get('gm:' + me); return id ? loadG(id) : null; };
  if (path === '/guild/leave' && req.method === 'POST') { const g = await myG(); if (!g) return json({ ok: true }); g.members = g.members.filter(x => x.pid !== me); await KV.delete('gm:' + me);
    if (!g.members.length) await KV.delete('guild:' + g.id); else { if (g.owner === me) g.owner = g.members[0].pid; await put('guild:' + g.id, g); } return json({ ok: true }); }
  if (path === '/guild/add' && req.method === 'POST') { const g = await myG(); if (!g) return json({ error: 'none' }, 404); const n = Math.max(0, Math.min(3000, Math.round(+body.sold || 0))); const d = vnDay();
    if (await KV.get(`ga:${d}:${me}`)) return json({ ok: true, dup: true }); await KV.put(`ga:${d}:${me}`, '1', { expirationTtl: 2 * DAY });
    g.week.sold += n; g.week.contrib[me] = (g.week.contrib[me] || 0) + n; await put('guild:' + g.id, g); return json({ ok: true, week: g.week }); }
  if (path === '/guild/claim' && req.method === 'POST') { const g = await myG(); if (!g) return json({ error: 'none' }, 404); const i = +body.i; const ms = G_MILES[i]; if (!ms) return json({ error: 'bad' }, 400);
    if (g.week.sold < goal(g) * ms[0]) return json({ error: 'not_yet' }, 409); const k = `gc:${g.week.key}:${g.id}:${me}:${i}`; if (await KV.get(k)) return json({ error: 'done' }, 409); await KV.put(k, '1', { expirationTtl: 20 * DAY }); return json({ gems: ms[1] }); }
  if (path === '/guild/chat' && req.method === 'POST') { const g = await myG(); if (!g) return json({ error: 'none' }, 404); const text = cleanChat(body.text); if (!text) return json({ error: 'empty' }, 400);
    const nm = (g.members.find(x => x.pid === me) || {}).name || '?'; g.chat = [...(g.chat || []), { name: nm, text, t: Date.now() }].slice(-30); await put('guild:' + g.id, g); return json({ ok: true, chat: g.chat }); }
  return null;
}
