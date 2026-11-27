import { createRound, replay, apply, type RoundInit } from '../round';
import { undo } from '../events';
import type { Event, RoundState, PressKind, EngineConfig } from '../types';

export const ok = (playerId: string): Event => ({ type: 'correct', playerId });
export const ng = (playerId: string): Event => ({ type: 'wrong', playerId });
export const th: Event = { type: 'through' };
export const abort: Event = { type: 'abort' };
export const sdStart: Event = { type: 'sdStart' };
export const fin: Event = { type: 'finalize' };

/** ids の順に r1Rank=1.. で席を作る */
export function init(kind: PressKind, ids: string[], opt: Partial<RoundInit> & { initialO?: Record<string, number>; config?: Partial<EngineConfig> } = {}): RoundInit {
  return {
    kind, ...opt,
    entries: ids.map((id, i) => ({ playerId: id, r1Rank: i + 1, initialO: opt.initialO?.[id] ?? 0 })),
  };
}
export const seat = (s: RoundState, id: string) => s.seats.find((x) => x.playerId === id)!;

/** 全プレフィックスで「apply → Undo → 元の状態」が一致することを確認 */
export function checkUndoRoundTrip(i: RoundInit, evs: Event[]) {
  let prev = createRound(i);
  const log: Event[] = [];
  for (const e of evs) {
    log.push(e);
    const cur = replay(i, log);
    const back = replay(i, undo(log));
    if (cur !== prev) { // 変化があった（無視されたイベントは除く）
      if (JSON.stringify(back) !== JSON.stringify(prev)) throw new Error(`undo mismatch at ${JSON.stringify(e)}`);
    }
    prev = cur;
  }
  return prev;
}
export { createRound, replay, apply };
