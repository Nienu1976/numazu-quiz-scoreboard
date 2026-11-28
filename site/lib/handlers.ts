import type { Env, EntryRow, Status } from './types';
import { siteConfig, entryState, publicConfig } from './config';
import { validateEntry, dedupeKey, clean } from './validate';
import { verifyTurnstile } from './turnstile';
import { toCsv } from './csv';
import { json, err, receiptNo, parseReceipt } from './respond';

const MAX_BODY = 8 * 1024;
const isUnique = (e: unknown) => /UNIQUE constraint failed/i.test(String((e as Error)?.message ?? e));

async function counts(env: Env): Promise<{ confirmed: number; waitlist: number }> {
  const { results } = await env.DB.prepare(`SELECT status, COUNT(*) AS n FROM entries WHERE status != 'cancelled' GROUP BY status`).all<{ status: Status; n: number }>();
  const c = { confirmed: 0, waitlist: 0 };
  for (const r of results) if (r.status === 'confirmed' || r.status === 'waitlist') c[r.status] = r.n;
  return c;
}

// ---------- 公開 API ----------

export async function getConfig(env: Env, now = new Date()): Promise<Response> {
  const c = await counts(env);
  return json(publicConfig(siteConfig, env, entryState(siteConfig, now, c.confirmed), c.confirmed, c.waitlist));
}

/** 公開リスト。SQL で列を表示名・卒業期に限定し、本名・ふりがな・連絡先は読み出さない */
export async function listPublic(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(`SELECT id, display_name, ki FROM entries WHERE status = 'confirmed' ORDER BY id`).all<{ id: number; display_name: string; ki: string }>();
  const c = await counts(env);
  return json({
    capacity: siteConfig.entry.capacity,
    confirmed: c.confirmed,
    waitlist: c.waitlist,
    entries: results.map((r) => ({ no: receiptNo(r.id), displayName: r.display_name, ki: r.ki })),
  });
}

export async function postEntry(request: Request, env: Env, now = new Date()): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return err(403, 'bad_origin', '不正なリクエストです');
  const text = await request.text();
  if (text.length > MAX_BODY) return err(413, 'too_large', '送信内容が大きすぎます');
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); if (!body || typeof body !== 'object' || Array.isArray(body)) throw 0; }
  catch { return err(400, 'bad_json', '送信内容を読み取れませんでした'); }

  // honeypot: 人間には見えない欄。埋まっていたらボットとみなし、成功を装って何も保存しない
  if (clean(body.website) !== '') return json({ ok: true, receiptNo: 'E0000', status: 'confirmed', displayName: clean(body.displayName) }, 201);

  const c = await counts(env);
  const state = entryState(siteConfig, now, c.confirmed);
  if (state !== 'open') return err(403, state, { not_yet: 'まだ受付を開始していません', closed: '受付は終了しました', full: '定員に達したため受付を締め切りました' }[state]);

  const v = validateEntry(body);
  if (!v.ok) return err(422, 'invalid', '入力内容を確認してください', { fields: v.errors });
  if (body.consent !== true) return err(422, 'invalid', '個人情報の取り扱いへの同意が必要です', { fields: { consent: '同意にチェックしてください' } });
  if (!(await verifyTurnstile(env, body.turnstileToken, request.headers.get('CF-Connecting-IP')))) return err(403, 'turnstile', 'ボット確認に失敗しました。もう一度お試しください');

  const { realName, displayName, ki, kana, contact } = v.value;
  const iso = now.toISOString();
  const cap = siteConfig.entry.capacity;
  try {
    // 定員判定と挿入を1文で行い、同時送信でも定員を超えて confirmed にならない
    const res = await env.DB.prepare(
      `INSERT INTO entries (real_name, display_name, ki, kana, contact, dedupe_key, status, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, ?,
              CASE WHEN (SELECT COUNT(*) FROM entries WHERE status = 'confirmed') < ? THEN 'confirmed' ELSE 'waitlist' END, ?, ?
       WHERE (? = 'waitlist' OR (SELECT COUNT(*) FROM entries WHERE status = 'confirmed') < ?)`,
    ).bind(realName, displayName, ki, kana, contact, dedupeKey(realName, ki), cap, iso, iso, siteConfig.entry.overflow, cap).run();
    if (!res.meta.changes) return err(403, 'full', '定員に達したため受付を締め切りました');
    const id = res.meta.last_row_id as number;
    const row = await env.DB.prepare(`SELECT status FROM entries WHERE id = ?`).bind(id).first<{ status: Status }>();
    return json({ ok: true, receiptNo: receiptNo(id), status: row?.status ?? 'confirmed', displayName }, 201);
  } catch (e) {
    if (isUnique(e)) return err(409, 'duplicate', '同じ氏名・卒業期の方がすでにエントリー済みです。心当たりがない場合は運営へご連絡ください');
    throw e;
  }
}

