// 共通: 設定の取得と「調整中」差し込み。HTMLは textContent で入れる（ユーザー入力を innerHTML に入れない）
export async function api(path, opts) {
  const res = await fetch(path, { credentials: 'same-origin', ...opts });
  let data = null;
  try { data = await res.json(); } catch { /* 非JSON */ }
  return { ok: res.ok, status: res.status, data };
}
export const TBD = '調整中';
export function get(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
export function fillConfig(cfg, root = document) {
  root.querySelectorAll('[data-cfg]').forEach((el) => {
    const v = get(cfg, el.dataset.cfg);
    el.textContent = v ? String(v) : TBD;
    el.classList.toggle('tbd', !v);
  });
  const e = cfg.event;
  document.querySelectorAll('[data-event-title]').forEach((el) => { el.textContent = `${e.name} ${e.subtitle}`; });
}
export function fmtPeriod(entry) {
  const f = (iso) => new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (!entry.opensAt && !entry.closesAt) return null;
  return `${entry.opensAt ? f(entry.opensAt) : ''} 〜 ${entry.closesAt ? f(entry.closesAt) : ''}`;
}
export const STATE_LABEL = { open: '受付中', not_yet: '受付開始前', closed: '受付終了', full: '定員に達しました（受付終了）' };
export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); }
  for (const c of kids) n.append(c);
  return n;
}
