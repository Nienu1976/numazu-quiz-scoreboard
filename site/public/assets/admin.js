import { api, el } from './common.js';
const $ = (id) => document.getElementById(id);
const ST = { confirmed: '確定', waitlist: 'キャンセル待ち', cancelled: '取消' };
let all = [], editing = null;

async function load() {
  const r = await api('/api/admin/entries');
  const box = $('a-err');
  if (!r.ok) { box.hidden = false; box.textContent = r.status === 401 || r.status === 403 ? '認証できません。Cloudflare Access のログインを確認してください。' : '読み込みに失敗しました。'; return; }
  box.hidden = true;
  all = r.data.entries;
  $('a-n').textContent = r.data.confirmed; $('a-cap').textContent = r.data.capacity;
  const w = $('a-wait'); w.hidden = r.data.waitlist === 0; w.textContent = `キャンセル待ち ${r.data.waitlist}名`;
  render();
}
function render() {
  const flt = $('flt').value, q = $('q').value.trim().toLowerCase();
  const body = $('rows'); body.replaceChildren();
  for (const e of all) {
    if (flt && e.status !== flt) continue;
    if (q && ![e.realName, e.kana, e.displayName, e.ki, e.contact, e.receiptNo].some((v) => v.toLowerCase().includes(q))) continue;
    const t = new Date(e.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const act = el('td', { class: 'act' }, el('button', { class: 'sm', type: 'button', onclick: () => openEdit(e) }, '修正'));
    if (e.status !== 'cancelled') act.append(' ', el('button', { class: 'sm warn', type: 'button', onclick: () => cancel(e) }, '取消'));
    else act.append(' ', el('button', { class: 'sm', type: 'button', onclick: () => patch(e.id, { status: 'waitlist' }) }, '待ちに戻す'));
    body.append(el('tr', { class: e.status === 'cancelled' ? 'cancelled' : '' },
      el('td', { class: 'num' }, e.receiptNo), el('td', {}, ST[e.status]), el('td', {}, e.realName), el('td', {}, e.kana),
      el('td', {}, e.displayName), el('td', {}, e.ki), el('td', {}, e.contact), el('td', {}, t), act));
  }
}
async function patch(id, data) {
  const r = await api(`/api/admin/entries/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) { alert(r.data?.message ?? '更新に失敗しました'); return false; }
  await load(); return true;
}
async function cancel(e) {
  if (!confirm(`${e.receiptNo}（${e.displayName}）を取消します。よろしいですか？\n（データは残り、「待ちに戻す」「修正」で復元できます）`)) return;
  const r = await api(`/api/admin/entries/${e.id}`, { method: 'DELETE' });
  if (!r.ok) alert(r.data?.message ?? '取消に失敗しました'); else load();
}
function openEdit(e) {
  editing = e;
  $('dt').textContent = `${e.receiptNo} を修正`;
  for (const k of ['realName', 'kana', 'displayName', 'ki', 'contact', 'status']) $(`e-${k}`).value = e[k];
  $('d-err').hidden = true; $('dlg').showModal();
}
$('d-cancel').addEventListener('click', () => $('dlg').close());
$('df').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const data = {}; for (const k of ['realName', 'kana', 'displayName', 'ki', 'contact', 'status']) data[k] = $(`e-${k}`).value;
  const r = await api(`/api/admin/entries/${editing.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) { const b = $('d-err'); b.hidden = false; b.textContent = [r.data?.message, ...Object.values(r.data?.fields ?? {})].filter(Boolean).join(' / '); return; }
  $('dlg').close(); load();
});
$('flt').addEventListener('change', render);
$('q').addEventListener('input', render);
load();
