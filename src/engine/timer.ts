/** SF 7分タイマー（rules_spec §9.2）。Undo対象外。イベント列とは別に保存する。純粋関数。 */
export type TimerEvent = { type: 'start' | 'pause' | 'resume'; at: number };
export const SF_DURATION_MS = 7 * 60 * 1000;

export interface TimerState { running: boolean; elapsedMs: number; lastAt: number | null; started: boolean }

export function replayTimer(events: TimerEvent[]): TimerState {
  let s: TimerState = { running: false, elapsedMs: 0, lastAt: null, started: false };
  for (const e of events) {
    if (e.type === 'start' && !s.started) s = { running: true, elapsedMs: 0, lastAt: e.at, started: true };
    else if (e.type === 'pause' && s.running) s = { ...s, running: false, elapsedMs: s.elapsedMs + (e.at - s.lastAt!), lastAt: null };
    else if (e.type === 'resume' && s.started && !s.running) s = { ...s, running: true, lastAt: e.at };
  }
  return s;
}

export function elapsedMs(s: TimerState, now: number): number {
  return s.elapsedMs + (s.running ? Math.max(0, now - s.lastAt!) : 0);
}
export function remainingMs(s: TimerState, now: number, duration = SF_DURATION_MS): number {
  return Math.max(0, duration - elapsedMs(s, now));
}
export const isTimeUp = (s: TimerState, now: number, duration = SF_DURATION_MS): boolean =>
  s.started && remainingMs(s, now, duration) === 0;
