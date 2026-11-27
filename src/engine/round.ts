import { mergeConfig } from './config';
import { compareKeys } from './ranking';
import { sdApply, sdStart } from './sd';
import type { Entry, EngineConfig, Envelope, Event, PressKind, RoundState, Seat } from './types';

/** 早押し系ラウンド（2R, 3R-A/B/C, ExR2, SF, F）の共通エンジン。rules_spec §3, §6〜§10 */

interface Rule {
  /** 判定基準キー（大きいほど上位、辞書順）。同点は SD → 1R順位 */
  key(s: Seat): number[];
  win(s: Seat, cfg: EngineConfig): boolean;
  out(s: Seat, cfg: EngineConfig): boolean;
  autoAdvance: boolean;
  defaultSeatsToWin: number;
}

const never = () => false;
export const RULES: Record<PressKind, Rule> = {
  '2R': { key: (s) => [s.o, -s.x], win: (s) => s.o >= 5, out: (s) => s.x >= 2, autoAdvance: true, defaultSeatsToWin: 6 },
  '3R-A': { key: (s) => [s.score], win: (s) => s.score >= 7, out: (s) => s.x >= 2, autoAdvance: true, defaultSeatsToWin: 4 },
  '3R-B': {
    key: (s) => [s.c * s.w, s.c],
    win: (s, cfg) =>
      cfg.sevenBySevenWin === 'product' ? s.c * s.w >= cfg.sevenBySevenTarget
      : cfg.sevenBySevenWin === 'c7' ? s.c >= 7 : false,
    out: (s) => s.w <= 3, autoAdvance: true, defaultSeatsToWin: 4,
  },
  '3R-C': { key: (s) => [s.o, -s.x], win: (s) => s.o >= 7, out: (s) => s.x >= 3, autoAdvance: true, defaultSeatsToWin: 4 },
  ExR2: { key: (s) => [s.o], win: (s) => s.o >= 4, out: (s) => s.x >= 1, autoAdvance: true, defaultSeatsToWin: 2 },
  SF: { key: (s) => [s.score], win: never, out: never, autoAdvance: false, defaultSeatsToWin: 2 },
  F: { key: (s) => [s.o, -s.x], win: (s) => s.o >= 10, out: never, autoAdvance: true, defaultSeatsToWin: 1 },
};

export interface RoundInit {
  kind: PressKind;
  /** 並び順 = 席順（seatNo = index+1） */
  entries: Entry[];
  config?: Partial<EngineConfig>;
  seatsToWin?: number;
  envelopes?: { id: string; questionNo: number; initial: string }[];
}

export function createRound(init: RoundInit): RoundState {
  const config = mergeConfig(init.config);
  const rule = RULES[init.kind];
  const seats: Seat[] = init.entries.map((e, i) => ({
    playerId: e.playerId, seatNo: i + 1, r1Rank: e.r1Rank, status: 'play',
    winOrder: null, outOrder: null,
    o: init.kind === '2R' ? e.initialO ?? 0 : 0, x: 0, score: 0, c: 0, w: 7, rest: 0,
  }));
  const s: RoundState = {
    kind: init.kind, config, seats,
    seatsToWin: init.seatsToWin ?? rule.defaultSeatsToWin,
    questionCount: 0, phase: 'main', sd: null, sdPending: null,
    finalRanking: null, finalized: false, lastAction: '',
    holder: config.r2InitialHolder && init.kind === '2R'
      ? seats.filter((x) => x.o > 0).sort((a, b) => a.r1Rank - b.r1Rank)[0]?.playerId ?? null : null,
    correctHistory: [], currentEnvelope: null, questionWrongBy: [], lateAnswerUsed: false,
    envelopes: (init.envelopes ?? []).map((e): Envelope => ({ ...e, used: false })),
  };
  settle(s); // §3.3 開始時点の欠員・自動勝ち抜け
  return s;
}

export function replay(init: RoundInit, events: Event[]): RoundState {
  return events.reduce(apply, createRound(init));
}

const seatOf = (s: RoundState, id: string) => s.seats.find((x) => x.playerId === id);
const winCount = (s: RoundState) => s.seats.filter((x) => x.status === 'win').length;
const rule = (s: RoundState) => RULES[s.kind];

