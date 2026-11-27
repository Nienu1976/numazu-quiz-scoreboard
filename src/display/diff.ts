// 受信した2R状態の差分から「どの演出を出すか」を決める純関数（DOM/3D非依存・テスト可能）。
// 状態の正はエンジン（操作画面側）。ここではルール計算をせず、前回との差だけを見る。
import type { DisplayPayload } from '../shared/protocol';

export type R2 = NonNullable<DisplayPayload['r2']>;
const WIN = 5; // 2R: ○5 で勝ち抜け（リーチ表示のみに使用。判定はエンジン）

export type SeatEvent =
  | { type: 'o'; i: number; gain: 1 | 2 }          // 正解（+1 / 連答+2）
  | { type: 'reach'; i: number }                    // 初めてリーチになった
  | { type: 'x'; i: number }                        // ×（揺れ）
  | { type: 'out'; i: number }                      // 失格（沈む）
  | { type: 'win'; i: number; real: boolean };      // 勝ち抜け。real=この操作で○を取って勝った人

export interface Plan {
  instant: boolean;      // true: 演出なしで即座に反映（初回・組切替・1手戻す・差分なし）
  events: SeatEvent[];
  wins: number[];        // 新たに勝ち抜けた席index（勝ち抜け順）。2人以上なら残り全員の自動勝ち抜けを含む
  endShow: boolean;      // 組終了の帯を出す
}

export const isReach = (s: R2['seats'][number]) =>
  s.status === 'play' && (s.o >= WIN - 1 || (s.o >= WIN - 2 && s.isHolder));

const INSTANT: Plan = { instant: true, events: [], wins: [], endShow: false };

export function planTransition(prev: R2 | null, next: R2): Plan {
  if (!prev || prev.groupIndex !== next.groupIndex || prev.seats.length !== next.seats.length) return INSTANT;
  const n = next.seats.length;
  let changed = false;
  for (let i = 0; i < n; i++) {
    const a = prev.seats[i]!, b = next.seats[i]!;
    if (a.displayName !== b.displayName || a.seatNo !== b.seatNo) return INSTANT;
    // 戻り（1手戻す）は演出なし
    if (b.o < a.o || b.x < a.x) return INSTANT;
    if (a.status !== 'play' && b.status === 'play') return INSTANT;
    if (a.status === 'win' && b.status !== 'win') return INSTANT;
    if (a.status === 'out' && b.status !== 'out') return INSTANT;
    if (b.winOrder !== a.winOrder && a.winOrder !== null) return INSTANT;
    if (b.o !== a.o || b.x !== a.x || b.status !== a.status || b.isHolder !== a.isHolder) changed = true;
  }
  if (next.winCount < prev.winCount) return INSTANT;
  if (prev.phase === 'done' && next.phase !== 'done') return INSTANT;

  const newlyWon: number[] = [];
  for (let i = 0; i < n; i++) if (prev.seats[i]!.status !== 'win' && next.seats[i]!.status === 'win') newlyWon.push(i);
  newlyWon.sort((p, q) => (next.seats[p]!.winOrder ?? 99) - (next.seats[q]!.winOrder ?? 99));
  const doneNow = next.phase === 'done' && prev.phase !== 'done';
  if (!changed && !doneNow) return INSTANT;

  const events: SeatEvent[] = [];
  const realWinner = newlyWon.find((i) => next.seats[i]!.o > prev.seats[i]!.o);
  for (let i = 0; i < n; i++) {
    const a = prev.seats[i]!, b = next.seats[i]!;
    const dO = b.o - a.o;
    if (b.status === 'win' && a.status !== 'win') {
      if (i === realWinner) events.push({ type: 'o', i, gain: a.isHolder && dO >= 2 ? 2 : 1 });
      events.push({ type: 'win', i, real: i === realWinner });
      continue;
    }
    if (b.x > a.x) {
      events.push({ type: 'x', i });
      if (b.status === 'out' && a.status !== 'out') events.push({ type: 'out', i });
    }
    if (dO > 0 && b.status === 'play') {
      events.push({ type: 'o', i, gain: a.isHolder && dO >= 2 ? 2 : 1 });
      if (!isReach(a) && isReach(b)) events.push({ type: 'reach', i });
    }
  }
  return { instant: false, events, wins: newlyWon, endShow: doneNow };
}
