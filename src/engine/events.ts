import type { Event } from './types';

/** Undo: 末尾の1イベントを除去（再計算は replay で）。確定後は不可。 */
export function undo(events: Event[]): Event[] {
  if (events.length === 0 || events[events.length - 1].type === 'finalize') return events;
  return events.slice(0, -1);
}

/** 確定取消（次ラウンドにイベントが無いときだけ呼ぶこと。呼び出し側で検証） */
export function unfinalize(events: Event[]): Event[] {
  const last = events[events.length - 1];
  return last && last.type === 'finalize' ? events.slice(0, -1) : events;
}
