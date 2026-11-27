import { describe, expect, it } from 'vitest';
import { planTransition, type R2 } from '../diff';

const seat = (n: number, o = 0, x = 0, status: 'play' | 'win' | 'out' = 'play', winOrder: number | null = null, isHolder = false) =>
  ({ seatNo: n, displayName: `p${n}`, ki: '48', plate: 'green' as const, status, o, x, winOrder, isHolder });
const r2 = (seats: R2['seats'], phase: R2['phase'] = 'main', winCount = 0): R2 => ({
  groupIndex: 0, groupCount: 1, label: '第1組', phase, seatsToWin: 6, winCount, questionCount: 0, seats, sdPlayers: [], finalRanking: null,
});
const base = () => [seat(1), seat(2), seat(3), seat(4)];

describe('planTransition', () => {
  it('初回・差分なしは即時反映', () => {
    expect(planTransition(null, r2(base())).instant).toBe(true);
    expect(planTransition(r2(base()), r2(base())).instant).toBe(true);
  });
  it('+1 と 連答+2 とリーチ', () => {
    const a = r2([seat(1, 2, 0, 'play', null, true), seat(2)]);
    const b = r2([seat(1, 4, 0, 'play', null, false), seat(2)]);
    const p = planTransition(a, b);
    expect(p.events).toEqual([{ type: 'o', i: 0, gain: 2 }, { type: 'reach', i: 0 }]);
    const c = planTransition(r2([seat(1, 0), seat(2)]), r2([seat(1, 1, 0, 'play', null, true), seat(2)]));
    expect(c.events).toEqual([{ type: 'o', i: 0, gain: 1 }]);
  });
  it('×で失格は沈む', () => {
    const p = planTransition(r2([seat(1, 0, 1), seat(2)]), r2([seat(1, 0, 2, 'out'), seat(2)]));
    expect(p.events).toEqual([{ type: 'x', i: 0 }, { type: 'out', i: 0 }]);
  });
  it('1手戻す（値が減る・状態が戻る）は演出なし', () => {
    expect(planTransition(r2([seat(1, 2, 1), seat(2)]), r2([seat(1, 2, 0), seat(2)])).instant).toBe(true);
    expect(planTransition(r2([seat(1, 0, 2, 'out'), seat(2)]), r2([seat(1, 0, 1), seat(2)])).instant).toBe(true);
    expect(planTransition(r2([seat(1, 5, 0, 'win', 1), seat(2)], 'main', 1), r2([seat(1, 4), seat(2)])).instant).toBe(true);
  });
  it('組切替・座席数変更は即時', () => {
    expect(planTransition(r2(base()), { ...r2(base()), groupIndex: 1 }).instant).toBe(true);
    expect(planTransition(r2(base()), r2([seat(1), seat(2)])).instant).toBe(true);
  });
  it('勝ち抜け＋残り全員の自動勝ち抜け→組終了', () => {
    const a = r2([seat(1, 4), seat(2, 3), seat(3, 0, 2, 'out')], 'main', 0);
    const b = r2([seat(1, 5, 0, 'win', 1), seat(2, 3, 0, 'win', 2), seat(3, 0, 2, 'out')], 'done', 2);
    const p = planTransition(a, b);
    expect(p.wins).toEqual([0, 1]);
    expect(p.endShow).toBe(true);
    expect(p.events.filter((e) => e.type === 'win')).toEqual([{ type: 'win', i: 0, real: true }, { type: 'win', i: 1, real: false }]);
  });
  it('打ち切りで組終了のみ', () => {
    const p = planTransition(r2(base()), r2(base(), 'done'));
    expect(p.instant).toBe(false);
    expect(p.endShow).toBe(true);
  });
});
