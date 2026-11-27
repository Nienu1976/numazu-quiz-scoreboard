import './style.css';
import { canAnswer, canFinalize, rank1R } from '../engine';
import { CHANNEL_NAME, type ChannelMessage } from '../shared/protocol';
import { decodeCsvBytes, parseCsv, rowsToPlayers } from './csv';
import { buildPayload } from './payload';
import {
  addPlayers, defaultGroupCount, emptyData, loadData, makeGroups, r1Dispatch, r1Finalized, r1State, r1Undo,
  r1Unfinalize, r2Dispatch, r2State, r2Undo, r2Unfinalize, removePlayer, resetGroups, saveData, swapSeats,
  updatePlayer, type AppData, type Tab,
} from './store';

let data: AppData = loadData();
const app = document.getElementById('app')!;
const ch = new BroadcastChannel(CHANNEL_NAME);
const PLATE_JA = { red: '赤', blue: '青', yellow: '黄', green: '緑' } as const;
const PLATE_CLS = { red: 'r', blue: 'b', yellow: 'y', green: 'g' } as const;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function broadcast() { ch.postMessage({ type: 'state', payload: buildPayload(data) } satisfies ChannelMessage); }
ch.onmessage = (e: MessageEvent<ChannelMessage>) => { if (e.data.type === 'hello') broadcast(); };

function set(next: AppData) {
  data = next;
  saveData(data);
  render();
  broadcast();
}

// ---------- 投影開始（外部ディスプレイへ全画面） ----------
let displayWin: Window | null = null;
function projMsg(t: string) { const el = document.getElementById('projmsg'); if (el) el.textContent = t; }

async function startProjection() {
  const url = new URL('display.html', location.href).href;
  if (displayWin && !displayWin.closed) { displayWin.focus(); projMsg('表示画面は開いています'); return; }
  type Scr = { left: number; top: number; width: number; height: number; availLeft: number; availTop: number; availWidth: number; availHeight: number; isPrimary?: boolean };
  const w = window as unknown as { getScreenDetails?: () => Promise<{ screens: Scr[]; currentScreen: Scr }> };
  try {
    if (w.getScreenDetails) {
      const sd = await w.getScreenDetails();
      const ext = sd.screens.find((s) => s !== sd.currentScreen && !s.isPrimary) ?? sd.screens.find((s) => s !== sd.currentScreen);
      if (ext) {
        displayWin = window.open(url, 'numazu-display', `left=${ext.availLeft},top=${ext.availTop},width=${ext.availWidth},height=${ext.availHeight}`);
        if (displayWin) {
          // 外部ディスプレイ上で全画面化を試みる（ブラウザが拒否したら表示画面側の「全画面にする」ボタンで）
          try { await displayWin.document.documentElement.requestFullscreen(); projMsg('外部ディスプレイに全画面で開きました'); }
          catch { projMsg('外部ディスプレイで開きました。表示画面の「全画面にする」ボタン（またはダブルクリック）で全画面にしてください'); }
          return;
        }
      }
    }
  } catch { /* 権限拒否・非対応 → 下のフォールバックへ */ }
  displayWin = window.open(url, 'numazu-display', 'width=1280,height=720');
  projMsg(displayWin
    ? '外部ディスプレイを自動検出できませんでした。開いた表示画面を手動でプロジェクターの画面へ移動し、「全画面にする」ボタン（またはダブルクリック）を押してください'
    : 'ポップアップがブロックされました。許可してもう一度押してください');
}

// ---------- 画面 ----------
function render() {
  const fin = r1Finalized(data);
  const tabBtn = (t: Tab, label: string, dis = false) =>
    `<button data-act="tab" data-tab="${t}" aria-selected="${data.ui.tab === t}" ${dis ? 'disabled' : ''}>${label}</button>`;
  app.innerHTML = `
  <header class="top"><h1>沼東OB例会 操作画面</h1>
    <nav class="tabs">${tabBtn('players', '参加者')}${tabBtn('r1', '1R 点数入力')}${tabBtn('r2', '2R 早押し', !fin)}</nav>
    <div class="sp"></div><button class="btn pri" data-act="project" title="外部ディスプレイに表示画面を全画面で開きます">投影開始</button><span class="meta" id="projmsg"></span><div class="meta">自動保存中（この画面を閉じても復元されます）</div></header>
  <main>${data.ui.tab === 'players' ? viewPlayers() : data.ui.tab === 'r1' ? viewR1() : viewR2()}</main>`;
}

