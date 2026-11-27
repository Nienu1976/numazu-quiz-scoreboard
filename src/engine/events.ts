import { apply, replay, type RoundInit } from './round';
import { applyScore, replayScore, type ScoreRoundInit } from './scoreRound';
import { applyCourse, replayCourses, type CourseInit } from './courses';
import type { Event } from './types';

/** Undo 対象外のイベント（時計は巻き戻さない §1.2） */
const NOT_UNDOABLE = new Set(['timeUp']);

/** Undo: 直近の「取り消せる」1イベントを除去（再計算は replay で）。確定後は不可。 */
export function undo(events: Event[]): Event[] {
  let i = events.length - 1;
  while (i >= 0 && NOT_UNDOABLE.has(events[i].type)) i--;
  if (i < 0 || events[i].type === 'finalize') return events;
  return [...events.slice(0, i), ...events.slice(i + 1)];
}

/** 確定取消（エンジン単体用。次ラウンドの確認は canUnfinalize で） */
export function unfinalize(events: Event[]): Event[] {
  const last = events[events.length - 1];
  return last && last.type === 'finalize' ? events.slice(0, -1) : events;
}

/** §1.2/§11: 受け取り先ラウンドにイベントが1つも無いときだけ確定取消できる */
export function canUnfinalize(downstreamEventLogs: Event[][]): boolean {
  return downstreamEventLogs.every((log) => log.length === 0);
}

/** 状態が変わるときだけログに積む（無視される入力でUndoが空振りしない）R-01 */
export function dispatch(init: RoundInit, events: Event[], ev: Event): Event[] {
  const cur = replay(init, events);
  return apply(cur, ev) === cur ? events : [...events, ev];
}
export function dispatchScore(init: ScoreRoundInit, events: Event[], ev: Event): Event[] {
  const cur = replayScore(init, events);
  return applyScore(cur, ev) === cur ? events : [...events, ev];
}
export function dispatchCourse(init: CourseInit, events: Event[], ev: Event): Event[] {
  const cur = replayCourses(init, events);
  return applyCourse(cur, ev) === cur ? events : [...events, ev];
}
