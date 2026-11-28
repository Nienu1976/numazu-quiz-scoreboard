-- エントリー台帳。受付番号は id から 'E' + 4桁0埋めで導出（列は持たない）
CREATE TABLE entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  real_name    TEXT NOT NULL,
  display_name TEXT NOT NULL,
  ki           TEXT NOT NULL,           -- 卒業期・所属
  kana         TEXT NOT NULL,
  contact      TEXT NOT NULL,
  dedupe_key   TEXT NOT NULL,           -- 正規化した 本名|ふりがな
  status       TEXT NOT NULL CHECK (status IN ('confirmed','waitlist','cancelled')),
  created_at   TEXT NOT NULL,           -- ISO8601 UTC
  updated_at   TEXT NOT NULL
);
-- 取消でない受付の中で 本名＋ふりがな を一意に（同時送信の競合もここで止める）
CREATE UNIQUE INDEX idx_entries_dedupe_active ON entries (dedupe_key) WHERE status != 'cancelled';
CREATE INDEX idx_entries_status_id ON entries (status, id);
