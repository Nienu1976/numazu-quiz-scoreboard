import { describe, it, expect } from 'vitest';
import { init, ok, ng, th, abort, sdStart, fin, replay, seat, checkUndoRoundTrip } from './helpers';
import { undo } from '../events';
import { replayScore, init1R, rank1R, initExR1, exr1Result } from '../scoreRound';
import { replayTimer, remainingMs, isTimeUp } from '../timer';
import { mergeConfig } from '../config';
import type { Event } from '../types';

/**
 * qa-reviewer 追加テスト（review_engine.md 参照）。
 * - it(...)       : 仕様どおり動くことを確認した境界条件
 * - it.fails(...) : レビューで見つけた不具合。期待する振る舞いを書いてあり、現状は失敗する。
 *                   修正されると「it.fails が通ってしまった」で落ちるので、そのとき it に戻すこと。
 */

describe('2R 連答権 追加境界', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  it('連答権保持者が2×で失格 → 連答権は消える', () => {
    const s = replay(init('2R', ids), [ng('A'), ok('A'), ng('A')]);
    expect(seat(s, 'A').status).toBe('out');
    expect(s.holder).toBeNull();
  });
  it('他人の失格では連答権は消えない', () => {
    const s = replay(init('2R', ids), [ng('B'), ok('A'), ng('B')]);
    expect(seat(s, 'B').status).toBe('out');
    expect(s.holder).toBe('A');
  });
  it('3○+連答 → 5○ちょうどで勝ち抜け、連答権は消える', () => {
    const s = replay(init('2R', ids, { initialO: { A: 2 } }), [ok('A'), ok('A')]);
    expect(seat(s, 'A').o).toBe(5);
    expect(seat(s, 'A').status).toBe('win');
    expect(s.holder).toBeNull();
  });
  it('連答権は Undo で元の保持者に戻る', () => {
    const evs = [ok('A'), ok('B')];
    expect(replay(init('2R', ids), undo(evs)).holder).toBe('A');
  });
  it.fails('R-03: SD の○で勝ち抜けた人に連答権が残らない', () => {
    // A,B が 1○ で並び枠1 → 打ち切り → SD。B は本戦最後の○で連答権を持ったまま SD に入る
    const s = replay(init('2R', ['A', 'B', 'C'], { seatsToWin: 1 }), [ok('A'), ok('B'), abort, sdStart, ok('B')]);
    expect(s.phase).toBe('done');
    expect(seat(s, 'B').status).toBe('win');
    expect(s.holder).toBeNull();
  });
});