/** 在席者を 判定基準 → 1R順位 で並べる */
export function orderedPlay(s: RoundState): Seat[] {
  return s.seats.filter((x) => x.status === 'play').sort((a, b) =>
    compareKeys(rule(s).key(a), rule(s).key(b)) || a.r1Rank - b.r1Rank);
}

export function canAnswer(s: RoundState, playerId: string): boolean {
  const p = seatOf(s, playerId);
  return !!p && p.status === 'play' && p.rest === 0 && s.phase === 'main';
}

/** 3R-C 次の選択者 §7.4 */
export function selectorOf(s: RoundState): string | null {
  const play = s.seats.filter((x) => x.status === 'play');
  for (let i = s.correctHistory.length - 1; i >= 0; i--) {
    if (play.some((x) => x.playerId === s.correctHistory[i])) return s.correctHistory[i];
  }
  return [...play].sort((a, b) => a.r1Rank - b.r1Rank)[0]?.playerId ?? null;
}

function markWin(s: RoundState, p: Seat) {
  p.status = 'win';
  p.winOrder = winCount(s);
  if (s.holder === p.playerId) s.holder = null;
}

function endQuestion(s: RoundState) {
  s.questionCount++;
  if (s.kind === 'F') {
    for (const p of s.seats) if (p.rest > 0 && !s.questionWrongBy.includes(p.playerId)) p.rest--;
  }
  s.questionWrongBy = [];
  s.currentEnvelope = null;
}

/** ○×後などの共通判定: 枠充足 → 自動勝ち抜け → 問題数上限 */
function settle(s: RoundState, questionEnded = false) {
  if (s.phase !== 'main') return;
  if (winCount(s) >= s.seatsToWin) return finish(s);
  const remaining = s.seatsToWin - winCount(s);
  const play = orderedPlay(s);
  if (s.config.autoAdvance && rule(s).autoAdvance && play.length <= remaining) {
    play.forEach((p) => markWin(s, p));
    return finish(s);
  }
  const max = s.config.maxQuestions;
  if (questionEnded && max !== null && s.questionCount >= max) doAbort(s);
}

/** 打ち切り: 残り枠を判定基準順で埋め、境界同点があれば needSD §3.4 */
function doAbort(s: RoundState) {
  const play = orderedPlay(s);
  const k = s.seatsToWin - winCount(s);
  if (k <= 0) return finish(s);
  const key = (x: Seat) => rule(s).key(x);
  if (play.length > k && compareKeys(key(play[k - 1]), key(play[k])) === 0) {
    const tieKey = key(play[k - 1]);
    const above = play.filter((x) => compareKeys(key(x), tieKey) < 0);
    const group = play.filter((x) => compareKeys(key(x), tieKey) === 0);
    above.forEach((p) => markWin(s, p));
    s.phase = 'needSD';
    s.sdPending = { players: group.map((x) => x.playerId), slots: k - above.length };
    return;
  }
  play.slice(0, k).forEach((p) => markWin(s, p));
  finish(s);
}

function finish(s: RoundState) {
  s.phase = 'done';
  const sdIdx = (id: string) => s.sd ? s.sd.order.indexOf(id) : -1;
  const wins = s.seats.filter((x) => x.status === 'win').sort((a, b) => a.winOrder! - b.winOrder!);
  const rest = s.seats.filter((x) => x.status === 'play').sort((a, b) =>
    compareKeys(rule(s).key(a), rule(s).key(b)) ||
    (sdIdx(a.playerId) >= 0 && sdIdx(b.playerId) >= 0 ? sdIdx(a.playerId) - sdIdx(b.playerId) : 0) ||
    a.r1Rank - b.r1Rank);
  const outs = s.seats.filter((x) => x.status === 'out').sort((a, b) => b.outOrder! - a.outOrder!);
  s.finalRanking = [...wins, ...rest, ...outs].map((x) => x.playerId);
}

export function apply(s0: RoundState, ev: Event): RoundState {
  if (s0.finalized) return s0;
  const s: RoundState = structuredClone(s0);
  const changed = step(s, ev);
  return changed ? s : s0;
}

