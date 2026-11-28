// 操作画面（src/control/csv.ts）の読込形式: ヘッダ「氏名,表示名,卒業期,ふりがな,連絡先」。UTF-8(BOM付き)・CRLF
export const CSV_HEADER = ['氏名', '表示名', '卒業期', 'ふりがな', '連絡先'];

/** 表計算ソフトで開いたときの数式実行を防ぐ（先頭が = @ タブ、または記号+数字以外の +/-） */
export function neutralizeFormula(v: string): string {
  if (/^[=@\t\r]/.test(v) || /^[+\-][^0-9\s]/.test(v)) return `'${v}`;
  return v;
}
export function csvCell(v: string): string {
  const s = neutralizeFormula(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows: { real_name: string; display_name: string; ki: string; kana: string; contact: string }[]): string {
  const lines = [CSV_HEADER.join(',')];
  for (const r of rows) lines.push([r.real_name, r.display_name, r.ki, r.kana, r.contact].map(csvCell).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