function viewPlayers(): string {
  const fin = r1Finalized(data);
  const rows = data.players.map((p) => `<tr class="${p.absent ? 'dim' : ''}">
    <td class="num">${p.entryNo}</td>
    <td><input type="text" data-chg="pl" data-id="${p.id}" data-f="displayName" value="${esc(p.displayName)}"></td>
    <td><input type="text" data-chg="pl" data-id="${p.id}" data-f="ki" value="${esc(p.ki)}" style="width:7em"></td>
    <td><input type="text" data-chg="pl" data-id="${p.id}" data-f="realName" value="${esc(p.realName)}"></td>
    <td>${esc(p.kana)}</td><td>${esc(p.contact)}</td>
    <td><label><input type="checkbox" data-chg="absent" data-id="${p.id}" ${p.absent ? 'checked' : ''} ${fin ? 'disabled' : ''}> 欠席</label></td>
    <td><button class="btn" data-act="del" data-id="${p.id}" ${fin ? 'disabled' : ''}>削除</button></td></tr>`).join('');
  return `
  <div class="panel"><h2>参加者の追加</h2>
    <div class="row">
      <label class="btn navy">CSVを読み込む<input type="file" id="csv" accept=".csv,text/csv,.txt" hidden ${fin ? 'disabled' : ''}></label>
      <span class="note">列: 氏名, 表示名, 卒業期, ふりがな, 連絡先（1行目が見出しでも無くても可。UTF-8/Shift_JIS）。読み込みは追加されます</span>
    </div>
    <form id="addf" class="row" style="margin-top:10px">
      <input type="text" name="displayName" placeholder="表示名（必須）" required>
      <input type="text" name="ki" placeholder="卒業期・所属" size="10">
      <input type="text" name="realName" placeholder="本名（運営のみ）">
      <input type="text" name="kana" placeholder="ふりがな（運営のみ）">
      <input type="text" name="contact" placeholder="連絡先（運営のみ）">
      <button class="btn pri" ${fin ? 'disabled' : ''}>手動で追加</button>
    </form>
    ${fin ? '<div class="warn-box">1R確定後は参加者の追加・削除・欠席変更はできません。</div>' : ''}
  </div>
  <div class="panel"><h2>参加者一覧（${data.players.length}人 / 欠席${data.players.filter((p) => p.absent).length}人）</h2>
    <p class="note">本名・ふりがな・連絡先は操作画面だけに表示されます。表示画面には送られません。</p>
    <div class="scroll"><table><thead><tr><th>受付</th><th>表示名</th><th>卒業期</th><th>本名</th><th>ふりがな</th><th>連絡先</th><th></th><th></th></tr></thead>
    <tbody>${rows || '<tr><td colspan="8">まだ参加者がいません。CSVを読み込むか、手動で追加してください。</td></tr>'}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="btn warn" data-act="reset-all">全データを消去</button></div>
  </div>`;
}