function step(s: RoundState, ev: Event): boolean {
  if (ev.type === 'finalize') {
    if (s.phase !== 'done') return false;
    s.finalized = true;
    return true;
  }
  if (s.phase === 'done') return false;
  if (s.phase === 'needSD') {
    if (ev.type !== 'sdStart' || !s.sdPending) return false;
    s.sd = sdStart(s.sdPending.players, s.sdPending.slots, s.config);
    s.phase = 'sd';
    s.lastAction = 'サドンデス開始';
    return true;
  }
  if (s.phase === 'sd') return stepSd(s, ev);
  if (ev.type === 'abort') { doAbort(s); s.lastAction = '打ち切り'; return true; }
  if (ev.type === 'selectEnvelope') return stepEnvelope(s, ev.envelopeId);
  if (ev.type === 'through') {
    if (s.kind === '2R' && s.config.r2ThroughClears) s.holder = null;
    endQuestion(s);
    s.lastAction = 'スルー';
    settle(s, true);
    return true;
  }
  if (ev.type === 'correct' || ev.type === 'wrong') return stepAnswer(s, ev);
  return false;
}

function stepSd(s: RoundState, ev: Event): boolean {
  const r1: Record<string, number> = {};
  s.seats.forEach((x) => { r1[x.playerId] = x.r1Rank; });
  const next = sdApply(s.sd!, ev, r1, s.config);
  if (next === s.sd) return false;
  s.sd = next;
  s.lastAction = `SD: ${ev.type}`;
  if (next.finished) {
    for (const id of next.winners) {
      const p = seatOf(s, id)!;
      p.status = 'win';
      p.winOrder = winCount(s);
    }
    finish(s);
  }
  return true;
}

function stepEnvelope(s: RoundState, id: string): boolean {
  if (s.kind !== '3R-C') return false;
  const e = s.envelopes.find((x) => x.id === id);
  if (!e || e.used || s.currentEnvelope) return false;
  e.used = true;
  s.currentEnvelope = id;
  s.lastAction = `封筒選択 ${e.initial}`;
  return true;
}

function stepAnswer(s: RoundState, ev: Extract<Event, { type: 'correct' | 'wrong' }>): boolean {
  const p = seatOf(s, ev.playerId);
  if (!p || !canAnswer(s, ev.playerId)) return false;
  if (s.kind === 'SF' && ev.afterTimeUp) {
    if (!s.config.sfLateAnswer || s.lateAnswerUsed) return false;
    s.lateAnswerUsed = true;
  }
  const ok = ev.type === 'correct';
  if (ok) onCorrect(s, p); else onWrong(s, p);
  s.lastAction = `${p.playerId} ${ok ? '○' : '×'}`;
  if (!ok) s.questionWrongBy.push(p.playerId);
  if (ok || s.config.wrongEndsQuestion) endQuestion(s);
  checkSeat(s, p);
  settle(s, ok || s.config.wrongEndsQuestion);
  return true;
}

function onCorrect(s: RoundState, p: Seat) {
  s.correctHistory.push(p.playerId);
  switch (s.kind) {
    case '2R': {
      const had = s.holder === p.playerId;
      p.o += had ? 2 : 1;
      s.holder = had && !s.config.r2BonusKeepsHolder ? null : p.playerId;
      if (p.o > 5) p.o = 5;
      break;
    }
    case '3R-A': p.score += 1; break;
    case '3R-B': p.c += 1; break;
    case 'SF': p.score += 1; p.o += 1; break;
    default: p.o += 1;
  }
}

function onWrong(s: RoundState, p: Seat) {
  p.x += 1;
  switch (s.kind) {
    case '2R':
      if (s.holder === p.playerId ? s.config.r2WrongByHolderClears : s.config.r2WrongByOthersClears) s.holder = null;
      break;
    case '3R-A': p.score = 0; break;
    case '3R-B': p.w -= 1; break;
    case 'SF': p.score = s.config.sfAllowNegative ? p.score - 1 : Math.max(0, p.score - 1); break;
    case 'F': p.rest = 2; break;
  }
}

function checkSeat(s: RoundState, p: Seat) {
  if (rule(s).win(p, s.config)) {
    markWin(s, p);
  } else if (rule(s).out(p, s.config)) {
    p.status = 'out';
    p.outOrder = s.seats.filter((x) => x.status === 'out').length;
    if (s.holder === p.playerId) s.holder = null;
  }
}