describe('打ち切り・SD 追加境界', () => {
  it('境界より上に複数の確定者 + 境界同点（2R 枠4: 4○,3○,2○×3）', () => {
    const j = init('2R', ['A', 'B', 'C', 'D', 'E', 'F'], { seatsToWin: 4, initialO: { A: 4, B: 3, C: 2, D: 2, E: 2 } });
    const s = replay(j, [abort]);
    expect(s.phase).toBe('needSD');
    expect(s.sdPending).toEqual({ players: ['C', 'D', 'E'], slots: 2 });
    expect(seat(s, 'A').winOrder).toBe(1);
    expect(seat(s, 'B').winOrder).toBe(2);
  });
  it('×数で同点が割れれば SD しない（2R: 2○0× と 2○1×）', () => {
    const s = replay(init('2R', ['A', 'B', 'C'], { seatsToWin: 1, initialO: { A: 2, B: 2 } }), [ng('A'), abort]);
    expect(s.phase).toBe('done');
    expect(s.finalRanking).toEqual(['B', 'A', 'C']);
  });
  it('needSD 中は○×スルー・打ち切りを無視（同一参照）', () => {
    const j = init('3R-A', ['A', 'B', 'C'], { seatsToWin: 1 });
    const s = replay(j, [ok('A'), ok('B'), abort]);
    expect(s.phase).toBe('needSD');
    for (const e of [ok('A'), ng('B'), th, abort, fin] as Event[]) expect(replay(j, [ok('A'), ok('B'), abort, e])).toEqual(s);
  });
  it('SD 中に対象外の在席者・勝ち抜け者の○は無視', () => {
    const j = init('2R', ['A', 'B', 'C', 'D'], { seatsToWin: 2, initialO: { A: 3, B: 2, C: 2 } });
    const base = [abort, sdStart];
    const s = replay(j, base);
    expect(s.sd!.players).toEqual(['B', 'C']);
    expect(replay(j, [...base, ok('A')]).sd).toEqual(s.sd);
    expect(replay(j, [...base, ok('D')]).sd).toEqual(s.sd);
  });
  it('SD → done → Undo で SD 中に戻る（勝ち抜けも取り消される）', () => {
    const j = init('3R-A', ['A', 'B', 'C'], { seatsToWin: 1 });
    const evs = [ok('A'), ok('B'), abort, sdStart, ok('B')];
    checkUndoRoundTrip(j, evs);
    const s = replay(j, undo(evs));
    expect(s.phase).toBe('sd');
    expect(seat(s, 'B').status).toBe('play');
  });
  it('SD 全員×寸前: 残り1人になった時点で残り枠を獲得（K=1, n=3）', () => {
    const j = init('3R-A', ['A', 'B', 'C', 'D'], { seatsToWin: 1 });
    const s = replay(j, [ok('A'), ok('B'), ok('C'), abort, sdStart, ng('A'), ng('B')]);
    expect(s.phase).toBe('done');
    expect(s.finalRanking).toEqual(['C', 'B', 'A', 'D']);
  });
  it('maxQuestions ちょうどの問題で勝ち抜けが起き枠が埋まれば、打ち切りより勝ち抜け優先', () => {
    const j = init('3R-A', ['A', 'B', 'C'], { seatsToWin: 1, config: { maxQuestions: 7 } });
    const s = replay(j, Array(7).fill(ok('A')));
    expect(s.phase).toBe('done');
    expect(s.sdPending).toBeNull();
    expect(s.finalRanking![0]).toBe('A');
  });
});

describe('3R-C 封筒・選択者 追加境界', () => {
  const ids = ['D', 'E', 'F', 'G'];
  const envelopes = [1, 2, 3].map((n) => ({ id: `e${n}`, questionNo: n, initial: `字${n}` }));
  const j = init('3R-C', ids, { seatsToWin: 2, envelopes });
  it('封筒選択の Undo で used が戻る', () => {
    const s = replay(j, undo([{ type: 'selectEnvelope', envelopeId: 'e1' }]));
    expect(s.envelopes.every((e) => !e.used)).toBe(true);
    expect(s.currentEnvelope).toBeNull();
  });
  it('×（wrongEndsQuestion=true）で問題が終わり封筒がクリアされる', () => {
    const s = replay(j, [{ type: 'selectEnvelope', envelopeId: 'e1' }, ng('E')]);
    expect(s.currentEnvelope).toBeNull();
    expect(s.questionCount).toBe(1);
  });
});

describe('F 休み 追加境界', () => {
  const j = init('F', ['A', 'B', 'C', 'D']);
  it('連続する×で休みが重なる: A×→B×→スルー', () => {
    let s = replay(j, [ng('A'), ng('B')]);
    expect([seat(s, 'A').rest, seat(s, 'B').rest]).toEqual([1, 2]);
    s = replay(j, [ng('A'), ng('B'), th]);
    expect([seat(s, 'A').rest, seat(s, 'B').rest]).toEqual([0, 1]);
  });
  it('休み明けの問題で即×すると再び2問休み', () => {
    const s = replay(j, [ng('A'), th, th, ng('A')]);
    expect(seat(s, 'A').rest).toBe(2);
    expect(seat(s, 'A').x).toBe(2);
  });
});

