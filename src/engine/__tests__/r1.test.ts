import { describe, it, expect } from 'vitest';
import { init1R, replayScore, rank1R, canFinalize } from '../scoreRound';
import type { Event } from '../types';

const mk = (n: number, absent: number[] = []) =>
  Array.from({ length: n }, (_, i) => ({ playerId: `p${i + 1}`, entryNo: i + 1, absent: absent.includes(i + 1) }));
const set = (id: string, score: number): Event => ({ type: 'setScore', playerId: id, score });

describe('1R', () => {
  it('点数降順で順位とプレート', () => {
    const s = replayScore(init1R(mk(4)), [set('p1', 50), set('p2', 90), set('p3', 70), set('p4', 10)]);
    const r = rank1R(s);
    expect(r.order).toEqual(['p2', 'p3', 'p1', 'p4']);
    expect(r.ranks.p2).toBe(1);
    expect(r.plates.p2).toBe('red');
  });
  it('同点は受付番号の小さい順（全順序）', () => {
    const s = replayScore(init1R(mk(3)), [set('p1', 50), set('p2', 50), set('p3', 50)]);
    expect(rank1R(s).order).toEqual(['p1', 'p2', 'p3']);
  });
  it('手動並べ替えで同点ブロックの順序を変更できる', () => {
    const s = replayScore(init1R(mk(3)), [set('p1', 50), set('p2', 50), set('p3', 50),
      { type: 'setTieOrder', playerIds: ['p3', 'p1', 'p2'] }]);
    expect(rank1R(s).order).toEqual(['p3', 'p1', 'p2']);
  });
  it('プレート境界(5/6位)の同点を警告', () => {
    const evs = Array.from({ length: 8 }, (_, i) => set(`p${i + 1}`, i < 4 ? 100 - i : 80));
    const r = rank1R(replayScore(init1R(mk(8)), evs));
    expect(r.boundaryTies).toEqual([5]);
    const r2 = rank1R(replayScore(init1R(mk(8)), Array.from({ length: 8 }, (_, i) => set(`p${i + 1}`, 100 - i))));
    expect(r2.boundaryTies).toEqual([]);
  });
  it('52人なら31-52位が緑', () => {
    const evs = Array.from({ length: 52 }, (_, i) => set(`p${i + 1}`, 100 - i));
    const r = rank1R(replayScore(init1R(mk(52)), evs));
    expect(r.plates.p52).toBe('green');
    expect(r.plates.p31).toBe('green');
    expect(r.plates.p30).toBe('yellow');
  });
  it('範囲外・非整数・不明な人の点数は無視。再入力は上書き', () => {
    const s = replayScore(init1R(mk(2)), [set('p1', 101), set('p1', -1), set('p1', 1.5), set('zz', 3), set('p1', 5), set('p1', 7)]);
    expect(s.scores).toEqual({ p1: 7 });
  });
  it('欠席者は順位対象外、確定は全員入力後のみ', () => {
    const init = init1R(mk(3, [3]));
    let s = replayScore(init, [set('p1', 10), { type: 'finalize' }]);
    expect(s.finalized).toBe(false);
    s = replayScore(init, [set('p1', 10), set('p2', 20), set('p3', 99)]);
    expect(canFinalize(s)).toBe(true);
    expect(rank1R(s).ranks.p3).toBeNull();
    expect(rank1R(s).order).toEqual(['p2', 'p1']);
    s = replayScore(init, [set('p1', 10), set('p2', 20), { type: 'finalize' }, set('p1', 0)]);
    expect(s.finalized).toBe(true);
    expect(s.scores.p1).toBe(10);
  });
});
