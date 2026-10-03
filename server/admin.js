// 🔐 Kiểm tra bảng xếp hạng: lịch sử gửi điểm từng tiệm + tự gắn cờ bất thường + trang quản trị có mật khẩu.
// Trang /admin chỉ dành cho chủ game: trong game không có nút dẫn tới, và mọi dữ liệu cần mật khẩu ADMIN_KEY
// (đặt bằng: npx wrangler secret put ADMIN_KEY, hoặc Cloudflare → Worker → Settings → Variables and Secrets).

const HIST_MAX = 60;                 // giữ 60 lần gửi gần nhất mỗi tiệm
// Lãi mỗi ngày tăng dần theo tuổi tiệm (siêu thị, chi nhánh, tập đoàn): ngày 1 ~25tr, ngày 200 ~625tr
const MAX_PER_DAY = d => 25e6 + 3e6 * Math.max(0, d);    // vốn tăng tối đa hợp lệ mỗi ngày game (khớp trần của bảng xếp hạng)
const WARN_PER_DAY = d => 20e6 + 1.5e6 * Math.max(0, d); // tăng nhanh hơn mức này thì "nên xem"
// Trần vốn trên bảng xếp hạng ở ngày d = tổng MAX_PER_DAY từ đầu (ngày 209 ~70 tỷ)
export const lbCap = d => 40e6 + 25e6 * d + 1.5e6 * d * d;
const OLD_CAP_UNTIL = Date.UTC(2026, 9, 3, 12);           // điểm gửi trước lúc nới trần
const warnCap = d => 40e6 + 20e6 * d + 0.75e6 * d * d;
const MIN_DAY_MIN = 1.35;            // một ngày bán đủ giờ ở tốc độ 4x mất ~1,5 phút thật (chừa 10%)
const SLACK = 20e6;                  // chừa sai số (thưởng sự kiện, bán chi nhánh…)
const LV = { '': 0, ok: 0, warn: 1, bad: 2 };
const fm = n => n >= 1e9 ? (n / 1e9).toFixed(2).replace('.', ',') + ' tỷ' : String(Math.round(n / 1e5) / 10).replace('.', ',') + 'tr';

export const histKey = pid => 'lbh:' + pid;

// Mức cờ hiện tại: lý do mới nhất sau lần duyệt gần nhất
export function histFlag(h) {
  if (!h) return '';
  if (h.ban) return 'bad';
  let lv = 0;
  for (const w of h.why || []) if (!h.okAt || w.t > h.okAt) lv = Math.max(lv, LV[w.lv]);
  return lv === 2 ? 'bad' : lv === 1 ? 'warn' : h.okAt ? 'ok' : '';
}

