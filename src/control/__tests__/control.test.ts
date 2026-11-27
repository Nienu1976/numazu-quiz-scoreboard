import { describe, expect, it } from 'vitest';
import { parseCsv, rowsToPlayers } from '../csv';
import { buildPayload } from '../payload';
import { addPlayers, emptyData, makeGroups, r1Dispatch, r2Dispatch, r2State, r2Undo, loadData, saveData, STORAGE_KEY, type AppData } from '../store';

const mk = (n: number): AppData => {
  let d = emptyData();
  d = addPlayers(d, Array.from({ length: n }, (_, i) => ({ displayName: `名${i + 1}`, ki: `${i}期`, realName: `本名${i + 1}`, kana: 'かな', contact: 'x@y' })));
  d.players.forEach((p, i) => { d = r1Dispatch(d, { type: 'setScore', playerId: p.id, score: 100 - i }); });
  return r1Dispatch(d, { type: 'finalize' });
};

describe('csv', () => {
  it('ヘッダ付き・引用符・BOM', () => {
    const r = rowsToPlayers(parseCsv('﻿氏名,表示名,卒業期,ふりがな,連絡先\r\n"沼津, 太郎",タロ,30期,ぬまづ,a@b\r\n'));
    expect(r).toEqual([{ realName: '沼津, 太郎', displayName: 'タロ', ki: '30期', kana: 'ぬまづ', contact: 'a@b' }]);
  });
  it('ヘッダ無しは 氏名,表示名,卒業期,ふりがな,連絡先 の順', () => {
    expect(rowsToPlayers(parseCsv('山田,ヤマ,25期'))[0]).toMatchObject({ realName: '山田', displayName: 'ヤマ', ki: '25期' });
  });
});

describe('store / 2R', () => {
  it('蛇腹で組分け・席順は1R順位順・保存復元', () => {
    let d = makeGroups(mk(60), 5);
    expect(d.groups!.map((g) => g.length)).toEqual([12, 12, 12, 12, 12]);
    expect(d.groups![0][0]).toBe('p1');
    expect(d.groups![4][0]).toBe('p5');
    expect(d.groups![4][1]).toBe('p6'); // 6位は5組
    const g0 = d.groups![0];
    d = r2Dispatch(d, 0, { type: 'correct', playerId: g0[11] });
    expect(r2State(d, 0)!.seats[11].o).toBe(1);
    const st = new Map<string, string>();
    saveData(d, { setItem: (k, v) => void st.set(k, v) });
    const back = loadData({ getItem: (k) => st.get(k) ?? null });
    expect(r2State(back, 0)!.seats[11].o).toBe(1);
    expect(st.has(STORAGE_KEY)).toBe(true);
    expect(r2State(r2Undo(back, 0), 0)!.seats[11].o).toBe(0);
  });
  it('無効操作は記録されない（勝抜者への○）', () => {
    let d = makeGroups(mk(12), 1);
    const id = d.groups![0][0]; // 赤 3○
    d = r2Dispatch(d, 0, { type: 'correct', playerId: id });
    d = r2Dispatch(d, 0, { type: 'correct', playerId: id }); // 連答 +2 → 5 勝抜
    const n = d.r2Events[0].length;
    d = r2Dispatch(d, 0, { type: 'correct', playerId: id });
    expect(d.r2Events[0].length).toBe(n);
  });
  it('表示画面への送信に本名・ふりがな・連絡先が含まれない', () => {
    const d = makeGroups(mk(12), 1);
    d.ui = { tab: 'r2', group: 0 };
    const j = JSON.stringify(buildPayload(d));
    expect(j).not.toMatch(/本名|かな|x@y/);
    expect(j).toContain('名1');
    d.ui = { tab: 'r1', group: 0 };
    expect(JSON.stringify(buildPayload(d))).not.toMatch(/本名|かな|x@y/);
  });
});
