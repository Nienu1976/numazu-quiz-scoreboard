import type { Plate } from './types';

/** 1R順位 → プレート (§5.3) */
export function plateOf(rank: number): Plate {
  if (rank <= 5) return 'red';
  if (rank <= 15) return 'blue';
  if (rank <= 30) return 'yellow';
  return 'green';
}
export const PLATE_INITIAL_O: Record<Plate, number> = { red: 3, blue: 2, yellow: 1, green: 0 };

/** 蛇腹式の組分け。順位順の配列を groups 組へ。戻り値は組ごとの配列（組内は順位順）。 */
export function snakeGroups<T>(orderedByRank: T[], groups: number): T[][] {
  const res: T[][] = Array.from({ length: groups }, () => []);
  orderedByRank.forEach((item, i) => {
    const cycle = Math.floor(i / groups);
    const pos = i % groups;
    res[cycle % 2 === 0 ? pos : groups - 1 - pos].push(item);
  });
  return res;
}

export function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (b[i] ?? 0) - (a[i] ?? 0); // 降順
    if (d !== 0) return d;
  }
  return 0;
}
