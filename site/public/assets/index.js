import { api, fillConfig, fmtPeriod, STATE_LABEL } from './common.js';
const r = await api('/api/config');
if (r.ok) {
  const { entry: e } = r.data;
  fillConfig(r.data);
  document.getElementById('g-n').textContent = e.confirmed;
  document.getElementById('g-cap').textContent = e.capacity;
  document.getElementById('o-cap').textContent = `${e.capacity}名`;
  document.getElementById('g-bar').style.width = `${Math.min(100, (e.confirmed / e.capacity) * 100)}%`;
  const tag = document.getElementById('g-state');
  tag.textContent = STATE_LABEL[e.state] ?? e.state;
  tag.classList.add(e.state === 'open' ? 'open' : 'closed');
  if (e.waitlist > 0) document.getElementById('g-note').textContent = `キャンセル待ち ${e.waitlist}名`;
  else if (e.confirmed >= e.capacity && e.state === 'open') { tag.textContent = 'キャンセル待ち受付中'; tag.className = 'tag wait'; }
  const p = fmtPeriod(e);
  const po = document.getElementById('o-period');
  if (p) { po.textContent = p; po.classList.remove('tbd'); }
} else {
  document.getElementById('g-state').textContent = '取得できませんでした';
}
