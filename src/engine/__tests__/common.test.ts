import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { sdStart, sdApply } from '../sd';
import { plateOf, snakeGroups } from '../ranking';
import type { Event } from '../types';

const R1 = { A: 12, B: 5, C: 30 };
const run = (players: string[], slots: number, evs: Event[], cfg = DEFAULT_CONFIG) =>
  evs.reduce((s, e) => sdApply(s, e, R1, cfg), sdStart(players, slots, cfg));

describe('サドンデス §4.6', () => {
  it('上限は 対象者数+1', () => {
    expect(sdStart(['A', 'B', 'C'], 2, DEFAULT_CONFIG).maxQuestions).toBe(4);
  });
  it('例1: スルー → C× → 残り在席2=残り枠2 で A,B 獲得 (1R順)', () => {
    const s = run(['A', 'B', 'C'], 2, [{ type: 'through' }, { type: 'wrong', playerId: 'C' }]);
    expect(s.finished).toBe(true);
    expect(s.order).toEqual(['B', 'A', 'C']);
  });
  it('例2: A○ → 3問スルー → 上限で1R上位B が獲得', () => {
    const s = run(['A', 'B', 'C'], 2, [
      { type: 'correct', playerId: 'A' },
      { type: 'through' }, { type: 'through' }, { type: 'through' },
    ]);
    expect(s.finished).toBe(true);
    expect(s.winners).toEqual(['A', 'B']);
    expect(s.order).toEqual(['A', 'B', 'C']);
  });
  it('○で枠が埋まれば終了', () => {
    const s = run(['A', 'B', 'C'], 1, [{ type: 'correct', playerId: 'C' }]);
    expect(s.finished).toBe(true);
    expect(s.order[0]).toBe('C');
  });
  it('終了後・対象外・獲得/失格済みの入力は無視', () => {
    const s0 = sdStart(['A', 'B', 'C'], 1, DEFAULT_CONFIG);
    expect(sdApply(s0, { type: 'correct', playerId: 'Z' }, R1, DEFAULT_CONFIG)).toBe(s0);
    const s1 = sdApply(s0, { type: 'wrong', playerId: 'A' }, R1, DEFAULT_CONFIG);
    expect(sdApply(s1, { type: 'correct', playerId: 'A' }, R1, DEFAULT_CONFIG)).toBe(s1);
  });
  it('wrongEndsQuestion=false なら×で問題数が進まない', () => {
    const cfg = { ...DEFAULT_CONFIG, wrongEndsQuestion: false };
    const s = run(['A', 'B', 'C', 'D'], 1, [{ type: 'wrong', playerId: 'A' }], cfg);
    expect(s.questionCount).toBe(0);
  });
});

describe('プレート・蛇腹', () => {
  it('プレート境界', () => {
    expect([1, 5, 6, 15, 16, 30, 31, 60].map(plateOf)).toEqual(
      ['red', 'red', 'blue', 'blue', 'yellow', 'yellow', 'green', 'green']);
  });
  it('2R蛇腹: 5組', () => {
    const g = snakeGroups(Array.from({ length: 60 }, (_, i) => i + 1), 5);
    expect(g[0].slice(0, 4)).toEqual([1, 10, 11, 20]);
    expect(g[4].slice(0, 3)).toEqual([5, 6, 15]);
    expect(g.every((x) => x.length === 12)).toBe(true);
    const plateCount = g[0].map(plateOf).filter((p) => p === 'red').length;
    expect(plateCount).toBe(1);
  });
  it('SF蛇腹: 2組', () => {
    const g = snakeGroups([1, 2, 3, 4, 5, 6], 2);
    expect(g).toEqual([[1, 4, 5], [2, 3, 6]]);
  });
});
