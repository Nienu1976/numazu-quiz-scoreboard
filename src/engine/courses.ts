import { DEFAULT_CONFIG } from './config';
import type { EngineConfig, Event } from './types';

/** 3R コース選択（rules_spec §7.1）: 1R順位の高い順に選ぶ。定員到達コースは選べない。 */
export interface CourseInit {
  players: { playerId: string; r1Rank: number }[];
  courses: string[]; // ['A','B','C']
  config?: Partial<EngineConfig>;
}
export interface CourseState {
  init: CourseInit;
  capacity: number;
  order: string[]; // 選ぶ順（1R順位順）
  chosen: Record<string, string>; // playerId → course
}

export function createCourses(init: CourseInit): CourseState {
  const capacity = init.config?.courseCapacity ?? DEFAULT_CONFIG.courseCapacity;
  const order = [...init.players].sort((a, b) => a.r1Rank - b.r1Rank).map((p) => p.playerId);
  return { init, capacity, order, chosen: {} };
}

export const nextChooser = (s: CourseState): string | null =>
  s.order.find((id) => !(id in s.chosen)) ?? null;

export function courseRemaining(s: CourseState, course: string): number {
  return s.capacity - Object.values(s.chosen).filter((c) => c === course).length;
}

export function applyCourse(s: CourseState, ev: Event): CourseState {
  if (ev.type !== 'chooseCourse') return s;
  if (ev.playerId !== nextChooser(s)) return s;
  if (!s.init.courses.includes(ev.course) || courseRemaining(s, ev.course) <= 0) return s;
  return { ...s, chosen: { ...s.chosen, [ev.playerId]: ev.course } };
}

export function replayCourses(init: CourseInit, events: Event[]): CourseState {
  return events.reduce(applyCourse, createCourses(init));
}

export const courseMembers = (s: CourseState, course: string): string[] =>
  s.order.filter((id) => s.chosen[id] === course);