describe('SF 追加境界', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const j = init('SF', ids);
  it('1位2位が同点でも 3位と差があれば SD しない', () => {
    const s = replay(j, [ok('A'), ok('B'), ok('A'), ok('B'), ok('C'), abort]);
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 2)).toEqual(['A', 'B']);
  });
  it('上位3人同点で枠2 → SD(n=3, K=2, 上限4問)', () => {
    const s = replay(j, [ok('C'), ok('B'), ok('A'), abort, sdStart]);
    expect(s.sd!.players).toEqual(['A', 'B', 'C']);
    expect(s.sd!.slots).toBe(2);
    expect(s.sd!.maxQuestions).toBe(4);
  });
  it('全員0点・マイナスあり: マイナス者は下位', () => {
    const s = replay(j, [ng('A'), abort, sdStart]);
    expect(s.sd!.players).toEqual(['B', 'C', 'D', 'E', 'F', 'G']);
  });
  it.fails('R-04: タイムアップ後の押し込みを使ったあとは、フラグなしの○×も受け付けない', () => {
    // UI が afterTimeUp を付け忘れると、時間切れ後も無制限に入力できてしまう
    const late: Event = { type: 'correct', playerId: 'A', afterTimeUp: true };
    const s = replay(j, [late, ok('B')]);
    expect(seat(s, 'B').score).toBe(0);
  });
  it('タイマー: 一時停止→再開で残り時間が正しい', () => {
    const t = replayTimer([{ type: 'start', at: 0 }, { type: 'pause', at: 60_000 }, { type: 'resume', at: 100_000 }]);
    expect(remainingMs(t, 160_000)).toBe(300_000);
    expect(isTimeUp(t, 459_999)).toBe(false);
    expect(isTimeUp(t, 460_000)).toBe(true);
  });
});

describe('1R / ExR1 追加境界', () => {
  const es = ['A', 'B', 'C', 'D'].map((id, i) => ({ playerId: id, entryNo: i + 1 }));
  it.fails('R-05: 点数修正で別の同点ブロックへ移った人に、古い手動並べ替えが残らない', () => {
    // A,D が 50点同点 → 手動で D を上に → D の点数を 40 に修正（B,C,D が 40点で同点）
    // 期待: 40点ブロックは受付番号順 B(2), C(3), D(4)。現状は D に古い手動順 0 が残り先頭に来る
    const s = replayScore(init1R(es), [
      { type: 'setScore', playerId: 'A', score: 50 }, { type: 'setScore', playerId: 'D', score: 50 },
      { type: 'setTieOrder', playerIds: ['D', 'A'] },
      { type: 'setScore', playerId: 'B', score: 40 }, { type: 'setScore', playerId: 'C', score: 40 },
      { type: 'setScore', playerId: 'D', score: 40 }, // D は 40点ブロックへ移動
    ]);
    expect(rank1R(s).order).toEqual(['A', 'B', 'C', 'D']);
  });
  it('ExR1: 先頭グループがちょうど定員（10点12人）→ 12人', () => {
    const ex = Array.from({ length: 14 }, (_, i) => ({ playerId: `P${i}`, entryNo: i }));
    const s = replayScore(initExR1(ex), ex.map((e, i) => ({ type: 'setScore', playerId: e.playerId, score: i < 12 ? 10 : 9 }) as Event));
    expect(exr1Result(s).advancers).toHaveLength(12);
  });
  it('ExR1: 3人ちょうどなら phase2 を行う、欠席者は数えない', () => {
    const ex = Array.from({ length: 5 }, (_, i) => ({ playerId: `P${i}`, entryNo: i, absent: i === 4 }));
    const s = replayScore(initExR1(ex), ex.map((e, i) => ({ type: 'setScore', playerId: e.playerId, score: 10 - i }) as Event));
    const r = exr1Result(s, mergeConfig({ exrCapacity: 3 }));
    expect(r.advancers).toEqual(['P0', 'P1', 'P2']);
    expect(r.needPhase2).toBe(true);
  });
});

describe('Undo の運用契約', () => {
  it.fails('R-01: 無視された finalize が末尾にあっても Undo が効く', () => {
    // UI が確定ボタンを未 done で押し、イベントを積んでしまった場合
    const j = init('3R-A', ['A', 'B', 'C'], { seatsToWin: 1 });
    const evs = [ok('A'), fin];
    expect(replay(j, evs).finalized).toBe(false);
    expect(replay(j, undo(evs)).seats[0].score).toBe(0); // 「1手戻す」で A の○が消えること
  });
});
