import { describe, it, expect } from 'vitest';
import { undo, unfinalize } from '../events';
import { ok, ng, th, abort, fin, init, replay } from './helpers';
import { DEFAULT_CONFIG } from '../config';

describe('Undo / 確定', () => {
  const i = init('3R-A', ['A', 'B', 'C'], { seatsToWin: 1 });
  it('Undoは末尾1件を除去して再計算', () => {
    const evs = [ok('A'), ok('A')];
    expect(replay(i, undo(evs)).seats[0].score).toBe(1);
  });
  it('空列のUndoは何もしない', () => {
    expect(undo([])).toEqual([]);
  });
  it('確定後はUndo不可。確定取消は unfinalize で', () => {
    const evs = [ok('A'), abort, fin];
    expect(replay(i, evs).finalized).toBe(true);
    expect(undo(evs)).toBe(evs);
    expect(unfinalize(evs)).toEqual([ok('A'), abort]);
    expect(replay(i, unfinalize(evs)).finalized).toBe(false);
  });
  it('勝ち抜け・終了もUndoで戻る', () => {
    const evs = Array.from({ length: 7 }, () => ok('A'));
    expect(replay(i, evs).phase).toBe('done');
    expect(replay(i, undo(evs)).phase).toBe('main');
  });
  it('apply は入力状態を破壊しない（純粋）', () => {
    const s0 = replay(i, []);
    const snap = JSON.stringify(s0);
    replay(i, [ok('A')]);
    expect(JSON.stringify(s0)).toBe(snap);
  });
  it('暫定値は全て設定値として存在する', () => {
    for (const k of ['wrongEndsQuestion', 'maxQuestions', 'sdMaxOffset', 'autoAdvance', 'r2InitialHolder',
      'r2BonusKeepsHolder', 'r2WrongByHolderClears', 'sevenBySevenWin', 'sfAllowNegative', 'sfLateAnswer',
      'exrCapacity', 'exrDirectAdvanceMax', 'courseCapacity']) expect(DEFAULT_CONFIG).toHaveProperty(k);
  });
  it('autoAdvance=false なら在席≤残り枠でも自動勝ち抜けしない', () => {
    const j = init('3R-A', ['A', 'B'], { seatsToWin: 2, config: { autoAdvance: false } });
    expect(replay(j, []).phase).toBe('main');
  });
});
