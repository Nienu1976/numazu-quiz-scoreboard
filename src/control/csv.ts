// 参加者CSVの読み込み。ヘッダ付き（日本語/英語の別名可）と、ヘッダなし（氏名,表示名,卒業期,ふりがな,連絡先の順）に対応。

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      rows.push(row); row = [];
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

export interface ParsedPlayer { displayName: string; affiliation: string; realName: string; kana: string; contact: string }
type Field = keyof ParsedPlayer;

const ALIASES: Record<Field, string[]> = {
  realName: ['氏名', '本名', '名前', 'name', 'realname', 'fullname'],
  displayName: ['表示名', 'ハンドルネーム', 'ハンドル', 'ニックネーム', 'displayname', 'handle', 'nickname'],
  affiliation: ['所属', '卒業期', '期', '卒業期・所属', '卒業期所属', 'affiliation', 'class'],
  kana: ['ふりがな', 'フリガナ', 'よみ', 'kana'],
  contact: ['連絡先', 'メール', 'メールアドレス', 'email', 'mail', 'contact', 'tel', '電話'],
};
const ORDER: Field[] = ['realName', 'displayName', 'affiliation', 'kana', 'contact'];
const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_　]/g, '');

export function mapHeader(header: string[]): (Field | null)[] | null {
  const m = header.map((h) => {
    const n = norm(h);
    return ORDER.find((f) => ALIASES[f].some((a) => norm(a) === n)) ?? null;
  });
  return m.filter(Boolean).length >= 2 ? m : null; // 2列以上一致したらヘッダ行とみなす
}

export function rowsToPlayers(rows: string[][]): ParsedPlayer[] {
  if (rows.length === 0) return [];
  let map = mapHeader(rows[0]);
  const body = map ? rows.slice(1) : rows;
  if (!map) map = ORDER.slice(0, rows[0].length);
  const out: ParsedPlayer[] = [];
  for (const r of body) {
    const p: ParsedPlayer = { displayName: '', affiliation: '', realName: '', kana: '', contact: '' };
    r.forEach((v, i) => { const f = map![i]; if (f) p[f] = v.trim(); });
    if (!p.displayName) p.displayName = p.realName; // 表示名が空なら本名で代用（運営が後で編集）
    if (p.displayName || p.realName) out.push(p);
  }
  return out;
}

/** UTF-8 を優先し、不正なら Shift_JIS（Excel保存のCSV）として読む */
export function decodeCsvBytes(buf: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('shift_jis').decode(buf); }
}