// Ghi một lần gửi điểm vào lịch sử, trả về lịch sử mới (chưa lưu)
export function histAdd(h, row, now) {
  h = h || { pid: row.pid, first: now, pts: [], why: [] };
  let last = h.pts[h.pts.length - 1]; const why = [];
  // Điểm cũ bị trần cũ (40tr + 25tr/ngày) cắt bớt thì không dùng làm mốc, tránh gắn cờ oan khi trần được nới
  if (last && last.t < OLD_CAP_UNTIL && last.worth >= 40e6 + 25e6 * last.day - 1e6 && row.worth > last.worth) last = null;
  if (!last) {
    if (row.worth > warnCap(row.day)) why.push(['warn', `Lần đầu thấy đã có vốn ${fm(row.worth)} ở ngày ${row.day} (cao hơn mức thường gặp).`]);
  } else {
    const dd = row.day - last.day, dw = row.worth - last.worth, mx = MAX_PER_DAY(row.day), wn = WARN_PER_DAY(row.day), mins = Math.max(0.5, (now - last.t) / 60000);
    if (dd < 0) why.push(['warn', `Ngày game lùi từ ${last.day} về ${row.day} (có thể tải bản lưu cũ hoặc đổi thiết bị).`]);
    // Số ngày có thể bán đủ giờ trong khoảng thời gian thật này (ngày nghỉ bán/đóng sớm thì qua nhanh nhưng không có lãi)
    const open = Math.min(Math.max(dd, 0), mins / MIN_DAY_MIN), fast = dd > 3 && mins < dd * MIN_DAY_MIN;
    if (dw > SLACK && dd <= 0) why.push(['bad', `Vốn tăng ${fm(dw)} nhưng ngày game không tăng (ngày ${last.day} → ${row.day}).`]);
    else if (dw > mx * open + SLACK) why.push(['bad', fast
      ? `${dd} ngày game trôi qua chỉ trong ${Math.round(mins)} phút thật (chơi liên tục ở 4x cần ≥ ${Math.round(dd * MIN_DAY_MIN)} phút) mà vốn vẫn tăng ${fm(dw)}.`
      : `Vốn tăng ${fm(dw)} trong ${dd} ngày game (tối đa hợp lệ ~${fm(mx * dd + SLACK)}).`]);
    else if (fast && dw > 0.4 * mx * open + SLACK) why.push(['bad', `${dd} ngày game trôi qua chỉ trong ${Math.round(mins)} phút thật (chơi liên tục ở 4x cần ≥ ${Math.round(dd * MIN_DAY_MIN)} phút) mà vốn vẫn tăng ${fm(dw)}.`]);
    else if (fast) why.push(['warn', `${dd} ngày game trôi qua trong ${Math.round(mins)} phút thật: nhanh hơn chơi liên tục ở 4x, chỉ có thể nếu nghỉ bán/đóng cửa sớm nhiều ngày.`]);
    else if (dd > 0 && dw > wn * dd + SLACK) why.push(['warn', `Vốn tăng nhanh: ${fm(dw)} trong ${dd} ngày game (~${fm(dw / dd)}/ngày).`]);
  }
  h.shop = row.shop;
  h.pts = [...h.pts, { t: now, day: row.day, worth: row.worth, rep: row.rep, stars: row.stars, f: why.length ? why.reduce((a, w) => Math.max(a, LV[w[0]]), 0) : 0 }].slice(-HIST_MAX);
  h.why = [...(h.why || []), ...why.map(([lv, msg]) => ({ t: now, lv, msg }))].slice(-30);
  return h;
}

// ---------- API quản trị ----------
function authed(req, env, safeEq) {
  const k = req.headers.get('x-admin-key') || '';
  return !!env.ADMIN_KEY && env.ADMIN_KEY.length >= 8 && safeEq(k, env.ADMIN_KEY);
}

export async function handleAdmin(req, env, url, path, { json, safeEq, periodInfo }) {
  if (path === '/admin') return new Response(ADMIN_HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'x-frame-options': 'DENY' } });
  if (!path.startsWith('/admin/')) return null;
  if (!env.ADMIN_KEY) return json({ error: 'no_key' }, 503);
  if (!authed(req, env, safeEq)) { await new Promise(r => setTimeout(r, 800)); return json({ error: 'auth' }, 401); }
  const KV = env.ORDERS, P = periodInfo(Date.now());
  const get = async k => JSON.parse((await KV.get(k)) || 'null');
  const boardKey = b => b === 'all' || b === 'flag' ? 'lb:all' : b === 'month' ? 'lb:' + P.month : 'lb:' + P.week;

  if (req.method === 'GET' && path === '/admin/lb') {
    const board = url.searchParams.get('board') || 'week';
    let list = (await get(boardKey(board))) || [];
    const hs = await Promise.all(list.map(r => get(histKey(r.pid))));
    list = list.map((r, i) => ({ ...r, flag: histFlag(hs[i]), n: hs[i] ? hs[i].pts.length : 0, first: hs[i] ? hs[i].first : null, ban: !!(hs[i] && hs[i].ban) }));
    if (board === 'flag') list = list.filter(r => r.flag === 'warn' || r.flag === 'bad');
    const bans = (await get('lbban')) || [];
    return json({ board, period: board === 'month' ? P.month : board === 'week' ? P.week : null, list, bans });
  }
  if (req.method === 'GET' && path === '/admin/shop') {
    const pid = String(url.searchParams.get('pid') || '').toUpperCase();
    const h = await get(histKey(pid)), row = ((await get('lb:all')) || []).find(r => r.pid === pid) || null;
    return json({ pid, row, hist: h, flag: histFlag(h) });
  }
  if (req.method === 'POST' && path === '/admin/act') {
    const b = await req.json().catch(() => ({})), pid = String(b.pid || '').toUpperCase(), now = Date.now();
    if (!/^[A-Z0-9]{6}$/.test(pid)) return json({ error: 'bad' }, 400);
    const h = (await get(histKey(pid))) || { pid, first: null, pts: [], why: [] };
    let bans = (await get('lbban')) || [];
    if (b.act === 'ok') { h.okAt = now; h.ban = false; bans = bans.filter(x => x.pid !== pid); }
    else if (b.act === 'ban') {
      h.ban = true;
      for (const k of ['lb:all', 'lb:' + P.week, 'lb:' + P.month]) {
        const l = (await get(k)) || []; const r = l.find(x => x.pid === pid);
        if (r) { h.shop = h.shop || r.shop; await KV.put(k, JSON.stringify(l.filter(x => x.pid !== pid)), k === 'lb:all' ? undefined : { expirationTtl: k.startsWith('lb:W') ? 70 * 86400 : 120 * 86400 }); }
      }
      if (!bans.some(x => x.pid === pid)) bans.push({ pid, shop: h.shop || '', at: now });
    } else if (b.act === 'unban') { h.ban = false; bans = bans.filter(x => x.pid !== pid); }
    else return json({ error: 'bad' }, 400);
    await KV.put(histKey(pid), JSON.stringify(h), { expirationTtl: 400 * 86400 });
    await KV.put('lbban', JSON.stringify(bans.slice(-200)));
    return json({ ok: true, flag: histFlag(h), ban: !!h.ban });
  }
  return json({ error: 'not_found' }, 404);
}

