import { describe, it, expect } from 'vitest';
import { ok, ng, th, abort, sdStart, fin, init, seat, replay, checkUndoRoundTrip } from './helpers';
import { undo } from '../events';

describe('2R §6.4 連答権の消失', () => {
  const i = init('2R', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], {
    initialO: { A: 0, B: 1, C: 2 },
  });
  it('表どおりの遷移', () => {
    let s = replay(i, []);
    expect(s.holder).toBeNull(); // 初期○では付かない A6
    s = replay(i, [ok('A')]);
    expect([seat(s, 'A').o, s.holder]).toEqual([1, 'A']);
    s = replay(i, [ok('A'), ok('A')]);
    expect([seat(s, 'A').o, s.holder]).toEqual([3, null]); // 連答+2、権利は続かない
    s = replay(i, [ok('A'), ok('A'), ok('A')]);
    expect([seat(s, 'A').o, s.holder]).toEqual([4, 'A']);
    s = replay(i, [ok('A'), ok('A'), ok('A'), ng('B')]);
    expect([seat(s, 'B').x, s.holder]).toEqual([1, 'A']); // 他人の×では消えない
    s = replay(i, [ok('A'), ok('A'), ok('A'), ng('B'), th]);
    expect(s.holder).toBe('A'); // スルーでは消えない
    s = replay(i, [ok('A'), ok('A'), ok('A'), ng('B'), th, ok('C')]);
    expect([seat(s, 'C').o, s.holder]).toEqual([3, 'C']); // 他人の○で消える
    s = replay(i, [ok('A'), ok('A'), ok('A'), ng('B'), th, ok('C'), ng('C')]);
    expect([seat(s, 'C').x, s.holder]).toEqual([1, null]); // 自分の×で消える A5
    s = replay(i, [ok('A'), ok('A'), ok('A'), ng('B'), th, ok('C'), ng('C'), ok('A')]);
    expect([seat(s, 'A').o, seat(s, 'A').status, s.holder, seat(s, 'A').winOrder]).toEqual([5, 'win', null, 1]);
  });
  it('連答+2で5○超過 → 5で止まり勝ち抜け', () => {
    const j = init('2R', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], { initialO: { C: 4 } });
    const s = replay(j, [ok('C')]);          // 4→5 勝ち抜け（権利なし）
    expect(seat(s, 'C').o).toBe(5);
    const j2 = init('2R', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], { initialO: { C: 3 } });
    const s2 = replay(j2, [ok('C'), ok('C')]); // 3→4(権利) → +2=6→5で止める
    expect([seat(s2, 'C').o, seat(s2, 'C').status, s2.holder]).toEqual([5, 'win', null]);
  });
  it('2×で失格、順位は在席の下', () => {
    const s = replay(i, [ng('A'), ng('A')]);
    expect(seat(s, 'A').status).toBe('out');
    expect(seat(s, 'A').outOrder).toBe(1);
  });
  it('在席以外・done後の入力は無視（同一参照）', () => {
    const s = replay(i, [ng('A'), ng('A')]);
    const s2 = replay(i, [ng('A'), ng('A'), ok('A')]);
    expect(s2).toEqual(s);
  });
});

describe('2R 勝ち抜け・終了', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const i = init('2R', ids, { initialO: { A: 3, B: 2, C: 2 } });
  it('枠が埋まったら done（勝ち抜け順が順位）', () => {
    const j = init('2R', ids, { seatsToWin: 2, initialO: { A: 4, B: 4 } });
    const s = replay(j, [ok('B'), ok('A')]);
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 3)).toEqual(['B', 'A', 'C']);
  });
  it('§3.2 自動勝ち抜け: 勝抜3・失格6・在席3', () => {
    const j = init('2R', ids, { initialO: Object.fromEntries(ids.map((x, n) => [x, n < 3 ? 4 : 0])) });
    const evs = [
      ok('A'), ok('B'), ok('C'),                // 3人勝ち抜け（4→5）
      ...ids.slice(3, 9).flatMap((id) => [ng(id), ng(id)]), // 6人失格
    ];
    const s = replay(j, evs);
    expect(s.phase).toBe('done');
    expect(s.seats.filter((x) => x.status === 'win')).toHaveLength(6);
    // 残り3人は判定基準(○同0,×同0) → 1R順位で勝ち抜け: J,K,L
    expect(s.finalRanking!.slice(0, 6)).toEqual(['A', 'B', 'C', 'J', 'K', 'L']);
    expect(s.finalRanking!.slice(6)).toEqual(['I', 'H', 'G', 'F', 'E', 'D']); // 失格が遅い順
  });
  it('§3.1例: 打ち切り終了 A,B,C,D,F,E', () => {
    const j = init('2R', ['A', 'B', 'C', 'D', 'E', 'F'], { seatsToWin: 4, initialO: { A: 4, B: 4 } });
    const s = replay(j, [ok('A'), ok('B'), ng('E'), ng('E'), ng('F'), ng('F'), ok('C'), ok('C'), ok('C'), ok('D'), ng('D'), abort]);
    // 勝抜A,B / 失格E,F / 在席 C(3○... 権利で +1,+2?) D
    expect(s.phase).toBe('done');
    expect(s.finalRanking).toEqual(['A', 'B', 'C', 'D', 'F', 'E']);
  });
});

