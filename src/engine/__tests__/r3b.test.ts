import { describe, it, expect } from 'vitest';
import { ok, ng, abort, init, seat, replay } from './helpers';

const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
const rep = (n: number, e: ReturnType<typeof ok>) => Array.from({ length: n }, () => e);

describe('3R-B 7by7', () => {
  const i = init('3R-B', ids, { seatsToWin: 2 });
  it('初期は 正解P0 × 誤答P7', () => {
    const s = replay(i, []);
    expect([seat(s, 'A').c, seat(s, 'A').w]).toEqual([0, 7]);
  });
  it('例: ○○○ × ○×6 → c3,w6=18 → ○6で c9 = 54 勝ち抜け', () => {
    let s = replay(i, [...rep(3, ok('A')), ng('A')]);
    expect([seat(s, 'A').c, seat(s, 'A').w]).toEqual([3, 6]);
    s = replay(i, [...rep(3, ok('A')), ng('A'), ...rep(5, ok('A'))]);
    expect(seat(s, 'A').status).toBe('play'); // c8*6=48
    s = replay(i, [...rep(3, ok('A')), ng('A'), ...rep(6, ok('A'))]);
    expect(seat(s, 'A').status).toBe('win');   // c9*6=54
  });
  it('勝ち抜け境界: w=7→c7(49), w=5→c10(50), w=4→c13(52)', () => {
    expect(seat(replay(i, rep(7, ok('A'))), 'A').status).toBe('win');
    expect(seat(replay(i, [ng('A'), ng('A'), ...rep(9, ok('A'))]), 'A').status).toBe('play'); // 9*5=45
    expect(seat(replay(i, [ng('A'), ng('A'), ...rep(10, ok('A'))]), 'A').status).toBe('win');
    expect(seat(replay(i, [ng('A'), ng('A'), ng('A'), ...rep(12, ok('A'))]), 'A').status).toBe('play');
    expect(seat(replay(i, [ng('A'), ng('A'), ng('A'), ...rep(13, ok('A'))]), 'A').status).toBe('win');
  });
  it('4回目の×(誤答P3)で失格', () => {
    expect(seat(replay(i, rep(3, ng('A'))), 'A').status).toBe('play');
    const s = replay(i, rep(4, ng('A')));
    expect(seat(s, 'A').status).toBe('out');
    expect(seat(s, 'A').w).toBe(3);
  });
  it('設定: 正解P7到達 / 勝ち抜けなし', () => {
    const c7 = init('3R-B', ids, { seatsToWin: 2, config: { sevenBySevenWin: 'c7' } });
    expect(seat(replay(c7, [ng('A'), ...rep(7, ok('A'))]), 'A').status).toBe('win');
    const none = init('3R-B', ids, { seatsToWin: 2, config: { sevenBySevenWin: 'none' } });
    expect(seat(replay(none, rep(20, ok('A'))), 'A').status).toBe('play');
  });
  it('打ち切り判定: 得点 → 正解P → SD → 1R', () => {
    // A: c3,w6=18 / B: c6,w3? → 失格を避け B: c2,w7=14 / C: c9? 18 を c=3,w=6 と c=6,w=3は失格
    // 同得点 18: A(c3,w6) と B(c2.57)... 別組: C: c6 w7=42, D: c3 w6=18, E: c2 w... 
    const j = init('3R-B', ids, { seatsToWin: 2 });
    const s = replay(j, [...rep(6, ok('C')), ...rep(3, ok('D')), ng('D'), ...rep(2, ok('B')), abort]);
    // C 42, D 18, B 14 → C, D
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 3)).toEqual(['C', 'D', 'B']);
  });
  it('得点同点は正解Pの多い方が上', () => {
    // E: c6 w6=36? 目標 同得点: P: c6,w7=42  /  Q: c7? 49勝ち。 c7 w6 = 42 (但し c9=54 まで未到達)
    const j = init('3R-B', ids, { seatsToWin: 1 });
    const s = replay(j, [...rep(6, ok('A')), ng('B'), ...rep(7, ok('B')), abort]);
    // A: 6*7=42, c6 / B: 7*6=42, c7 → B(正解P多い)が上。
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 2)).toEqual(['B', 'A']);
  });
});
