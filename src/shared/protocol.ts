// 操作画面 → 表示画面 の送信データ。本名・ふりがな・連絡先は型に存在しない（送れない）。
export const CHANNEL_NAME = 'numazu-quiz-display';

export type PlateKey = 'red' | 'blue' | 'yellow' | 'green';

export interface DisplaySeat {
  seatNo: number;
  displayName: string;
  ki: string;
  plate: PlateKey | null;
  status: 'play' | 'win' | 'out';
  o: number;
  x: number;
  winOrder: number | null;
  isHolder: boolean; // 2R 連答権
}

export interface DisplayR1Row { rank: number; displayName: string; ki: string; plate: PlateKey }

export interface DisplayPayload {
  v: 1;
  at: number;
  stage: 'idle' | 'r1' | 'r2';
  /** 1R 確定後のみ rows が入る（確定前に順位を漏らさない） */
  r1?: { finalized: boolean; rows: DisplayR1Row[] };
  r2?: {
    groupIndex: number;
    groupCount: number;
    label: string;
    phase: 'main' | 'needSD' | 'sd' | 'done';
    seatsToWin: number;
    winCount: number;
    questionCount: number;
    seats: DisplaySeat[];
    sdPlayers: number[]; // SD 対象の席番
    finalRanking: number[] | null; // 席番の順位並び
  };
}

export type ChannelMessage = { type: 'state'; payload: DisplayPayload } | { type: 'hello' };