function viewR1(): string {
  const s = r1State(data);
  const rk = rank1R(s);
  const fin = s.finalized;
  const act = data.players.filter((p) => !p.absent);
  const missing = act.filter((p) => s.scores[p.id] === undefined).length;
  const rows = data.players.map((p, i) => {
    const r = rk.ranks[p.id];
    const pl = rk.plates[p.id];
    return `<tr class="${p.absent ? 'dim' : ''}"><td class="num">${p.entryNo}</td><td>${esc(p.displayName)}</td><td>${esc(p.ki)}</td>
      <td>${p.absent ? '欠席' : `<input type="number" class="score" data-chg="score" data-id="${p.id}" data-i="${i}" min="0" max="100" step="1" value="${s.scores[p.id] ?? ''}" ${fin ? 'disabled' : ''}>`}</td>
      <td class="num" style="font-size:20px">${r ?? ''}</td>
      <td>${pl ? `<span class="plate ${pl}">${PLATE_JA[pl]}</span>` : ''}</td></tr>`;
  }).join('');
  return `
  <div class="panel"><h2>1R 100問ペーパー 点数入力</h2>
    <div class="row">
      <button class="btn warn" data-act="r1-undo" ${data.r1Events.length && !fin ? '' : 'disabled'}>1手戻す</button>
      ${fin
        ? `<span class="banner" style="margin:0">1R 確定済み</span><button class="btn" data-act="r1-unfinalize" ${data.groups ? 'disabled title="組分け後は取り消せません"' : ''}>確定を取り消す</button>`
        : `<button class="btn pri" data-act="r1-finalize" ${canFinalize(s) && act.length ? '' : 'disabled'}>1Rを確定する</button><span>${missing ? `未入力 ${missing}人` : '全員入力済み'}</span>`}
    </div>
    ${rk.boundaryTies.length && !fin ? `<div class="warn-box">プレート境界（${rk.boundaryTies.map((x) => `${x}位/${x + 1}位`).join('、')}）で同点です。現在は受付番号の小さい順で順位を決めています。主催者の指示と違う場合は確定前に確認してください。</div>` : ''}
    <p class="note">入力して Enter で次の人へ。同点は受付番号の小さい順（暫定 A14）。順位・プレートは入力のたびに更新されます。</p>
    <div class="scroll"><table><thead><tr><th>受付</th><th>表示名</th><th>卒業期</th><th>点数</th><th>順位</th><th>プレート</th></tr></thead><tbody>${rows || '<tr><td colspan="6">参加者がいません</td></tr>'}</tbody></table></div>
  </div>`;
}

