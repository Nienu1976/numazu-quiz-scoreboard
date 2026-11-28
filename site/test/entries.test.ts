import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeEnv, post, person } from './d1shim';
import * as cfg from '../lib/config';
import { postEntry, listPublic, adminList, adminPatch, adminCancel, adminCsv, getConfig } from '../lib/handlers';
import { rowsToPlayers, parseCsv } from '../../src/control/csv';

const C = cfg.siteConfig.entry;
const orig = { ...C };
beforeEach(() => Object.assign(C, orig, { capacity: 3, overflow: 'waitlist', opensAt: null, closesAt: null, autoPromote: true }));
const send = async (env: ReturnType<typeof makeEnv>, p = person(), now?: Date) => {
  const r = await postEntry(post(p), env, now);
  return { status: r.status, body: await r.json() as any };
};

describe('公開API: 個人情報を返さない', () => {
  it('一覧は表示名・卒業期・受付番号のみ。本名/ふりがな/連絡先は文字列としても含まれない', async () => {
    const env = makeEnv();
    const ps = [person({ realName: '秘密の本名A', kana: 'ひみつのかなあ', contact: 'secretA@example.com' }), person({ realName: '秘密の本名B', kana: 'ひみつのかない', contact: '090-1111-2222' })];
    for (const p of ps) expect((await send(env, p)).status).toBe(201);
    const res = await listPublic(env);
    const text = await res.text();
    const data = JSON.parse(text);
    expect(Object.keys(data).sort()).toEqual(['capacity', 'confirmed', 'entries', 'waitlist']);
    for (const e of data.entries) expect(Object.keys(e).sort()).toEqual(['displayName', 'ki', 'no']);
    for (const s of ['秘密の本名', 'ひみつのかな', 'secretA', '090-1111', 'realName', 'contact', 'kana']) expect(text).not.toContain(s);
    expect(data.entries[0].displayName).toBe(ps[0].displayName);
  });
  it('キャンセル待ち・取消の人は公開リストに出ない（人数のみ）', async () => {
    const env = makeEnv();
    for (let i = 0; i < 4; i++) await send(env);
    const data = await (await listPublic(env)).json() as any;
    expect(data.entries).toHaveLength(3);
    expect(data.waitlist).toBe(1);
  });
  it('POST応答・設定APIにも個人情報は含まれない', async () => {
    const env = makeEnv();
    const r = await send(env, person({ realName: '秘密の本名', contact: 'x@example.com' }));
    expect(JSON.stringify(r.body)).not.toMatch(/秘密の本名|x@example/);
    expect(await (await getConfig(env)).text()).not.toMatch(/秘密の本名|x@example|TURNSTILE_SECRET/);
  });
});

describe('定員・キャンセル待ち', () => {
  it('定員まで confirmed、超過は waitlist（設定 waitlist）', async () => {
    const env = makeEnv();
    const r = [];
    for (let i = 0; i < 5; i++) r.push((await send(env)).body.status);
    expect(r).toEqual(['confirmed', 'confirmed', 'confirmed', 'waitlist', 'waitlist']);
  });
  it('overflow=close なら超過は 403 full', async () => {
    C.overflow = 'close';
    const env = makeEnv();
    for (let i = 0; i < 3; i++) await send(env);
    const r = await send(env);
    expect(r.status).toBe(403); expect(r.body.error).toBe('full');
  });
  it('同時送信しても confirmed は定員を超えない', async () => {
    const env = makeEnv();
    await Promise.all(Array.from({ length: 10 }, () => send(env)));
    const d = await (await listPublic(env)).json() as any;
    expect(d.confirmed).toBe(3); expect(d.waitlist).toBe(7);
  });
  it('確定者を取消すとキャンセル待ちの先頭が繰り上がる', async () => {
    const env = makeEnv();
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push((await send(env)).body.receiptNo);
    await adminCancel(env, ids[0]);
    const d = await (await adminList(env)).json() as any;
    expect(d.entries.map((e: any) => e.status)).toEqual(['cancelled', 'confirmed', 'confirmed', 'confirmed']);
  });
});

describe('受付期間', () => {
  it('開始前は not_yet、終了後は closed、期間内は open', async () => {
    C.opensAt = '2027-01-10T00:00:00+09:00'; C.closesAt = '2027-02-10T00:00:00+09:00';
    const env = makeEnv();
    expect((await send(env, person(), new Date('2027-01-09T14:59:59Z'))).body.error).toBe('not_yet');
    expect((await send(env, person(), new Date('2027-01-09T15:00:00Z'))).status).toBe(201);
    expect((await send(env, person(), new Date('2027-02-09T15:00:00Z'))).body.error).toBe('closed');
  });
  it('設定APIが受付状態を返す', async () => {
    C.closesAt = '2020-01-01T00:00:00Z';
    const d = await (await getConfig(makeEnv())).json() as any;
    expect(d.entry.state).toBe('closed');
  });
});

