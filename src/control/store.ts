// 操作画面の状態。保存するのは「参加者＋全イベント列」だけ。表示用の状態は毎回エンジンで再計算する。
import {
  apply, createRound, init1R, replay, replayScore, rank1R, canFinalize, snakeGroups,
  PLATE_INITIAL_O, undo, unfinalize, dispatch, dispatchScore,
  type Event, type RoundInit, type RoundState, type ScoreRoundState,
} from '../engine';
import type { ParsedPlayer } from './csv';

export interface Player {
  id: string; entryNo: number; displayName: string; ki: string;
  realName: string; kana: string; contact: string; absent: boolean;
}
export type Tab = 'players' | 'r1' | 'r2';

export interface AppData {
  v: 1;
  nextNo: number;
  players: Player[];
  r1Events: Event[];
  groupCount: number;
  /** 2R 組分け。groups[組][席] = playerId（席順） */
  groups: string[][] | null;
  r2Events: Event[][];
  ui: { tab: Tab; group: number };
}

export const STORAGE_KEY = 'numazu-quiz-control-v1';

export const emptyData = (): AppData => ({
  v: 1, nextNo: 1, players: [], r1Events: [], groupCount: 5, groups: null, r2Events: [], ui: { tab: 'players', group: 0 },
});

export function loadData(storage: Pick<Storage, 'getItem'> = localStorage): AppData {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const d = JSON.parse(raw) as AppData;
    return d && d.v === 1 ? { ...emptyData(), ...d } : emptyData();
  } catch { return emptyData(); }
}
export function saveData(d: AppData, storage: Pick<Storage, 'setItem'> = localStorage) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch { /* 容量/無効時は黙って続行（画面は動く） */ }
}

// ---- 参加者 ----
export const r1Finalized = (d: AppData) => d.r1Events.some((e) => e.type === 'finalize');

export function addPlayers(d: AppData, list: ParsedPlayer[]): AppData {
  if (r1Finalized(d)) return d; // 1R確定後は追加しない（順位が決まっているため）
  let no = d.nextNo;
  const added: Player[] = list.map((p) => ({ ...p, id: `p${no}`, entryNo: no++, absent: false }));
  return { ...d, nextNo: no, players: [...d.players, ...added] };
}
export function updatePlayer(d: AppData, id: string, patch: Partial<Pick<Player, 'displayName' | 'ki' | 'realName' | 'kana' | 'contact' | 'absent'>>): AppData {
  if (patch.absent !== undefined && r1Finalized(d)) return d;
  return { ...d, players: d.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}
export function removePlayer(d: AppData, id: string): AppData {
  if (r1Finalized(d)) return d;
  return { ...d, players: d.players.filter((p) => p.id !== id), r1Events: d.r1Events.filter((e) => !('playerId' in e) || e.playerId !== id) };
}

// ---- 1R ----
export function r1State(d: AppData): ScoreRoundState {
  const init = init1R(d.players.map((p) => ({ playerId: p.id, entryNo: p.entryNo, absent: p.absent })));
  return replayScore(init, d.r1Events);
}
export function r1Dispatch(d: AppData, ev: Event): AppData {
  const init = init1R(d.players.map((p) => ({ playerId: p.id, entryNo: p.entryNo, absent: p.absent })));
  const r1Events = dispatchScore(init, d.r1Events, ev); // 状態が変わるときだけ記録 (R-01)
  return r1Events === d.r1Events ? d : { ...d, r1Events };
}
export const r1Undo = (d: AppData): AppData => ({ ...d, r1Events: undo(d.r1Events) });
/** 確定取消は組分け前だけ（次ラウンドとの不整合防止 §1.2） */
export const r1Unfinalize = (d: AppData): AppData => (d.groups ? d : { ...d, r1Events: unfinalize(d.r1Events) });

// ---- 2R ----
export const defaultGroupCount = (n: number) => Math.max(1, Math.ceil(n / 12));

export function makeGroups(d: AppData, groupCount: number): AppData {
  const s = r1State(d);
  if (!s.finalized) return d;
  const order = rank1R(s).order;
  const groups = snakeGroups(order, Math.max(1, Math.min(groupCount, order.length || 1)));
  return { ...d, groupCount, groups, r2Events: groups.map(() => []) };
}
export const resetGroups = (d: AppData): AppData => ({ ...d, groups: null, r2Events: [] });

/** 席の入れ替え（どちらの組も未開始のときだけ） */
export function swapSeats(d: AppData, a: [number, number], b: [number, number]): AppData {
  if (!d.groups) return d;
  if (d.r2Events[a[0]]?.length || d.r2Events[b[0]]?.length) return d;
  const groups = d.groups.map((g) => [...g]);
  const t = groups[a[0]][a[1]];
  groups[a[0]][a[1]] = groups[b[0]][b[1]];
  groups[b[0]][b[1]] = t;
  return { ...d, groups };
}

export function r2Init(d: AppData, gi: number): RoundInit | null {
  if (!d.groups?.[gi]) return null;
  const rk = rank1R(r1State(d));
  return {
    kind: '2R',
    entries: d.groups[gi].map((id) => {
      const plate = rk.plates[id];
      return { playerId: id, r1Rank: rk.ranks[id] ?? 999, initialO: plate ? PLATE_INITIAL_O[plate] : 0 };
    }),
  };
}
export function r2State(d: AppData, gi: number): RoundState | null {
  const init = r2Init(d, gi);
  return init ? replay(init, d.r2Events[gi] ?? []) : null;
}

/** 2R のイベント追加。エンジンが状態を変えない（無効）イベントは記録しない（Undoが空振りしないように） */
export function r2Dispatch(d: AppData, gi: number, ev: Event): AppData {
  const init = r2Init(d, gi);
  if (!init) return d;
  const next = dispatch(init, d.r2Events[gi] ?? [], ev); // 状態が変わるときだけ記録 (R-01)
  if (next === d.r2Events[gi]) return d;
  return { ...d, r2Events: d.r2Events.map((e, i) => (i === gi ? next : e)) };
}
export function r2Undo(d: AppData, gi: number): AppData {
  return { ...d, r2Events: d.r2Events.map((e, i) => (i === gi ? undo(e) : e)) };
}
export function r2Unfinalize(d: AppData, gi: number): AppData {
  return { ...d, r2Events: d.r2Events.map((e, i) => (i === gi ? unfinalize(e) : e)) };
}
export { createRound };
