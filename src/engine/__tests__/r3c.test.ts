import { describe, it, expect } from 'vitest';
import { ok, ng, th, abort, init, seat, replay } from './helpers';
import { selectorOf } from '../round';
import type { Event } from '../types';

const env = (id: string, q: number, c: string): Event => ({ type: 'selectEnvelope', envelopeId: id });
const envelopes = ['e1', 'e2', 'e3', 'e4'].map((id, i) => ({ id, questionNo: i + 1, initial: 'あいうえ'[i] }));
const rep = (n: number, e: Event) => Array.from({ length: n }, () => e);

describe('3R-C Initial7', () => {
  const ids = ['D', 'E', 'F', 'G', 'H'];
  const i = init('3R-C', ids, { seatsToWin: 2, envelopes });
  it('1問目の選択者は組内1R最上位', () => {
    expect(selectorOf(replay(i, []))).toBe('D');
  });
  it('§7.4 例: 選択者の遷移', () => {
    const steps: [Event[], string][] = [
      [[ok('E')], 'E'],               // 前問正解者
      [[ok('E'), ng('F')], 'E'],      // 誤答→直近の正解者
      [[ok('E'), ng('F'), th], 'E'],  // スルー
      [[ok('E'), ng('F'), th, ok('F')], 'F'],
    ];
    for (const [evs, sel] of steps) expect(selectorOf(replay(i, evs))).toBe(sel);
  });
  it('N5: 正解者が勝ち抜け→遡って在席の直近正解者、いなければ在席の1R最上位', () => {
    const base: Event[] = [ok('E'), ng('F'), th, ok('F')];
    // F が 7○ に到達（ここまで4問: E1 F1 → F に残り6正解）
    const toWin = [...base, ...rep(6, ok('F'))];
    let s = replay(i, toWin);
    expect(seat(s, 'F').status).toBe('win');
    expect(selectorOf(s)).toBe('E'); // 在席の直近正解者
    // E が3×で失格 → 履歴 E,F(勝抜),E(失格) → 該当なし → 在席の1R最上位 D
    s = replay(i, [...toWin.slice(0, toWin.length), ng('E'), ng('E')]);
    // 注: ここで枠2のうち1枠が埋まった状態。E 失格 (x3)
    expect(seat(s, 'E').x).toBe(2);
    s = replay(i, [...toWin, ng('E'), ng('E'), ng('E')]);
    expect(seat(s, 'E').status).toBe('out');
    expect(selectorOf(s)).toBe('D');
  });
  it('7○で勝ち抜け / 3×で失格', () => {
    expect(seat(replay(i, rep(7, ok('E'))), 'E').status).toBe('win');
    expect(seat(replay(i, rep(2, ng('E'))), 'E').status).toBe('play');
    expect(seat(replay(i, rep(3, ng('E'))), 'E').status).toBe('out');
  });
  it('封筒: 選択→使用済み、再選択不可、問題終了で現在封筒クリア', () => {
    let s = replay(i, [env('e1', 1, 'あ')]);
    expect(s.currentEnvelope).toBe('e1');
    expect(s.envelopes.find((e) => e.id === 'e1')!.used).toBe(true);
    expect(replay(i, [env('e1', 1, ''), env('e2', 2, '')]).currentEnvelope).toBe('e1'); // 出題中は選べない
    s = replay(i, [env('e1', 1, ''), ok('E')]);
    expect(s.currentEnvelope).toBeNull();
    s = replay(i, [env('e1', 1, ''), ok('E'), env('e1', 1, '')]);
    expect(s.currentEnvelope).toBeNull(); // 選択済みは再選択不可
    s = replay(i, [env('zz', 1, '')]);
    expect(s.currentEnvelope).toBeNull();
  });
  it('封筒未選択でも○×は受け付ける', () => {
    expect(seat(replay(i, [ok('E')]), 'E').o).toBe(1);
  });
  it('打ち切り判定: ○多 → ×少 → SD → 1R', () => {
    const s = replay(i, [ok('E'), ok('F'), ng('F'), ok('G'), abort]);
    // E 1○0×, F 1○1×, G 1○0× → E,G 同点(○1×0)。枠2 → E,G が上位2 → 同点でも枠内なので境界なし
    expect(s.phase).toBe('done');
    expect(s.finalRanking!.slice(0, 3)).toEqual(['E', 'G', 'F']);
  });
});
