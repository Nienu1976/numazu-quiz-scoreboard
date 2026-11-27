// ルールエンジン共通型。rules_spec.md §2 準拠。UI/DOM 非依存。
export type Kind = '1R' | '2R' | '3R-A' | '3R-B' | '3R-C' | 'ExR1' | 'ExR2' | 'SF' | 'F';
export type PressKind = '2R' | '3R-A' | '3R-B' | '3R-C' | 'ExR2' | 'SF' | 'F';
export type Status = 'play' | 'win' | 'out';
export type Phase = 'main' | 'needSD' | 'sd' | 'done';
export type Plate = 'red' | 'blue' | 'yellow' | 'green';

export type Event =
  | { type: 'correct'; playerId: string; afterTimeUp?: boolean }
  | { type: 'wrong'; playerId: string; afterTimeUp?: boolean }
  | { type: 'through' }
  | { type: 'selectEnvelope'; envelopeId: string }
  | { type: 'setScore'; playerId: string; score: number }
  | { type: 'chooseCourse'; playerId: string; course: string }
  | { type: 'abort' } // 打ち切り / SFの判定確定
  | { type: 'sdStart' }
  | { type: 'finalize' };

export interface Entry {
  playerId: string;
  r1Rank: number;
  initialO?: number; // 2R: プレート由来の初期○
}

export interface Seat {
  playerId: string;
  seatNo: number;
  r1Rank: number;
  status: Status;
  winOrder: number | null;
  outOrder: number | null;
  o: number;
  x: number;
  score: number; // 3R-A / SF
  c: number; // 3R-B 正解P
  w: number; // 3R-B 誤答P
  rest: number; // F 残り休み数
}

export interface Envelope {
  id: string;
  questionNo: number;
  initial: string;
  used: boolean;
}

export interface SdState {
  players: string[];
  slots: number;
  winners: string[];
  losers: string[];
  questionCount: number;
  maxQuestions: number;
  finished: boolean;
  /** 終了後の並び: 勝者(○順/1R順) → 残り在席(1R順) → SD失格(遅い順) */
  order: string[];
}

export interface RoundState {
  kind: PressKind;
  config: EngineConfig;
  seats: Seat[];
  seatsToWin: number;
  questionCount: number;
  phase: Phase;
  sd: SdState | null;
  /** needSD 時: 境界同点者と取り合う枠数 */
  sdPending: { players: string[]; slots: number } | null;
  finalRanking: string[] | null;
  finalized: boolean;
  lastAction: string;
  holder: string | null; // 2R 連答権
  correctHistory: string[]; // 3R-C 選択者決定用
  envelopes: Envelope[];
  currentEnvelope: string | null;
  questionWrongBy: string[];
  lateAnswerUsed: boolean; // SF
}

export interface EngineConfig {
  /** N1: 誤答で問題が終わるか */
  wrongEndsQuestion: boolean;
  /** A1: 問題数上限（null=なし） */
  maxQuestions: number | null;
  /** A9: SD上限問題数 = 対象者数 + sdMaxOffset */
  sdMaxOffset: number;
  /** N2: 在席者数 ≤ 残り枠で自動勝ち抜け */
  autoAdvance: boolean;
  /** A6: 初期○で連答権が付くか */
  r2InitialHolder: boolean;
  /** design_system 暫定: 連答+2のあと連答権が続くか */
  r2BonusKeepsHolder: boolean;
  /** A5: 連答権保持者の×で権利が消えるか */
  r2WrongByHolderClears: boolean;
  /** 他人の×で連答権が消えるか */
  r2WrongByOthersClears: boolean;
  /** スルーで連答権が消えるか */
  r2ThroughClears: boolean;
  /** A15: 7by7 勝ち抜け条件 */
  sevenBySevenWin: 'product' | 'c7' | 'none';
  sevenBySevenTarget: number;
  /** N6: SFの得点がマイナスになるか */
  sfAllowNegative: boolean;
  /** N7: SFタイムアップ前に押された解答を1回分有効にするか */
  sfLateAnswer: boolean;
  /** ExR 進出定員 */
  exrCapacity: number;
  /** A8: 進出者がこの人数以下なら phase2 を行わず全員復活 */
  exrDirectAdvanceMax: number;
  /** 3R コース定員 (A3) */
  courseCapacity: number;
}