function viewR2(): string {
  if (!r1Finalized(data)) return '<div class="panel">先に1Rを確定してください。</div>';
  const rk = rank1R(r1State(data));
  const act = data.players.filter((p) => !p.absent).length;
  if (!data.groups) {
    return `<div class="panel"><h2>2R 組分け（蛇腹式）</h2>
      <p>1R順位の蛇腹式（1→1組…5→5組、6→5組…）で分けます。作成後に席の入れ替えができます。</p>
      <div class="row"><label>組の数 <input type="number" id="gcount" min="1" max="10" value="${data.groupCount || defaultGroupCount(act)}" style="width:4em"></label>
      <button class="btn pri" data-act="make-groups">組分けを作成</button></div></div>`;
  }
  const gi = Math.min(data.ui.group, data.groups.length - 1);
  const s = r2State(data, gi)!;
  const nameOf = (id: string) => data.players.find((p) => p.id === id);
  const label = (id: string) => nameOf(id)?.displayName ?? id;
  const fixLast = (t: string) => t.replace(/\bp\d+\b/g, (m) => label(m)).replace('SD: correct', 'SD ○').replace('SD: wrong', 'SD ×').replace('SD: through', 'SD スルー');
  const sdAlive = (id: string) => !!s.sd && !s.sd.finished && s.sd.players.includes(id) && !s.sd.winners.includes(id) && !s.sd.losers.includes(id);
  const can = (id: string) => (s.phase === 'main' ? canAnswer(s, id) : s.phase === 'sd' ? sdAlive(id) : false);
  const sdSet = new Set(s.sd?.players ?? s.sdPending?.players ?? []);
  const evs = data.r2Events[gi];
  const fin = s.finalized;
  const wins = s.seats.filter((x) => x.status === 'win').length;

  const gtabs = data.groups.map((_, i) => `<button data-act="group" data-g="${i}" aria-selected="${i === gi}">第${i + 1}組</button>`).join('');
  const who = s.seats.map((x) => {
    const pl = rk.plates[x.playerId];
    const tags = [
      x.status === 'win' ? `<span class="tag win">${x.winOrder}抜け</span>` : '',
      x.status === 'out' ? '<span class="tag out">失格</span>' : '',
      s.holder === x.playerId ? '<span class="tag ren">連答権</span>' : '',
      sdSet.has(x.playerId) && s.phase !== 'main' ? '<span class="tag sd">SD</span>' : '',
    ].join('');
    return `<div class="who ${pl ? PLATE_CLS[pl] : ''} ${x.status}">
      <div class="t"><span class="sn num">${x.seatNo}</span><span class="sc num">${x.o}○ ${x.x}×</span></div>
      <div class="n" title="${esc(label(x.playerId))}">${esc(label(x.playerId))}</div>
      <div class="ki">${esc(nameOf(x.playerId)?.ki)}</div>${tags}</div>`;
  }).join('');
  const btns = (cls: string, mark: string, ev: 'correct' | 'wrong') => s.seats.map((x) =>
    `<button class="pb ${cls}" data-act="ans" data-ev="${ev}" data-id="${x.playerId}" ${can(x.playerId) ? '' : 'disabled'}>${can(x.playerId) ? mark : (x.status === 'win' ? '勝抜' : x.status === 'out' ? '失格' : '—')}</button>`).join('');

  let banner = '';
  if (s.phase === 'needSD') banner = `<div class="banner">同点のためサドンデス（${s.sdPending!.players.map(label).join('・')}で残り${s.sdPending!.slots}枠）　<button class="btn warn" data-act="sd-start">サドンデスを始める</button></div>`;
  else if (s.phase === 'sd') banner = `<div class="banner">サドンデス中（1○1×・${s.sd!.questionCount}/${s.sd!.maxQuestions}問）</div>`;
  else if (s.phase === 'done') banner = `<div class="banner">第${gi + 1}組 終了${fin ? '（確定済み）' : ''}　<span class="result">${(s.finalRanking ?? []).map((id, i) => `<span style="color:var(--ink)">${i + 1}. ${esc(label(id))}</span>`).join('')}</span></div>`;

  const seatOpts = data.groups.flatMap((g, gx) => g.map((id, sx) => `<option value="${gx},${sx}">第${gx + 1}組 席${sx + 1} ${esc(label(id))}</option>`)).join('');
  const lockSwap = !!evs.length;
  return `
  <div class="gtabs">${gtabs}</div>
  <div class="state"><b>第${gi + 1}組</b><span>勝ち抜け <b class="num">${wins}/${s.seatsToWin}</b></span><span>${s.questionCount}問終了</span>
    <span class="note">連答つき5○2×（○5で勝ち抜け・×2で失格・連答権中の正解は2○）</span></div>
  ${banner}
  <div class="press">
    <div class="strip"><div class="cols" style="grid-template-columns:repeat(${s.seats.length},minmax(0,1fr))">${who}${btns('o', '○', 'correct')}${btns('x', '×', 'wrong')}</div></div>
    <div class="side">
      <button class="btn undo" data-act="undo" ${evs.length && !fin ? '' : 'disabled'}>1手戻す</button>
      <div class="last">直前: ${esc(fixLast(s.lastAction)) || '—'}</div>
      <button class="btn" data-act="through" ${s.phase === 'main' || s.phase === 'sd' ? '' : 'disabled'}>スルー</button>
      <button class="btn" data-act="abort" ${s.phase === 'main' ? '' : 'disabled'}>打ち切り</button>
      ${s.phase === 'done' && !fin ? '<button class="btn pri" data-act="finalize">この組を確定</button>' : ''}
      ${fin ? '<button class="btn" data-act="unfinalize">確定を取り消す</button>' : ''}
    </div>
  </div>
  <details class="panel" style="margin-top:14px"><summary><b>席の入れ替え・組分けのやり直し</b></summary>
    <div class="row" style="margin-top:8px"><select id="swa">${seatOpts}</select> ⇄ <select id="swb">${seatOpts}</select>
    <button class="btn" data-act="swap" ${lockSwap ? 'disabled title="この組は開始済みのため入れ替え不可"' : ''}>入れ替える</button>
    <span class="note">開始済みの組は入れ替えできません</span></div>
    <div class="row" style="margin-top:8px"><button class="btn warn" data-act="regroup" ${data.r2Events.some((e) => e.length) ? 'disabled title="開始済みの組があるためやり直せません"' : ''}>組分けをやり直す</button></div>
  </details>`;
}

