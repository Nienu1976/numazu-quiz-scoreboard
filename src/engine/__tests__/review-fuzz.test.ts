import { describe, it, expect } from 'vitest';
import { createRound, replay, apply } from '../round';
import { undo } from '../events';
import type { Event, PressKind, RoundState } from '../types';
import type { RoundInit } from '../round';

/**
 * qa-reviewer 追加: ランダムなイベント列での不変条件と Undo/replay 一貫性（review_engine.md R-T1）。
 * 乱数はシード固定（再現可能）。
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const KINDS: { kind: PressKind; n: number; init?: (ids: string[]) => Partial<RoundInit> }[] = [
  { kind: '2R', n: 12, init: (ids) => ({ entries: ids.map((id, i) => ({ playerId: id, r1Rank: i + 1, initialO: i < 1 ? 3 : i < 3 ? 2 : i < 6 ? 1 : 0 })) }) },
  { kind: '3R-A', n: 10 },
  { kind: '3R-B', n: 10 },
  { kind: '3R-C', n: 10, init: () => ({ envelopes: Array.from({ length: 40 }, (_, i) => ({ id: `e${i}`, questionNo: i + 1, initial: `字${i}` })) }) },
  { kind: 'ExR2', n: 12 },
  { kind: 'SF', n: 7 },
  { kind: 'F', n: 4 },
];

function mkInit(k: (typeof KINDS)[number], wrongEndsQuestion: boolean, maxQuestions: number | null): RoundInit {
  const ids = Array.from({ length: k.n }, (_, i) => `P${i + 1}`);
  const base: RoundInit = { kind: k.kind, entries: ids.map((id, i) => ({ playerId: id, r1Rank: i + 1 })), config: { wrongEndsQuestion, maxQuestions } };
  return { ...base, ...(k.init?.(ids) ?? {}) };
}

function randomEvent(r: () => number, s: RoundState): Event {
  const ids = s.seats.map((x) => x.playerId);
  const pick = () => ids[Math.floor(r() * ids.length)];
  const x = r();
  if (x < 0.45) return { type: 'correct', playerId: pick(), afterTimeUp: s.kind === 'SF' && r() < 0.05 };
  if (x < 0.75) return { type: 'wrong', playerId: pick() };
  if (x < 0.85) return { type: 'through' };
  if (x < 0.88) return { type: 'abort' };
  if (x < 0.93) return { type: 'sdStart' };
  if (x < 0.96) return { type: 'selectEnvelope', envelopeId: `e${Math.floor(r() * 40)}` };
  return { type: 'finalize' };
}

function checkInvariants(s: RoundState) {
  const wins = s.seats.filter((x) => x.status === 'win');
  const outs = s.seats.filter((x) => x.status === 'out');
  expect(wins.length).toBeLessThanOrEqual(s.seatsToWin);
  // winOrder / outOrder は 1..n の連番
  expect(wins.map((x) => x.winOrder).sort((a, b) => a! - b!)).toEqual(wins.map((_, i) => i + 1));
  expect(outs.map((x) => x.outOrder).sort((a, b) => a! - b!)).toEqual(outs.map((_, i) => i + 1));
  for (const p of s.seats) {
    if (p.status !== 'win') expect(p.winOrder).toBeNull();
    if (p.status !== 'out') expect(p.outOrder).toBeNull();
    if (s.kind === '2R') { expect(p.o).toBeLessThanOrEqual(5); expect(p.x).toBeLessThanOrEqual(2); }
    if (s.kind === '3R-A') { expect(p.score).toBeGreaterThanOrEqual(0); expect(p.score).toBeLessThanOrEqual(7); }
    if (s.kind === '3R-B') expect(p.w).toBeGreaterThanOrEqual(3);
    if (s.kind === '3R-C') { expect(p.o).toBeLessThanOrEqual(7); expect(p.x).toBeLessThanOrEqual(3); }
    if (s.kind === 'ExR2') { expect(p.o).toBeLessThanOrEqual(4); expect(p.x).toBeLessThanOrEqual(1); }
    if (s.kind === 'F') { expect(p.rest).toBeGreaterThanOrEqual(0); expect(p.rest).toBeLessThanOrEqual(2); expect(p.o).toBeLessThanOrEqual(10); }
  }
  // 連答権保持者は在席者（SD 経由の勝ち抜けで残る既知不具合 R-03 は review-boundary.test.ts で it.fails 管理）
  if (s.holder && !s.sd) expect(s.seats.find((x) => x.playerId === s.holder)!.status).toBe('play');
  if (s.phase === 'done') {
    expect([...s.finalRanking!].sort()).toEqual(s.seats.map((x) => x.playerId).sort());
    // 勝ち抜け者が上位に連続して並ぶ
    expect(s.finalRanking!.slice(0, wins.length).sort()).toEqual(wins.map((x) => x.playerId).sort());
    // 失格者が最下位に（失格が遅い順）
    const tail = s.finalRanking!.slice(s.finalRanking!.length - outs.length);
    expect(tail).toEqual([...outs].sort((a, b) => b.outOrder! - a.outOrder!).map((x) => x.playerId));
  } else {
    expect(s.finalRanking).toBeNull();
  }
  if (s.phase === 'needSD') expect(s.sdPending!.players.length).toBeGreaterThan(s.sdPending!.slots);
  if (s.sd) expect(s.sd.questionCount).toBeLessThanOrEqual(s.sd.maxQuestions);
}

describe('R-T1 ファズ: 不変条件・Undo/replay 一貫性', () => {
  for (const k of KINDS) {
    for (const wrongEndsQuestion of [true, false]) {
      for (const maxQuestions of [null, 15]) {
        it(`${k.kind} wrongEndsQuestion=${wrongEndsQuestion} maxQuestions=${maxQuestions}`, () => {
          const i = mkInit(k, wrongEndsQuestion, maxQuestions);
          for (let seed = 1; seed <= 60; seed++) {
            const r = rng(seed * 7919 + k.n);
            const log: Event[] = [];
            let inc = createRound(i);
            const history: RoundState[] = [inc];
            for (let step = 0; step < 120; step++) {
              const ev = randomEvent(r, inc);
              const next = apply(inc, ev);
              if (next === inc) continue; // 無視されたイベントはログに積まない（UI の想定運用）
              log.push(ev);
              inc = next;
              history.push(inc);
              checkInvariants(inc);
              // 逐次 apply と replay が一致
              expect(JSON.stringify(replay(i, log))).toBe(JSON.stringify(inc));
            }
            // 末尾から Undo を繰り返すと、各時点の状態に正確に戻る（finalize の手前まで）
            let l = log;
            for (let h = history.length - 2; h >= 0; h--) {
              const u = undo(l);
              if (u === l) { expect(l[l.length - 1].type).toBe('finalize'); break; }
              l = u;
              expect(JSON.stringify(replay(i, l))).toBe(JSON.stringify(history[h]));
            }
          }
        });
      }
    }
  }
});
