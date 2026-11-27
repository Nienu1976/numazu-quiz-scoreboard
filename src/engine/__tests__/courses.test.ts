import { describe, it, expect } from 'vitest';
import { replayCourses, nextChooser, courseRemaining, courseMembers } from '../courses';
import type { Event } from '../types';

const players = Array.from({ length: 6 }, (_, i) => ({ playerId: `p${i + 1}`, r1Rank: (i + 1) * 2 }));
const mk = (cap = 2) => ({ players: [...players].reverse(), courses: ['A', 'B', 'C'], config: { courseCapacity: cap } });
const ch = (playerId: string, course: string): Event => ({ type: 'chooseCourse', playerId, course });

describe('3R コース選択 §7.1', () => {
  it('1R順位の高い順に選ぶ。順番外は無視', () => {
    expect(nextChooser(replayCourses(mk(), []))).toBe('p1');
    const s = replayCourses(mk(), [ch('p2', 'A'), ch('p1', 'A'), ch('p2', 'B')]);
    expect(s.chosen).toEqual({ p1: 'A', p2: 'B' });
    expect(nextChooser(s)).toBe('p3');
  });
  it('定員到達コースは選べない', () => {
    const s = replayCourses(mk(), [ch('p1', 'A'), ch('p2', 'A'), ch('p3', 'A')]);
    expect(courseRemaining(s, 'A')).toBe(0);
    expect(s.chosen.p3).toBeUndefined();
    expect(nextChooser(s)).toBe('p3');
  });
  it('存在しないコースは無視、メンバーは1R順', () => {
    const s = replayCourses(mk(), [ch('p1', 'Z'), ch('p1', 'B'), ch('p2', 'B')]);
    expect(courseMembers(s, 'B')).toEqual(['p1', 'p2']);
  });
  it('既定定員は10', () => {
    expect(replayCourses({ players, courses: ['A'] }, []).capacity).toBe(10);
  });
});