// ---------- イベント ----------
app.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const a = el.dataset.act!;
  const gi = data.ui.group;
  switch (a) {
    case 'project': return void startProjection();
    case 'tab': return set({ ...data, ui: { ...data.ui, tab: el.dataset.tab as Tab } });
    case 'group': return set({ ...data, ui: { ...data.ui, group: Number(el.dataset.g) } });
    case 'del': if (confirm('この参加者を削除しますか？')) set(removePlayer(data, el.dataset.id!)); return;
    case 'reset-all': if (confirm('参加者・点数・早押しの記録をすべて消去します。よろしいですか？')) set(emptyData()); return;
    case 'r1-undo': return set(r1Undo(data));
    case 'r1-finalize': return set(r1Dispatch(data, { type: 'finalize' }));
    case 'r1-unfinalize': return set(r1Unfinalize(data));
    case 'make-groups': {
      const n = Number((document.getElementById('gcount') as HTMLInputElement).value) || 1;
      return set(makeGroups(data, n));
    }
    case 'regroup': if (confirm('組分けをやり直します。よろしいですか？')) set(resetGroups(data)); return;
    case 'swap': {
      const p = (id: string) => (document.getElementById(id) as HTMLSelectElement).value.split(',').map(Number) as [number, number];
      return set(swapSeats(data, p('swa'), p('swb')));
    }
    case 'ans': return set(r2Dispatch(data, gi, { type: el.dataset.ev as 'correct' | 'wrong', playerId: el.dataset.id! }));
    case 'through': return set(r2Dispatch(data, gi, { type: 'through' }));
    case 'abort': if (confirm('問題数上限などでこの組を打ち切ります。よろしいですか？')) set(r2Dispatch(data, gi, { type: 'abort' })); return;
    case 'sd-start': return set(r2Dispatch(data, gi, { type: 'sdStart' }));
    case 'undo': return set(r2Undo(data, gi));
    case 'finalize': return set(r2Dispatch(data, gi, { type: 'finalize' }));
    case 'unfinalize': return set(r2Unfinalize(data, gi));
  }
});

function commitScore(input: HTMLInputElement) {
  const v = input.value.trim();
  if (v === '') return false;
  const score = Number(v);
  const id = input.dataset.id!;
  if (r1State(data).scores[id] === score) return false;
  set(r1Dispatch(data, { type: 'setScore', playerId: id, score }));
  return true;
}
function focusScore(i: number) {
  const els = [...app.querySelectorAll<HTMLInputElement>('input.score')];
  const nxt = els.find((x) => Number(x.dataset.i) > i) ?? els[els.length - 1];
  nxt?.focus(); nxt?.select();
}

app.addEventListener('change', async (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'csv' && el.files?.[0]) {
    const text = decodeCsvBytes(await el.files[0].arrayBuffer());
    const list = rowsToPlayers(parseCsv(text));
    if (!list.length) return alert('読み込める参加者が見つかりませんでした。');
    set(addPlayers(data, list));
    alert(`${list.length}人を追加しました。`);
    return;
  }
  const k = el.dataset.chg;
  if (k === 'pl') set(updatePlayer(data, el.dataset.id!, { [el.dataset.f!]: el.value } as never));
  else if (k === 'absent') set(updatePlayer(data, el.dataset.id!, { absent: el.checked }));
  else if (k === 'score') { if (!commitScore(el)) render(); }
});
app.addEventListener('keydown', (e) => {
  const el = e.target as HTMLInputElement;
  if (e.key === 'Enter' && el.classList?.contains('score')) {
    e.preventDefault();
    const i = Number(el.dataset.i);
    commitScore(el);
    focusScore(i);
  }
});
app.addEventListener('submit', (e) => {
  const f = e.target as HTMLFormElement;
  if (f.id !== 'addf') return;
  e.preventDefault();
  const fd = new FormData(f);
  const g = (k: string) => String(fd.get(k) ?? '').trim();
  set(addPlayers(data, [{ displayName: g('displayName'), ki: g('ki'), realName: g('realName'), kana: g('kana'), contact: g('contact') }]));
});

render();
broadcast();
