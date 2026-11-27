import { describe, it, expect } from 'vitest';
import { ok, ng, th, abort, sdStart, init, seat, replay, checkUndoRoundTrip } from './helpers';

const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
const rep = (n: number, e: ReturnType<typeof ok>) => Array.from({ length: n }, () => e);

describe('3R-A 7up-down', () => {
  const i = init('3R-A', ids, { seatsToWin: 2 });
  it('○で+1、×で0に戻り×+1', () => {
    const s = replay(i, [...rep(4, ok('A')), ng('A')]);
    expect([seat(s, 'A').score, seat(s, 'A').x]).toEqual([0, 1]);
  });
  it('例: ○4 ×(0,x1) ○2 × → x2 失格', () => {
    const s = replay(i, [...rep(4, ok('A')), ng('A'), ...rep(2, ok('A')), ng('A')]);
    expect(seat(s, 'A').status).toBe('out');
    expect(seat(s, 'A').score).toBe(0);
  });
  it('7点で勝ち抜け', () => {
    const s = replay(i, rep(7, ok('A')));
    expect(seat(s, 'A').status).toBe('win');
    expect(seat(s, 'A').winOrder).toBe(1);
  });
  it('スルーは変化なし、問題数は進む', () => {
    const s = replay(i, [ok('A'), th]);
    expect([seat(s, 'A').score, s.questionCount]).toEqual([1, 2]);
  });
  it('打ち切り判定: score降順 → 1R順位。失格者は下位', () => {
    const j = init('3R-A', ids, { seatsToWin: 2 });
    const s = replay(j, [...rep(3, ok('C')), ...rep(3, ok('B')), ...rep(5, ok('A')), ng('A'), ng('A'), abort]);
    // A: 失格（5点でも下位）。B,C同点3 → 枠2で上位1枠? B,C とも獲得
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 2)).toEqual(['B', 'C']);
    expect(s.finalRanking![5]).toBe('A');
  });
  it('同点(境界)でSD', () => {
    const s = replay(init('3R-A', ids, { seatsToWin: 1 }), [ok('B'), ok('C'), abort]);
    expect(s.phase).toBe('needSD');
    expect(s.sdPending).toEqual({ players: ['B', 'C'], slots: 1 });
    const d = replay(init('3R-A', ids, { seatsToWin: 1 }), [ok('B'), ok('C'), abort, sdStart, ok('C')]);
    expect(d.finalRanking!.slice(0, 2)).toEqual(['C', 'B']);
  });
  it('Undo往復', () => {
    checkUndoRoundTrip(i, [...rep(3, ok('A')), ng('A'), th, ...rep(7, ok('B')), abort]);
  });
});
