import { describe, it, expect } from 'vitest';
import { init, ok, ng, th, abort, fin, seat, replay } from './helpers';
import { undo, dispatch, dispatchScore, dispatchCourse, canUnfinalize } from '../events';
import { init1R, replayScore, rank1R } from '../scoreRound';
import { replayTimer, elapsedMs } from '../timer';
import type { Event } from '../types';

describe('R-01 dispatch: 状態が変わるときだけ積む', () => {
  const i = init('2R', ['A', 'B', 'C', 'D'], { seatsToWin: 2 });
  it('無視される入力は積まれない', () => {
    let l: Event[] = [];
    l = dispatch(i, l, ok('A'));
    const same = dispatch(i, l, ok('ZZ'));
    expect(same).toBe(l);
    expect(dispatch(i, l, fin)).toBe(l);
    expect(undo(dispatch(i, l, fin))).toEqual([]);
  });
  it('1R: 範囲外の点数・欠席者・不要な finalize は積まれない', () => {
    const si = init1R([{ playerId: 'a', entryNo: 1 }, { playerId: 'b', entryNo: 2, absent: true }]);
    let l: Event[] = [];
    l = dispatchScore(si, l, { type: 'setScore', playerId: 'a', score: 999 });
    l = dispatchScore(si, l, { type: 'setScore', playerId: 'b', score: 5 });
    l = dispatchScore(si, l, fin);
    expect(l).toEqual([]);
    l = dispatchScore(si, l, { type: 'setScore', playerId: 'a', score: 5 });
    expect(dispatchScore(si, l, { type: 'setScore', playerId: 'a', score: 5 })).toBe(l);
  });
  it('コース選択: 順番外は積まれない', () => {
    const ci = { players: [{ playerId: 'a', r1Rank: 1 }, { playerId: 'b', r1Rank: 2 }], courses: ['A'] };
    expect(dispatchCourse(ci, [], { type: 'chooseCourse', playerId: 'b', course: 'A' })).toEqual([]);
  });
});

describe('R-04 SF timeUp', () => {
  const i = init('SF', ['A', 'B', 'C', 'D']);
  const tu: Event = { type: 'timeUp' };
  it('timeUp は一度だけ・SF以外では無視', () => {
    expect(dispatch(i, [tu], tu)).toEqual([tu]);
    expect(dispatch(init('F', ['A', 'B', 'C', 'D']), [], tu)).toEqual([]);
  });
  it('Undo は timeUp を飛ばして直前の操作を戻す', () => {
    expect(undo([ok('A'), tu])).toEqual([tu]);
    expect(undo([tu])).toEqual([tu]);
    expect(replay(i, undo([ok('A'), tu])).timeUp).toBe(true);
  });
  it('押し込み分に誤答(×)を使っても1回のみ', () => {
    const s = replay(i, [tu, ng('A'), ok('B')]);
    expect([seat(s, 'A').score, seat(s, 'B').score]).toEqual([-1, 0]);
  });
});

describe('R-03 / R-06 / R-07 / R-09', () => {
  it('R-06 wrongEndsQuestion=false: 同じ人は同じ問題で再度解答できない', () => {
    const j = init('2R', ['A', 'B', 'C', 'D', 'E', 'F', 'G'], { config: { wrongEndsQuestion: false } });
    const s = replay(j, [ng('A'), ng('A')]);
    expect(seat(s, 'A').x).toBe(1);
    expect(seat(replay(j, [ng('A'), th, ng('A')]), 'A').x).toBe(2); // 次の問題ならOK
  });
  it('R-07 setConfig はそれ以降にだけ効く（過去の結果は変わらない）', () => {
    const j = init('3R-A', ['A', 'B', 'C', 'D', 'E'], { seatsToWin: 2 });
    const evs: Event[] = [th, th, th];
    const s = replay(j, [...evs, { type: 'setConfig', config: { maxQuestions: 2 } }]);
    expect(s.phase).toBe('main'); // 設定変更前の3問は遡って数えない
    expect(replay(j, [...evs, { type: 'setConfig', config: { maxQuestions: 4 } }, th]).phase).toBe('needSD');
  });
  it('R-09 途中棄権は失格扱い（失格順に連番）', () => {
    const j = init('2R', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], { seatsToWin: 2 });
    const s = replay(j, [{ type: 'withdraw', playerId: 'C' }, { type: 'withdraw', playerId: 'C' }]);
    expect([seat(s, 'C').status, seat(s, 'C').outOrder]).toEqual(['out', 1]);
    expect(replay(j, [{ type: 'withdraw', playerId: 'ZZ' }]).seats.every((x) => x.status === 'play')).toBe(true);
  });
});

describe('R-08 / R-10 / R-11', () => {
  it('R-08 確定取消は下流にイベントが無いときだけ', () => {
    expect(canUnfinalize([[], []])).toBe(true);
    expect(canUnfinalize([[], [ok('A')]])).toBe(false);
  });
  it('R-10 タイマー reset と時計の巻き戻り', () => {
    const t = replayTimer([{ type: 'start', at: 100 }, { type: 'reset', at: 200 }]);
    expect(t.started).toBe(false);
    expect(replayTimer([{ type: 'start', at: 100 }, { type: 'reset', at: 200 }, { type: 'start', at: 300 }]).started).toBe(true);
    const p = replayTimer([{ type: 'start', at: 1000 }, { type: 'pause', at: 500 }]);
    expect(elapsedMs(p, 9999)).toBe(0); // マイナスにならない
  });
  it('R-11 同点ブロック一覧', () => {
    const es = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ playerId: id, entryNo: i + 1 }));
    const sc = [50, 50, 40, 30, 30];
    const s = replayScore(init1R(es), es.map((e, i) => ({ type: 'setScore', playerId: e.playerId, score: sc[i] }) as Event));
    expect(rank1R(s).tieBlocks).toEqual([['a', 'b'], ['d', 'e']]);
  });
});