const ADMIN_HTML = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Kiểm tra BXH</title><style>
:root{--bg:#f3f6f1;--card:#fff;--ink:#1f2a1f;--mut:#6b7a6b;--line:#e2e8df;--g:#2f8f46;--r:#d0453a;--y:#e3a21a;--b:#2d6fd0}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:14px 16px 40px}h1{font-size:20px;margin:4px 0 2px}.sub{color:var(--mut);font-size:13px;margin-bottom:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:12px}
.login{display:flex;gap:8px}.login input{flex:1;min-width:0;padding:10px;border:1px solid var(--line);border-radius:10px;font-size:16px}
button{border:0;border-radius:10px;padding:9px 14px;font-weight:600;cursor:pointer;background:var(--g);color:#fff;font-size:14px}
button.ghost{background:#eef3ec;color:var(--ink)}button.red{background:var(--r)}
.tabs{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}.tabs button{background:#eef3ec;color:var(--ink);padding:6px 12px}.tabs button.on{background:var(--g);color:#fff}
.row{display:flex;align-items:center;gap:10px;padding:10px 6px;border-bottom:1px solid var(--line);cursor:pointer}.row:last-child{border:0}
.rk{width:26px;font-weight:700;color:var(--mut);text-align:center}.nm{flex:1;min-width:0}.nm b{overflow-wrap:anywhere}.nm small{display:block;color:var(--mut)}
.w{font-weight:700;text-align:right;white-space:nowrap}
.tag{display:inline-block;font-size:11px;font-weight:700;border-radius:20px;padding:2px 8px;margin-left:4px;white-space:nowrap}
.ok{background:#e3f4e7;color:var(--g)}.warn{background:#fff1d1;color:#9a6a00}.bad{background:#fde3e0;color:var(--r)}.none{background:#eef1f4;color:#667}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.st{background:#f7faf6;border-radius:10px;padding:8px;text-align:center}.st b{display:block;font-size:16px}.st small{color:var(--mut);font-size:11px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:7px 6px;border-bottom:1px solid var(--line);text-align:right}th:first-child,td:first-child{text-align:left}th{color:var(--mut);font-weight:600;font-size:12px}
tr.f1 td{background:#fff6e0}tr.f2 td{background:#fdecea}.why{border-radius:10px;padding:8px 10px;font-size:13px;margin:8px 0;background:#fdecea;color:#8a2a22}.why.w{background:#fff6e0;color:#7a5a00}
.why small{opacity:.75}.acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}svg{width:100%;height:150px;display:block}.back{background:none;color:var(--b);padding:0;margin-bottom:6px}
.err{color:var(--r);font-size:13px;margin-top:6px}.empty{color:var(--mut);padding:14px;text-align:center}
@media(max-width:520px){.grid{grid-template-columns:repeat(2,1fr)}.hide-s{display:none}}
</style></head><body><div class="wrap">
<div id="login" class="card"><h1>🔐 Kiểm tra bảng xếp hạng</h1><div class="sub">Trang riêng cho chủ game. Nhập mật khẩu quản trị (ADMIN_KEY).</div>
<form class="login" onsubmit="event.preventDefault();go()"><input id="pw" type="password" autocomplete="current-password" placeholder="Mật khẩu quản trị"><button>Vào</button></form><div id="lerr" class="err"></div></div>
<div id="main" hidden><div style="display:flex;justify-content:space-between;align-items:center"><h1>📊 Kiểm tra BXH</h1><button class="ghost" onclick="logout()">Thoát</button></div>
<div class="sub">Bấm vào một tiệm để xem lịch sử từng lần gửi điểm. Tiệm bị 🚩 sẽ không được nhận 💎 thưởng top cho tới khi bạn duyệt.</div>
<div class="tabs" id="tabs"></div><div class="card" id="list"></div><div id="bans"></div></div>
<div id="detail" hidden></div></div>
<script>
const $=id=>document.getElementById(id);let KEY='';try{KEY=sessionStorage.getItem('clx-admin')||''}catch(e){}
let BOARD='week';const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fm=n=>n>=1e9?(n/1e9).toFixed(2).replace('.',',')+' tỷ':(Math.round(n/1e5)/10).toString().replace('.',',')+'tr';
const dt=t=>t?new Date(t).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const TAG={ok:'<span class="tag ok">✅ Đã duyệt</span>',warn:'<span class="tag warn">🟡 Nên xem</span>',bad:'<span class="tag bad">🚩 Nghi gian lận</span>','':'<span class="tag ok">✅ Bình thường</span>',none:'<span class="tag none">⏳ Chưa có lịch sử</span>'};
const tg=r=>r.ban?'<span class="tag bad">🚫 Đã gỡ</span>':(!r.n&&!r.flag?TAG.none:TAG[r.flag||'']);
async function api(p,o={}){const r=await fetch(p,{...o,headers:{'content-type':'application/json','x-admin-key':KEY}});if(r.status===401)throw new Error('auth');const d=await r.json();if(d.error==='no_key')throw new Error('no_key');return d}
async function go(){const v=$('pw').value.trim();if(v)KEY=v;$('lerr').textContent='';try{await load();try{sessionStorage.setItem('clx-admin',KEY)}catch(e){};$('login').hidden=true;$('main').hidden=false}catch(e){$('lerr').textContent=e.message==='no_key'?'Máy chủ chưa đặt ADMIN_KEY.':e.message==='auth'?'Sai mật khẩu.':'Lỗi kết nối: '+e.message}}
function logout(){KEY='';try{sessionStorage.removeItem('clx-admin')}catch(e){};location.reload()}
function tabs(nFlag){$('tabs').innerHTML=[['week','Tuần'],['month','Tháng'],['all','Mọi thời đại'],['flag','⚠️ Bị gắn cờ'+(nFlag!=null?' ('+nFlag+')':'')]].map(([k,l])=>'<button class="'+(BOARD===k?'on':'')+'" onclick="BOARD=\\''+k+'\\';load()">'+l+'</button>').join('')}
async function load(){const d=await api('/admin/lb?board='+BOARD);let nf=null;if(BOARD!=='flag'){try{nf=(await api('/admin/lb?board=flag')).list.length}catch(e){}}else nf=d.list.length;tabs(nf);
$('list').innerHTML=d.list.length?d.list.map((r,i)=>'<div class="row" onclick="det(\\''+r.pid+'\\')"><div class="rk">'+(i+1)+'</div><div class="nm"><b>'+esc(r.shop)+'</b> '+tg(r)+'<small>Mã '+r.pid+' · Ngày '+r.day+' · ⭐'+(r.stars||'–')+' · 💚'+r.rep+' · '+r.n+' lần gửi</small></div><div class="w">'+fm(r.worth)+'</div></div>').join(''):'<div class="empty">Chưa có tiệm nào'+(BOARD==='flag'?' bị gắn cờ 🎉':'')+'.</div>';
$('bans').innerHTML=d.bans&&d.bans.length?'<div class="card"><b>🚫 Tiệm đã gỡ khỏi BXH</b>'+d.bans.map(b=>'<div class="row" onclick="det(\\''+b.pid+'\\')"><div class="nm"><b>'+esc(b.shop||b.pid)+'</b><small>Mã '+b.pid+' · gỡ lúc '+dt(b.at)+'</small></div></div>').join('')+'</div>':''}
function chart(p){if(p.length<2)return'';const W=700,H=150,mx=Math.max(...p.map(x=>x.worth))||1,t0=p[0].t,t1=p[p.length-1].t||t0+1;const X=t=>20+(t-t0)/(t1-t0||1)*(W-40),Y=w=>H-15-w/mx*(H-35);
return'<b>Tổng vốn theo thời gian thật</b><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none"><polyline fill="none" stroke="#2f8f46" stroke-width="3" points="'+p.map(x=>X(x.t)+','+Y(x.worth)).join(' ')+'"/>'+p.map(x=>'<circle cx="'+X(x.t)+'" cy="'+Y(x.worth)+'" r="5" fill="'+(x.f===2?'#d0453a':x.f===1?'#e3a21a':'#2f8f46')+'"/>').join('')+'</svg>'}
async function det(pid){const d=await api('/admin/shop?pid='+pid),h=d.hist,r=d.row||{},p=h?h.pts:[];$('main').hidden=true;$('detail').hidden=false;window.scrollTo(0,0);
const last=p[p.length-1]||r,why=h?(h.why||[]).filter(w=>!h.okAt||w.t>h.okAt):[];
$('detail').innerHTML='<button class="back" onclick="back()">← Quay lại danh sách</button><div class="card"><h1>'+esc((h&&h.shop)||r.shop||pid)+' '+(h&&h.ban?'<span class="tag bad">🚫 Đã gỡ</span>':h?TAG[d.flag||'']:TAG.none)+'</h1><div class="sub">Mã người chơi '+pid+' · lần đầu có lịch sử: '+dt(h&&h.first)+(h&&h.okAt?' · duyệt lúc '+dt(h.okAt):'')+'</div>'
+'<div class="grid"><div class="st"><b>'+(last.day||'–')+'</b><small>Ngày game</small></div><div class="st"><b>'+(last.worth!=null?fm(last.worth):'–')+'</b><small>Tổng vốn</small></div><div class="st"><b>'+p.length+'</b><small>Lần gửi điểm</small></div><div class="st"><b>⭐'+(last.stars||'–')+'</b><small>Sao</small></div></div>'
+(!h||!p.length?'<div class="sub">⏳ Tiệm này chưa gửi điểm kể từ khi bật lịch sử. Lịch sử sẽ có sau lần gửi tiếp theo (tối đa 20 phút/lần khi người chơi đang chơi).</div>':why.length?'<div class="why'+(why.some(w=>w.lv==='bad')?'':' w')+'"><b>Vì sao bị đánh dấu:</b>'+why.map(w=>'<br>• '+esc(w.msg)+' <small>('+dt(w.t)+')</small>').join('')+'</div>':'<div class="sub">✅ Tốc độ tăng ngày và tăng vốn đều trong mức chơi thật.</div>')
+chart(p)+(p.length?'<table><tr><th>Thời gian thật</th><th>Ngày game</th><th>Tổng vốn</th><th class="hide-s">Tăng thêm</th></tr>'+p.map((x,k)=>'<tr class="f'+(x.f||0)+'"><td>'+dt(x.t)+'</td><td>'+x.day+'</td><td>'+fm(x.worth)+'</td><td class="hide-s">'+(k?(x.worth>=p[k-1].worth?'+':'−')+fm(Math.abs(x.worth-p[k-1].worth)):'—')+'</td></tr>').reverse().join('')+'</table>':'')
+'<div class="acts">'+(h&&h.ban?'<button class="ghost" onclick="act(\\''+pid+'\\',\\'unban\\')">↩️ Cho lên BXH lại</button>':'<button class="ghost" onclick="act(\\''+pid+'\\',\\'ok\\')">✅ Duyệt, cho nhận thưởng</button><button class="red" onclick="act(\\''+pid+'\\',\\'ban\\')">🚫 Gỡ khỏi BXH</button>')+'</div></div>'}
async function act(pid,a){if(a==='ban'&&!confirm('Gỡ tiệm này khỏi bảng xếp hạng? Tiệm sẽ không lên BXH và không nhận thưởng cho tới khi bạn cho lên lại.'))return;await api('/admin/act',{method:'POST',body:JSON.stringify({pid,act:a})});await det(pid)}
function back(){$('detail').hidden=true;$('main').hidden=false;load()}
if(KEY)go();
</script></body></html>`;