describe('重複・入力検証・ボット対策', () => {
  it('本名＋卒業期が同じなら 409（全角半角・空白の表記ゆれも同一視）', async () => {
    const env = makeEnv();
    expect((await send(env, person({ realName: '山田 太郎', ki: '第50期' }))).status).toBe(201);
    const r = await send(env, person({ realName: '山田　太郎', ki: '第５０期' }));
    expect(r.status).toBe(409); expect(r.body.error).toBe('duplicate');
  });
  it('卒業期が違えば別人。取消後は同じ人が再エントリーできる', async () => {
    const env = makeEnv();
    const a = await send(env, person({ realName: '田中一郎', ki: '第40期' }));
    expect((await send(env, person({ realName: '田中一郎', ki: '第41期' }))).status).toBe(201);
    await adminCancel(env, a.body.receiptNo);
    expect((await send(env, person({ realName: '田中一郎', ki: '第40期' }))).status).toBe(201);
  });
  it('必須欠落・ふりがな・連絡先形式・同意なしは 422', async () => {
    const env = makeEnv();
    expect((await send(env, person({ realName: '' }))).body.fields.realName).toBeTruthy();
    expect((await send(env, person({ kana: 'Yamada' }))).body.fields.kana).toBeTruthy();
    expect((await send(env, person({ contact: 'あいう' }))).body.fields.contact).toBeTruthy();
    expect((await send(env, person({ consent: false }))).body.fields.consent).toBeTruthy();
  });
  it('honeypot が埋まっていたら成功を装って保存しない', async () => {
    const env = makeEnv();
    const r = await send(env, person({ website: 'http://spam' }));
    expect(r.status).toBe(201);
    expect((await (await listPublic(env)).json() as any).confirmed).toBe(0);
  });
  it('Turnstile: 秘密鍵が設定されていればトークン必須。未設定なら無効', async () => {
    expect((await send(makeEnv())).status).toBe(201);
    const env = makeEnv({ TURNSTILE_SECRET: 'x' });
    const f = vi.fn(async () => new Response(JSON.stringify({ success: true })));
    vi.stubGlobal('fetch', f);
    expect((await send(env, person())).status).toBe(403);
    expect((await send(env, person({ turnstileToken: 'tok' }))).status).toBe(201);
    f.mockResolvedValueOnce(new Response(JSON.stringify({ success: false })));
    expect((await send(env, person({ turnstileToken: 'bad' }))).status).toBe(403);
    vi.unstubAllGlobals();
  });
  it('別オリジンからの POST は拒否', async () => {
    const r = await postEntry(post(person(), { Origin: 'https://evil.test' }), makeEnv());
    expect(r.status).toBe(403);
  });
});

describe('管理API', () => {
  it('一覧は全項目、修正でき、重複する修正は 409', async () => {
    const env = makeEnv();
    const a = await send(env, person({ realName: '甲', ki: '第1期' }));
    await send(env, person({ realName: '乙', ki: '第1期' }));
    const list = await (await adminList(env)).json() as any;
    expect(list.entries[0]).toMatchObject({ realName: '甲', kana: 'やまだたろう' });
    const ok = await adminPatch(env, a.body.receiptNo, new Request('https://x.test', { method: 'PATCH', body: JSON.stringify({ displayName: '新表示名' }) }));
    expect((await ok.json() as any).entry.displayName).toBe('新表示名');
    const dup = await adminPatch(env, a.body.receiptNo, new Request('https://x.test', { method: 'PATCH', body: JSON.stringify({ realName: '乙' }) }));
    expect(dup.status).toBe(409);
  });
  it('存在しない番号は 404', async () => {
    expect((await adminCancel(makeEnv(), 'E9999')).status).toBe(404);
  });
});

describe('CSV 書き出し（操作画面の読込形式）', () => {
  it('ヘッダ・BOM・CRLF で、src/control/csv.ts でそのまま読み戻せる', async () => {
    const env = makeEnv();
    C.capacity = 2;
    await send(env, person({ realName: '山田 太郎', displayName: 'カツオ,"番長"', ki: '第50期', kana: 'やまだ たろう', contact: 'a@example.com' }));
    await send(env, person({ realName: '鈴木花子', displayName: 'しおかぜ', ki: '第39期', kana: 'すずき はなこ', contact: '090-1234-5678' }));
    await send(env, person({ realName: '待ち人', displayName: 'まち', ki: '第1期' }));
    const buf = new Uint8Array(await (await adminCsv(env, new URL('https://x.test/api/admin/export.csv'))).arrayBuffer());
    expect([...buf.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM（Excel でも文字化けしない）
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(buf);
    expect(text.slice(1).startsWith('氏名,表示名,卒業期,ふりがな,連絡先\r\n')).toBe(true);
    const players = rowsToPlayers(parseCsv(text));
    expect(players).toHaveLength(2);
    expect(players[0]).toEqual({ realName: '山田 太郎', displayName: 'カツオ,"番長"', ki: '第50期', kana: 'やまだ たろう', contact: 'a@example.com' });
    expect(players[1].realName).toBe('鈴木花子');
    const all = rowsToPlayers(parseCsv(await (await adminCsv(env, new URL('https://x.test/?include=waitlist'))).text()));
    expect(all.map((p) => p.realName)).toEqual(['山田 太郎', '鈴木花子', '待ち人']);
  });
  it('数式として解釈されうる値は無害化する', async () => {
    const env = makeEnv();
    await send(env, person({ displayName: '=HYPERLINK("x")' }));
    const text = await (await adminCsv(env, new URL('https://x.test/'))).text();
    expect(text).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
