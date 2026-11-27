import { describe, it, expect } from 'vitest';
import { init as initHelper, ok, ng, th, abort, sdStart, seat, replay } from './helpers';
import { initExR1, replayScore, exr1Result } from '../scoreRound';
import type { Event } from '../types';

/** 点数分布 [[点,人数],...] から ExR1 を作る */
const dist = (d: [number, number][]) => {
  const entries: { playerId: string; entryNo: number }[] = [];
  const evs: Event[] = [];
  let n = 0;
  for (const [score, cnt] of d) for (let k = 0; k < cnt; k++) {
    n++; entries.push({ playerId: `p${n}`, entryNo: n });
    evs.push({ type: 'setScore', playerId: `p${n}`, score });
  }
  return replayScore(initExR1(entries), evs);
};

describe('ExR phase1 §8.1 ボーダー同点除外', () => {
  it('要件の例: 10点2, 9点7, 8点6 → 9点以上の9人', () => {
    const r = exr1Result(dist([[10, 2], [9, 7], [8, 6], [7, 33]]));
    expect(r.advancers).toHaveLength(9);
    expect(r.advancers).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']);
    expect(r.needPhase2).toBe(true);
  });
  it('ちょうど12人: 10点4, 9点8, 8点3', () => {
    expect(exr1Result(dist([[10, 4], [9, 8], [8, 3]])).advancers).toHaveLength(12);
  });
  it('先頭超過: 10点13, 9点5 → 0人 → phase2なし・全員復活(0人)', () => {
    const r = exr1Result(dist([[10, 13], [9, 5]]));
    expect(r.advancers).toHaveLength(0);
    expect(r.direct).toBe(true);
  });
  it('少数: 10点1, 9点1, 8点20 → 2人、phase2を行わず全員復活 (A8)', () => {
    const r = exr1Result(dist([[10, 1], [9, 1], [8, 20]]));
    expect(r.advancers).toEqual(['p1', 'p2']);
    expect(r.direct).toBe(true);
    expect(r.needPhase2).toBe(false);
  });
  it('3人以上なら phase2 を行う', () => {
    expect(exr1Result(dist([[10, 3], [9, 20]])).needPhase2).toBe(true);
  });
  it('点数の再入力で結果が変わる／未入力者は対象外', () => {
    const s = dist([[10, 2]]);
    expect(exr1Result(s).advancers).toHaveLength(2);
  });
});

describe('ExR phase2 4○1×', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
  const i = initHelper('ExR2', ids);
  it('4○で復活、1×で失格', () => {
    expect(seat(replay(i, [ok('A'), ok('A'), ok('A'), ok('A')]), 'A').status).toBe('win');
    expect(seat(replay(i, [ng('A')]), 'A').status).toBe('out');
  });
  it('2人勝ち抜けで done', () => {
    const four = (id: string) => [ok(id), ok(id), ok(id), ok(id)];
    const s = replay(i, [...four('C'), ...four('B')]);
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 2)).toEqual(['C', 'B']);
  });
  it('§3.2: 在席数 ≤ 残り枠で全員復活（5人失格で残り1人→…）', () => {
    const s = replay(i, [ng('A'), ng('B'), ng('C'), ng('D')]); // 在席 E,F = 残り枠2
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 2)).toEqual(['E', 'F']);
  });
  it('打ち切り: ○多 → SD → 1R順位（×は基準にならない）', () => {
    let s = replay(i, [ok('B'), ok('C'), ok('D'), abort]);
    expect(s.phase).toBe('needSD');
    expect(s.sdPending).toEqual({ players: ['B', 'C', 'D'], slots: 2 });
    s = replay(i, [ok('B'), ok('C'), ok('D'), abort, sdStart, th, th, th, th]);
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 3)).toEqual(['B', 'C', 'D']);
  });
  it('開始時に2人以下なら全員復活', () => {
    expect(replay(initHelper('ExR2', ['A', 'B']), []).phase).toBe('done');
  });
});
