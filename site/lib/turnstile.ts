import type { Env } from './types';

/** Turnstile 検証。TURNSTILE_SECRET 未設定なら無効（常に通す） */
export async function verifyTurnstile(env: Env, token: unknown, ip: string | null, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  if (typeof token !== 'string' || !token) return false;
  try {
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);
    const res = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch { return false; }
}
