import { DEFAULT_CONFIG } from './config';
import { plateOf } from './ranking';
import type { EngineConfig, Event, Plate } from './types';

/** 1R / ExR phase1 のようなペーパー（点数手入力）ラウンド。rules_spec §5, §8.1 */
export interface ScoreEntry { playerId: string; entryNo: number; absent?: boolean }
export interface ScoreRoundInit { kind: '1R' | 'ExR1'; entries: ScoreEntry[]; maxScore: number }
export interface ScoreRoundState {
  init: ScoreRoundInit;
  scores: Record<string, number>;
  tieOrder: Record<string, number>; // 手動並べ替えの位置（小さいほど上位）
  finalized: boolean;
}

export const init1R = (entries: ScoreEntry[], maxScore = 100): ScoreRoundInit => ({ kind: '1R', entries, maxScore });
export const initExR1 = (entries: ScoreEntry[], maxScore = 10): ScoreRoundInit => ({ kind: 'ExR1', entries, maxScore });

const active = (s: ScoreRoundState) => s.init.entries.filter((e) => !e.absent);

export function canFinalize(s: ScoreRoundState): boolean {
  return active(s).every((e) => s.scores[e.playerId] !== undefined);
}

export function applyScore(s: ScoreRoundState, ev: Event): ScoreRoundState {
  if (s.finalized) return s;
  if (ev.type === 'setScore') {
    const e = s.init.entries.find((x) => x.playerId === ev.playerId);
    if (!e || e.absent) return s;
    if (!Number.isInteger(ev.score) || ev.score < 0 || ev.score > s.init.maxScore) return s;
    return { ...s, scores: { ...s.scores, [ev.playerId]: ev.score } };
  }
  if (ev.type === 'setTieOrder') {
    const tieOrder = { ...s.tieOrder };
    ev.playerIds.forEach((id, i) => { tieOrder[id] = i; });
    return { ...s, tieOrder };
  }
  if (ev.type === 'finalize') return canFinalize(s) ? { ...s, finalized: true } : s;
  return s;
}

export function replayScore(init: ScoreRoundInit, events: Event[]): ScoreRoundState {
  return events.reduce(applyScore, { init, scores: {}, tieOrder: {}, finalized: false } as ScoreRoundState);
}

export interface Ranked {
  order: string[]; // 欠席者を除く 1位から
  ranks: Record<string, number | null>; // 欠席=null
  plates: Record<string, Plate | null>;
  /** 同点がプレート境界(5/6, 15/16, 30/31位)をまたぐ位置（その順位の人）。確定前警告用 */
  boundaryTies: number[];
}

/** 点数降順。同点は手動並べ替え → 受付番号小さい順 (A14)。全順序（重複なし） */
export function rank1R(s: ScoreRoundState): Ranked {
  const list = active(s).filter((e) => s.scores[e.playerId] !== undefined);
  const sorted = [...list].sort((a, b) =>
    s.scores[b.playerId] - s.scores[a.playerId] ||
    (s.tieOrder[a.playerId] ?? Infinity) - (s.tieOrder[b.playerId] ?? Infinity) ||
    a.entryNo - b.entryNo);
  const ranks: Ranked['ranks'] = {};
  const plates: Ranked['plates'] = {};
  s.init.entries.forEach((e) => { ranks[e.playerId] = null; plates[e.playerId] = null; });
  sorted.forEach((e, i) => { ranks[e.playerId] = i + 1; plates[e.playerId] = plateOf(i + 1); });
  const boundaryTies = [5, 15, 30].filter((r) =>
    sorted[r] && sorted[r - 1] && s.scores[sorted[r].playerId] === s.scores[sorted[r - 1].playerId]);
  return { order: sorted.map((e) => e.playerId), ranks, plates, boundaryTies };
}

/** ExR phase1 進出判定（ボーダー同点は全員進出不可）§8.1 */
export function exr1Result(s: ScoreRoundState, cfg: EngineConfig = DEFAULT_CONFIG) {
  const groups = new Map<number, string[]>();
  for (const e of active(s)) {
    const sc = s.scores[e.playerId];
    if (sc === undefined) continue;
    groups.set(sc, [...(groups.get(sc) ?? []), e.playerId]);
  }
  const advancers: string[] = [];
  for (const sc of [...groups.keys()].sort((a, b) => b - a)) {
    const g = groups.get(sc)!;
    if (advancers.length + g.length <= cfg.exrCapacity) advancers.push(...g); else break;
  }
  const direct = advancers.length <= cfg.exrDirectAdvanceMax; // A8: phase2 を行わず全員復活
  return { advancers, direct, needPhase2: !direct };
}
