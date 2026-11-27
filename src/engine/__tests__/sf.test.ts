import { describe, it, expect } from 'vitest';
import { ok, ng, th, abort, sdStart, init, seat, replay } from './helpers';
import { replayTimer, remainingMs, isTimeUp, elapsedMs, SF_DURATION_MS } from '../timer';
import type { Event } from '../types';

const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const i = init('SF', ids);
const tu: Event = { type: 'timeUp' };
const late = (id: string, correct = true): Event => (correct ? ok(id) : ng(id)); // timeUp の後に置く
const rep = (n: number, e: Event) => Array.from({ length: n }, () => e);

describe('SF 得点・判定', () => {
  it('○+1 / ×-1（マイナスあり N6）。勝ち抜け・失格は起きない', () => {
    const s = replay(i, [ng('A'), ng('A'), ok('B')]);
    expect([seat(s, 'A').score, seat(s, 'A').status, seat(s, 'B').score]).toEqual([-2, 'play', 1]);
  });
  it('設定でマイナスなし', () => {
    const j = init('SF', ids, { config: { sfAllowNegative: false } });
    expect(seat(replay(j, [ng('A')]), 'A').score).toBe(0);
  });
  it('得点降順で上位2人。同点なし → 即 done', () => {
    const s = replay(i, [...rep(3, ok('C')), ...rep(2, ok('E')), ok('A'), abort]);
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 3)).toEqual(['C', 'E', 'A']);
  });
  it('§9.4例: A6 B4 C4 D4 → A確定、残り1枠を B,C,D のSD(n=3,K=1,上限4問)', () => {
    const evs = [...rep(6, ok('A')), ...rep(4, ok('B')), ...rep(4, ok('C')), ...rep(4, ok('D')), abort];
    const s = replay(i, evs);
    expect(s.phase).toBe('needSD');
    expect(seat(s, 'A').status).toBe('win');
    expect(s.sdPending).toEqual({ players: ['B', 'C', 'D'], slots: 1 });
    const d = replay(i, [...evs, sdStart, ok('D')]);
    expect(d.phase).toBe('done');
    expect(d.finalRanking!.slice(0, 4)).toEqual(['A', 'D', 'B', 'C']);
    expect(replay(i, [...evs, sdStart]).sd!.maxQuestions).toBe(4);
  });
  it('2位/3位の境界同点 → SD、上限で1R順位決着', () => {
    const d = replay(i, [ok('B'), ok('C'), ok('D'), abort, sdStart, th, th, th, th]);
    expect(d.phase).toBe('done');
    expect(d.finalRanking!.slice(0, 3)).toEqual(['B', 'C', 'D']);
  });
  it('開始から終了まで勝ち抜けしない（自動勝ち抜けなし）', () => {
    const s = replay(init('SF', ['A', 'B']), []);
    expect(s.phase).toBe('main');
  });
});

describe('SF 時間切れ §9.3', () => {
  it('タイムアップ後の押し込み分は1回だけ有効（N7）', () => {
    const s = replay(i, [ok('B'), tu, late('A'), late('C')]);
    expect(seat(s, 'A').score).toBe(1);
    expect(seat(s, 'C').score).toBe(0); // 2回目は無効
  });
  it('タイムアップ後は押し込み分以外の入力を受け付けない（R-04）', () => {
    const s = replay(i, [tu, ok('A'), ok('B'), ng('C')]);
    expect([seat(s, 'A').score, seat(s, 'B').score, seat(s, 'C').score]).toEqual([1, 0, 0]);
    expect(replay(i, [tu]).timeUp).toBe(true);
  });
  it('時間切れ前の通常入力は何回でも', () => {
    expect(seat(replay(i, rep(5, ok('A'))), 'A').score).toBe(5);
  });
  it('設定で押し込み分を無効にできる', () => {
    const j = init('SF', ids, { config: { sfLateAnswer: false } });
    expect(seat(replay(j, [tu, late('A')]), 'A').score).toBe(0);
  });
  it('例: 7:02に正解 → ○入力後に判定確定', () => {
    const s = replay(i, [ok('B'), tu, late('A'), abort]);
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 2)).toEqual(['A', 'B']);
  });
  it('判定後の入力は無視', () => {
    const s = replay(i, [ok('A'), abort, ok('B')]);
    expect(seat(s, 'B').score).toBe(0);
  });
});

describe('SF タイマー（Undo対象外・別保存）', () => {
  const T0 = 1_000_000;
  it('7分で時間切れ、一時停止中は進まない', () => {
    const t = replayTimer([{ type: 'start', at: T0 }]);
    expect(remainingMs(t, T0 + 60_000)).toBe(SF_DURATION_MS - 60_000);
    expect(isTimeUp(t, T0 + SF_DURATION_MS - 1)).toBe(false);
    expect(isTimeUp(t, T0 + SF_DURATION_MS)).toBe(true);
    const p = replayTimer([{ type: 'start', at: T0 }, { type: 'pause', at: T0 + 100_000 }]);
    expect(elapsedMs(p, T0 + 999_999)).toBe(100_000);
    const r = replayTimer([{ type: 'start', at: T0 }, { type: 'pause', at: T0 + 100_000 }, { type: 'resume', at: T0 + 500_000 }]);
    expect(elapsedMs(r, T0 + 560_000)).toBe(160_000);
  });
  it('開始前は時間切れではない・二重startは無視', () => {
    expect(isTimeUp(replayTimer([]), T0 + 10 ** 9)).toBe(false);
    const t = replayTimer([{ type: 'start', at: T0 }, { type: 'start', at: T0 + 5000 }]);
    expect(elapsedMs(t, T0 + 10_000)).toBe(10_000);
  });
});
