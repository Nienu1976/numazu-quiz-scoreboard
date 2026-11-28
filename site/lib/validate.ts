export interface EntryInput { realName: string; displayName: string; ki: string; kana: string; contact: string }

const LIMITS = { realName: 40, displayName: 20, ki: 30, kana: 60, contact: 100 } as const;
const LABEL: Record<keyof EntryInput, string> = {
  realName: '氏名（本名）', displayName: '表示名', ki: '所属', kana: 'ふりがな', contact: '連絡先',
};

/** 制御文字を除去し、前後の空白を落とす（改行・タブも除去） */
export function clean(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.normalize('NFC').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').trim();
}

/** 重複判定キー: 本名＋ふりがな。NFKC・空白除去・小文字化・カタカナ→ひらがなで表記ゆれを吸収 */
export function dedupeKey(realName: string, kana: string): string {
  const n = (s: string) => s.normalize('NFKC').replace(/[\s\u3000]/g, '').toLowerCase();
  const hira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  return `${n(realName)}|${hira(n(kana))}`;
}

const KANA_RE = /^[ぁ-ゖァ-ヺー・゛゜\s　]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9０-９+＋\-－ー()（）\s　]{8,}$/;

export function validateEntry(body: Record<string, unknown>): { ok: true; value: EntryInput } | { ok: false; errors: Record<string, string> } {
  const value: EntryInput = {
    realName: clean(body.realName), displayName: clean(body.displayName),
    ki: clean(body.ki), kana: clean(body.kana), contact: clean(body.contact),
  };
  const errors: Record<string, string> = {};
  for (const k of Object.keys(LIMITS) as (keyof EntryInput)[]) {
    if (!value[k]) errors[k] = `${LABEL[k]}を入力してください`;
    else if ([...value[k]].length > LIMITS[k]) errors[k] = `${LABEL[k]}は${LIMITS[k]}文字以内で入力してください`;
  }
  if (!errors.kana && !KANA_RE.test(value.kana)) errors.kana = 'ふりがなはひらがな（またはカタカナ）で入力してください';
  if (!errors.contact && !EMAIL_RE.test(value.contact) && !PHONE_RE.test(value.contact)) {
    errors.contact = '連絡先はメールアドレスまたは電話番号で入力してください';
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
