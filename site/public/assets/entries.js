import { api, fillConfig, el } from './common.js';
const [cfg, list] = await Promise.all([api('/api/config'), api('/api/entries')]);
if (cfg.ok) fillConfig(cfg.data);
if (list.ok) {
  const d = list.data;
  document.getElementById('g-n').textContent = d.confirmed;
  document.getElementById('g-cap').textContent = d.capacity;
  document.getElementById('g-bar').style.width = `${Math.min(100, (d.confirmed / d.capacity) * 100)}%`;
  if (d.waitlist > 0) { const w = document.getElementById('g-wait'); w.hidden = false; w.className = 'tag wait'; w.textContent = `キャンセル待ち ${d.waitlist}名`; }
  const ul = document.getElementById('board');
  for (const e of d.entries) ul.append(el('li', {}, el('span', { class: 'no num' }, e.no), el('span', { class: 'who' }, el('b', {}, e.displayName), el('small', {}, e.ki))));
  document.getElementById('empty').hidden = d.entries.length > 0;
} else document.getElementById('empty').hidden = false;