// ---------- 管理 API（呼び出し側で requireAccess 済み） ----------

const ADMIN_COLS = 'id, real_name, display_name, ki, kana, contact, status, created_at, updated_at';
const adminView = (r: EntryRow) => ({
  id: r.id, receiptNo: receiptNo(r.id), realName: r.real_name, displayName: r.display_name, ki: r.ki,
  kana: r.kana, contact: r.contact, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
});

export async function adminList(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(`SELECT ${ADMIN_COLS} FROM entries ORDER BY id`).all<EntryRow>();
  const c = await counts(env);
  return json({ capacity: siteConfig.entry.capacity, ...c, entries: results.map(adminView) });
}

async function promoteWaitlist(env: Env, now: Date) {
  if (!siteConfig.entry.autoPromote) return;
  await env.DB.prepare(
    `UPDATE entries SET status = 'confirmed', updated_at = ?
     WHERE id = (SELECT id FROM entries WHERE status = 'waitlist' ORDER BY id LIMIT 1)
       AND (SELECT COUNT(*) FROM entries WHERE status = 'confirmed') < ?`,
  ).bind(now.toISOString(), siteConfig.entry.capacity).run();
}

export async function adminPatch(env: Env, idStr: string, request: Request, now = new Date()): Promise<Response> {
  const id = parseReceipt(idStr);
  if (id === null) return err(400, 'bad_id', 'IDが不正です');
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return err(400, 'bad_json', '送信内容を読み取れませんでした'); }
  const cur = await env.DB.prepare(`SELECT ${ADMIN_COLS} FROM entries WHERE id = ?`).bind(id).first<EntryRow>();
  if (!cur) return err(404, 'not_found', '該当するエントリーがありません');

  const merged = {
    realName: 'realName' in body ? body.realName : cur.real_name,
    displayName: 'displayName' in body ? body.displayName : cur.display_name,
    ki: 'ki' in body ? body.ki : cur.ki,
    kana: 'kana' in body ? body.kana : cur.kana,
    contact: 'contact' in body ? body.contact : cur.contact,
  };
  const v = validateEntry(merged);
  if (!v.ok) return err(422, 'invalid', '入力内容を確認してください', { fields: v.errors });
  const status = (body.status ?? cur.status) as Status;
  if (!['confirmed', 'waitlist', 'cancelled'].includes(status)) return err(422, 'invalid', '状態が不正です');

  try {
    await env.DB.prepare(
      `UPDATE entries SET real_name=?, display_name=?, ki=?, kana=?, contact=?, dedupe_key=?, status=?, updated_at=? WHERE id=?`,
    ).bind(v.value.realName, v.value.displayName, v.value.ki, v.value.kana, v.value.contact,
      dedupeKey(v.value.realName, v.value.ki), status, now.toISOString(), id).run();
  } catch (e) {
    if (isUnique(e)) return err(409, 'duplicate', '同じ氏名・卒業期の有効なエントリーがすでにあります');
    throw e;
  }
  if (cur.status === 'confirmed' && status !== 'confirmed') await promoteWaitlist(env, now);
  const row = await env.DB.prepare(`SELECT ${ADMIN_COLS} FROM entries WHERE id = ?`).bind(id).first<EntryRow>();
  return json({ ok: true, entry: adminView(row!) });
}

/** 取消（物理削除はしない。状態を cancelled にする） */
export async function adminCancel(env: Env, idStr: string, now = new Date()): Promise<Response> {
  const id = parseReceipt(idStr);
  if (id === null) return err(400, 'bad_id', 'IDが不正です');
  const cur = await env.DB.prepare(`SELECT status FROM entries WHERE id = ?`).bind(id).first<{ status: Status }>();
  if (!cur) return err(404, 'not_found', '該当するエントリーがありません');
  await env.DB.prepare(`UPDATE entries SET status = 'cancelled', updated_at = ? WHERE id = ?`).bind(now.toISOString(), id).run();
  if (cur.status === 'confirmed') await promoteWaitlist(env, now);
  return json({ ok: true });
}

/** 操作画面の読込形式のCSV。既定は確定のみ。?include=waitlist でキャンセル待ちも末尾に付ける */
export async function adminCsv(env: Env, url: URL): Promise<Response> {
  const statuses = url.searchParams.get('include') === 'waitlist' ? `('confirmed','waitlist')` : `('confirmed')`;
  const { results } = await env.DB.prepare(
    `SELECT real_name, display_name, ki, kana, contact FROM entries WHERE status IN ${statuses} ORDER BY CASE status WHEN 'confirmed' THEN 0 ELSE 1 END, id`,
  ).all<Pick<EntryRow, 'real_name' | 'display_name' | 'ki' | 'kana' | 'contact'>>();
  return new Response(toCsv(results), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="entries_${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
