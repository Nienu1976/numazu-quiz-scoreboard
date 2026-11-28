export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra },
  });
}
export const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  json({ error: code, message, ...extra }, status);

export const receiptNo = (id: number) => `E${String(id).padStart(4, '0')}`;
export function parseReceipt(v: string): number | null {
  const m = /^E?(\d{1,9})$/i.exec(v.trim());
  return m ? Number(m[1]) : null;
}
