// 表示画面へ送るデータの組み立て。ここで displayName / ki / 席・得点だけを取り出す（本名・ふりがな・連絡先は触らない）。
import { rank1R } from '../engine';
import type { DisplayPayload, DisplaySeat } from '../shared/protocol';
import { r1Finalized, r1State, r2State, type AppData } from './store';

export function buildPayload(d: AppData, now = Date.now()): DisplayPayload {
  const byId = new Map(d.players.map((p) => [p.id, p]));
  const rk = rank1R(r1State(d));
  if (d.ui.tab === 'r2' && d.groups) {
    const gi = Math.min(d.ui.group, d.groups.length - 1);
    const s = r2State(d, gi);
    if (s) {
      const seatNoOf = (id: string) => s.seats.find((x) => x.playerId === id)?.seatNo ?? 0;
      const seats: DisplaySeat[] = s.seats.map((x) => ({
        seatNo: x.seatNo,
        displayName: byId.get(x.playerId)?.displayName ?? '',
        ki: byId.get(x.playerId)?.ki ?? '',
        plate: rk.plates[x.playerId] ?? null,
        status: x.status, o: x.o, x: x.x, winOrder: x.winOrder,
        isHolder: s.holder === x.playerId,
      }));
      return {
        v: 1, at: now, stage: 'r2',
        r2: {
          groupIndex: gi, groupCount: d.groups.length, label: `第${gi + 1}組`,
          phase: s.phase, seatsToWin: s.seatsToWin,
          winCount: s.seats.filter((x) => x.status === 'win').length,
          questionCount: s.questionCount, seats,
          sdPlayers: (s.sd?.players ?? s.sdPending?.players ?? []).map(seatNoOf),
          finalRanking: s.finalRanking ? s.finalRanking.map(seatNoOf) : null,
        },
      };
    }
  }
  if (d.ui.tab === 'r1' || d.ui.tab === 'r2') {
    const fin = r1Finalized(d);
    return {
      v: 1, at: now, stage: 'r1',
      r1: {
        finalized: fin,
        rows: fin
          ? rk.order.map((id) => ({
              rank: rk.ranks[id]!, displayName: byId.get(id)!.displayName, ki: byId.get(id)!.ki, plate: rk.plates[id]!,
            }))
          : [],
      },
    };
  }
  return { v: 1, at: now, stage: 'idle' };
}
