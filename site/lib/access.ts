import type { Env } from './types';
import { err } from './respond';

const b64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const dec = (s: string) => JSON.parse(new TextDecoder().decode(b64u(s)));

type FetchLike = (url: string) => Promise<Response>;

/** Cloudflare Access の JWT を検証（RS256・aud・exp）。TEAM_DOMAIN / AUD 設定時のみ呼ばれる */
export async function verifyAccessJwt(token: string, teamDomain: string, aud: string, fetcher: FetchLike = (u) => fetch(u), nowSec = Math.floor(Date.now() / 1000)): Promise<boolean> {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return false;
    const header = dec(h), payload = dec(p);
    if (header.alg !== 'RS256') return false;
    const auds: string[] = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) return false;
    if (typeof payload.exp !== 'number' || payload.exp < nowSec) return false;
    if (payload.iss !== `https://${teamDomain}`) return false;
    const res = await fetcher(`https://${teamDomain}/cdn-cgi/access/certs`);
    if (!res.ok) return false;
    const { keys } = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(s), new TextEncoder().encode(`${h}.${p}`));
  } catch { return false; }
}

/** 管理系の入口。通れば null、拒否なら 401/403 の Response を返す */
export async function requireAccess(request: Request, env: Env, fetcher?: FetchLike): Promise<Response | null> {
  if (env.ACCESS_BYPASS_LOCAL === '1') {
    // ローカル開発専用。localhost 以外では無効にして、本番に設定が紛れても素通りさせない
    const host = new URL(request.url).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return null;
  }
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) return err(401, 'access_required', 'Cloudflare Access を経由していないリクエストです');
  if (env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD) {
    const ok = await verifyAccessJwt(jwt, env.CF_ACCESS_TEAM_DOMAIN, env.CF_ACCESS_AUD, fetcher);
    if (!ok) return err(403, 'access_invalid', 'Access の認証情報を確認できません');
  }
  return null;
}
