// 表示画面（プロジェクター用）。操作画面から BroadcastChannel で受け取った状態を描画するだけ。
// 本名・ふりがな・連絡先は型にも存在しないため、ここには届かない。
import './style.css';
import { CHANNEL_NAME, type ChannelMessage, type DisplayPayload, type PlateKey } from '../shared/protocol';
import { createR2View } from './r2view';

const app = document.getElementById('app')!;
app.innerHTML = `
<div class="stage" id="stage" aria-label="得点表示ステージ">
  <canvas id="glCanvas"></canvas>
  <div class="hd" id="hd">
    <div class="no">2R</div>
    <div class="tt"><h1>第2ラウンド　連答つき 5○2×</h1><p id="grp">&nbsp;</p></div>
    <div class="rules">
      <div class="rule"><b>5○</b><span>勝ち抜け</span></div>
      <div class="rule"><b>2×</b><span>失格</span></div>
      <div class="rule ren"><b>2○</b><span>連答権中の正解</span></div>
      <div class="rule left"><b id="left">6</b><span>勝ち抜け枠 残り</span></div>
    </div>
  </div>
  <div class="flash" id="flash" role="status" aria-live="polite"></div>
  <div class="plain on" id="plain"><div class="msg">操作画面からの送信待ち…</div></div>
</div>
<button class="fsbtn" id="fs" type="button">全画面にする</button>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage'), plain = $('plain'), hd = $('hd');
const view = createR2View(stage, $<HTMLCanvasElement>('glCanvas'), $('flash'), { label: $('grp'), left: $('left') });

const PLATE_VAR: Record<PlateKey, string> = { red: 'var(--p-r)', blue: 'var(--p-b)', yellow: 'var(--p-y)', green: 'var(--p-g)' };
const PLATE_JA: Record<PlateKey, string> = { red: '赤', blue: '青', yellow: '黄', green: '緑' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function showPlain(html: string) {
  plain.innerHTML = html;
  plain.classList.add('on');
  hd.style.display = 'none';
  $('flash').style.visibility = 'hidden';
  view.setActive(false);
}

function onState(p: DisplayPayload) {
  if (p.stage === 'r2' && p.r2) {
    plain.classList.remove('on');
    hd.style.display = '';
    view.setActive(true);
    view.apply(p.r2);
    return;
  }
  if (p.stage === 'r1' && p.r1) {
    if (!p.r1.finalized) return showPlain('<div class="msg">第1ラウンド　集計中</div>');
    // 1R は確定後の順位・プレート色のみ。点数は送られてこないので表示しない。
    const rows = p.r1.rows;
    const per = Math.max(10, Math.ceil(rows.length / 3));
    return showPlain(`<div class="r1grid" style="grid-template-rows:repeat(${per},3.6cqw)">${rows.map((r) =>
      `<div class="r1row" style="--c:${PLATE_VAR[r.plate]}"><b>${r.rank}</b><span>${esc(r.displayName)}</span><i>${esc(r.affiliation)}　${PLATE_JA[r.plate]}</i></div>`).join('')}</div>`);
  }
  showPlain('<div class="msg">操作画面からの送信待ち…</div>');
}

const ch = new BroadcastChannel(CHANNEL_NAME);
ch.onmessage = (e: MessageEvent<ChannelMessage>) => { if (e.data.type === 'state') onState(e.data.payload); };
ch.postMessage({ type: 'hello' } satisfies ChannelMessage); // 操作画面に最新状態の再送を要求

const fsBtn = $('fs');
fsBtn.addEventListener('click', () => { void document.documentElement.requestFullscreen?.().catch(() => undefined); });
document.addEventListener('dblclick', () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => undefined);
});
