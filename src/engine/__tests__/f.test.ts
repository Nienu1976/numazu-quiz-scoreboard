import { describe, it, expect } from 'vitest';
import { ok, ng, th, abort, sdStart, init, seat, replay, checkUndoRoundTrip } from './helpers';
import { canAnswer } from '../round';
import type { Event } from '../types';

const ids = ['A', 'B', 'C', 'D'];
const i = init('F', ids);
const rep = (n: number, e: Event) => Array.from({ length: n }, () => e);
const rest = (evs: Event[], init0 = i) => replay(init0, evs).seats.map((s) => s.rest);

describe('F 10○2休 §10.3 例', () => {
  it('表どおり A,B の rest 遷移', () => {
    const r = (evs: Event[]) => {
      const s = replay(i, evs);
      return [seat(s, 'A').rest, seat(s, 'B').rest];
    };
    expect(r([ng('A')])).toEqual([2, 0]);
    expect(r([ng('A'), ok('B')])).toEqual([1, 0]);
    expect(r([ng('A'), ok('B'), ng('B')])).toEqual([0, 2]);
    expect(r([ng('A'), ok('B'), ng('B'), th])).toEqual([0, 1]);
    expect(r([ng('A'), ok('B'), ng('B'), th, ok('C')])).toEqual([0, 0]);
  });
  it('休み中は○×できない', () => {
    const s = replay(i, [ng('A'), ok('A')]);
    expect(seat(s, 'A').o).toBe(0);
    expect(canAnswer(replay(i, [ng('A')]), 'A')).toBe(false);
    expect(canAnswer(replay(i, [ng('A'), th, th]), 'A')).toBe(true);
  });
  it('失格はなく×回数だけ増える', () => {
    const s = replay(i, [ng('A'), th, th, ng('A'), th, th, ng('A')]);
    expect([seat(s, 'A').x, seat(s, 'A').status]).toEqual([3, 'play']);
  });
  it('§10.4 全員休み: スルーで1問ずつ消化', () => {
    const all = replay(i, [ng('A'), ng('B'), ng('C'), ng('D')]);
    // A: 2→B×で1→C×で0? (A:ng→2, B ng→A1,B2, C ng→A0,B1,C2, D ng→B0,C1,D2)
    expect(all.seats.map((x) => x.rest)).toEqual([0, 0, 1, 2]);
    expect(rest([ng('A'), ng('B'), ng('C'), ng('D'), th])).toEqual([0, 0, 0, 1]);
  });
  it('10○で優勝 → done、ランキング', () => {
    const s = replay(i, [...rep(3, ok('B')), ok('C'), ...rep(10, ok('A'))]);
    expect(seat(s, 'A').status).toBe('win');
    expect(s.phase).toBe('done');
    expect(s.finalRanking).toEqual(['A', 'B', 'C', 'D']);
  });
  it('wrongEndsQuestion=false: ×では休みが減らず、○/スルーで問題終了時に減る（×本人は除く）', () => {
    const j = init('F', ids, { config: { wrongEndsQuestion: false } });
    expect(rest([ng('A'), ng('B')], j)).toEqual([2, 2, 0, 0]);
    expect(rest([ng('A'), ng('B'), ok('C')], j)).toEqual([2, 2, 0, 0]); // 同一問題で×した本人は減らさない
    expect(rest([ng('A'), ng('B'), ok('C'), th], j)).toEqual([1, 1, 0, 0]);
  });
});

describe('F 打ち切り §10.5', () => {
  it('○多 → ×少 → SD(1位境界のみ) → 1R順位', () => {
    let s = replay(i, [ok('B'), ok('C'), ng('C'), th, th, abort]);
    expect(s.phase).toBe('done'); // B: 1○0×  C: 1○1×
    expect(s.finalRanking![0]).toBe('B');
    s = replay(i, [ok('B'), ok('C'), abort]);
    expect(s.phase).toBe('needSD');
    expect(s.sdPending).toEqual({ players: ['B', 'C'], slots: 1 });
    s = replay(i, [ok('B'), ok('C'), abort, sdStart, ok('C')]);
    expect(s.finalRanking!.slice(0, 2)).toEqual(['C', 'B']);
  });
  it('2〜4位の同点は1R順位（SDしない N8）', () => {
    const s = replay(i, [ok('A'), ok('A'), ok('C'), ok('D'), abort]);
    expect(s.phase).toBe('done');
    expect(s.finalRanking).toEqual(['A', 'C', 'D', 'B']);
  });
  it('Undo往復（休みをまたぐ）', () => {
    checkUndoRoundTrip(i, [ng('A'), ok('B'), ng('B'), th, ok('C'), ...rep(10, ok('D'))]);
  });
});