describe('2R 打ち切り・SD', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
  const i = init('2R', ids, { seatsToWin: 2, initialO: { A: 2, B: 2, C: 2, D: 1 } });
  it('同点なし → 即 done', () => {
    const j = init('2R', ids, { seatsToWin: 2, initialO: { A: 2, B: 1 } });
    const s = replay(j, [abort]);
    expect(s.phase).toBe('done');
    expect(s.seats.filter((x) => x.status === 'win').map((x) => x.playerId)).toEqual(['A', 'B']);
  });
  it('境界同点 → needSD → SD → done', () => {
    // A,B,C が 2○0× 同点、枠2 → A,B,C でSD（n=3,K=2）
    let s = replay(i, [abort]);
    expect(s.phase).toBe('needSD');
    expect(s.sdPending).toEqual({ players: ['A', 'B', 'C'], slots: 2 });
    s = replay(i, [abort, ok('A')]); // needSD 中の入力は無視
    expect(s.phase).toBe('needSD');
    s = replay(i, [abort, sdStart, th, ng('C')]);
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 3)).toEqual(['A', 'B', 'C']); // 1R順位でA,B
  });
  it('SD上限 n+1 問で1R順位決着', () => {
    const s = replay(i, [abort, sdStart, ok('C'), th, th, th]);
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 3)).toEqual(['C', 'A', 'B']);
    expect(s.finalRanking![3]).toBe('D');
  });
  it('境界上位に確定者がいる場合は先に勝ち抜け', () => {
    const j = init('2R', ids, { seatsToWin: 3, initialO: { A: 3, B: 2, C: 2, D: 2 } });
    const s = replay(j, [abort]);
    expect(seat(s, 'A').status).toBe('win');
    expect(s.sdPending).toEqual({ players: ['B', 'C', 'D'], slots: 2 });
  });
  it('maxQuestions 到達で自動打ち切り', () => {
    const j = init('2R', ids, { seatsToWin: 2, initialO: { A: 2, B: 1 }, config: { maxQuestions: 2 } });
    const s = replay(j, [th, th]);
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 2)).toEqual(['A', 'B']);
  });
  it('wrongEndsQuestion=false: ×では問題数が進まない', () => {
    const j = init('2R', ids, { seatsToWin: 2, config: { wrongEndsQuestion: false } });
    expect(replay(j, [ng('A')]).questionCount).toBe(0);
    expect(replay(j, [ng('A'), th]).questionCount).toBe(1);
  });
  it('確定: done後のみ。確定後はUndo不可・入力無視', () => {
    const j = init('2R', ids, { seatsToWin: 2, initialO: { A: 2, B: 1 } });
    expect(replay(j, [fin]).finalized).toBe(false);
    const evs = [abort, fin];
    expect(replay(j, evs).finalized).toBe(true);
    expect(undo(evs)).toBe(evs);
  });
  it('Undo往復と状態の再現（勝ち抜け・失格をまたぐ）', () => {
    const evs = [ok('A'), ng('B'), ng('B'), ok('C'), ok('C'), abort, sdStart, ok('A')];
    checkUndoRoundTrip(init('2R', ids, { seatsToWin: 2, initialO: { A: 3, B: 2, C: 2 } }), evs);
    const j = init('2R', ids, { seatsToWin: 3, initialO: { A: 4 } });
    const a = replay(j, [ok('A')]);
    expect(seat(a, 'A').status).toBe('win');
    expect(seat(replay(j, undo([ok('A')])), 'A').status).toBe('play');
  });
  it('開始時の欠員: 在席数<枠 なら全員勝ち抜け', () => {
    const j = init('2R', ['A', 'B', 'C'], { seatsToWin: 6 });
    const s = replay(j, []);
    expect(s.phase).toBe('done');
    expect(s.finalRanking).toEqual(['A', 'B', 'C']);
  });
});
