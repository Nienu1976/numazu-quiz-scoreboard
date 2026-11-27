import type { EngineConfig, Event, SdState } from './types';

/** サドンデス（rules_spec §4）。純粋関数。 */
export function sdStart(players: string[], slots: number, cfg: EngineConfig): SdState {
  return {
    players: [...players],
    slots,
    winners: [],
    losers: [],
    questionCount: 0,
    maxQuestions: players.length + cfg.sdMaxOffset,
    finished: false,
    order: [],
  };
}

const alive = (sd: SdState) =>
  sd.players.filter((p) => !sd.winners.includes(p) && !sd.losers.includes(p));

export function sdApply(
  sd: SdState,
  ev: Event,
  r1Rank: Record<string, number>,
  cfg: EngineConfig,
): SdState {
  if (sd.finished) return sd;
  const n: SdState = { ...sd, winners: [...sd.winners], losers: [...sd.losers] };
  if (ev.type === 'correct') {
    if (!alive(sd).includes(ev.playerId)) return sd;
    n.winners.push(ev.playerId);
    n.questionCount++;
  } else if (ev.type === 'wrong') {
    if (!alive(sd).includes(ev.playerId)) return sd;
    n.losers.push(ev.playerId);
    if (cfg.wrongEndsQuestion) n.questionCount++;
  } else if (ev.type === 'through') {
    n.questionCount++;
  } else return sd;

  const byR1 = (a: string, b: string) => r1Rank[a] - r1Rank[b];
  const rest = () => n.slots - n.winners.length;
  const fillFromAlive = () => {
    const a = alive(n).sort(byR1);
    n.winners.push(...a.slice(0, rest()));
  };
  if (n.winners.length >= n.slots) {
    // 1. 枠が埋まった
  } else if (alive(n).length <= rest()) {
    fillFromAlive(); // 2. 残り在席数 ≤ 残り枠
  } else if (n.questionCount >= n.maxQuestions) {
    fillFromAlive(); // 3. 上限到達 → 1R順位 (A10)
  } else return n;

  n.finished = true;
  const remaining = alive(n).sort(byR1);
  n.order = [...n.winners, ...remaining, ...[...n.losers].reverse()];
  return n;
}
