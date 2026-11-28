import { api, fillConfig, STATE_LABEL, fmtPeriod } from './common.js';
const $ = (id) => document.getElementById(id);
const form = $('f');
let tsWidget = null, tsToken = '';

const cfg = await api('/api/config');
if (cfg.ok) {
  fillConfig(cfg.data);
  $('privacy').textContent = cfg.data.entry.privacyNotice;
  const e = cfg.data.entry;
  if (e.state !== 'open') {
    const b = $('state-box');
    b.hidden = false; b.classList.add('bad');
    const p = fmtPeriod(e);
    b.textContent = `${STATE_LABEL[e.state]}${p && e.state === 'not_yet' ? `（受付期間：${p}）` : ''}`;
    form.hidden = true;
  } else if (e.confirmed >= e.capacity) {
    const b = $('state-box'); b.hidden = false;
    b.textContent = `定員（${e.capacity}名）に達しています。今から申し込む場合はキャンセル待ちとなります。`;
  }
  const key = cfg.data.turnstileSiteKey;
  if (key) {
    $('ts-row').hidden = false;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => { tsWidget = window.turnstile.render('#ts', { sitekey: key, callback: (t) => { tsToken = t; }, 'expired-callback': () => { tsToken = ''; } }); };
    document.head.append(s);
  }
}

function setErrors(fields = {}) {
  document.querySelectorAll('.err').forEach((n) => { n.textContent = fields[n.dataset.for] ?? ''; });
  const first = Object.keys(fields)[0];
  if (first) (document.getElementById(first) ?? document.querySelector(`[data-for="${first}"]`))?.scrollIntoView({ block: 'center' });
}
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const fe = $('form-err'); fe.hidden = true; setErrors();
  const btn = $('submit'); btn.disabled = true; btn.textContent = '送信中…';
  const body = { website: $('website').value, consent: $('consent').checked, turnstileToken: tsToken };
  for (const k of ['realName', 'kana', 'displayName', 'ki', 'contact']) body[k] = $(k).value;
  const r = await api('/api/entries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  btn.disabled = false; btn.textContent = 'この内容でエントリーする';
  if (tsWidget !== null) { window.turnstile.reset(tsWidget); tsToken = ''; }
  if (r.ok) {
    form.hidden = true; $('state-box').hidden = true; $('done').hidden = false;
    $('d-no').textContent = r.data.receiptNo;
    const wait = r.data.status === 'waitlist';
    $('d-st').textContent = wait ? 'キャンセル待ちで受付' : '受付完了';
    $('d-st').classList.toggle('wait', wait);
    $('d-msg').textContent = wait ? `${r.data.displayName} さん、定員に達していたためキャンセル待ちとして受け付けました。空きが出た場合は運営からご連絡します。` : `${r.data.displayName} さん、エントリーを受け付けました。`;
    window.scrollTo({ top: 0 });
    return;
  }
  if (r.data?.fields) setErrors(r.data.fields);
  fe.hidden = false; fe.textContent = r.data?.message ?? '送信できませんでした。通信状況を確認して、もう一度お試しください。';
  fe.scrollIntoView({ block: 'center' });
});
