import { describe, it, expect } from 'vitest';
import { requireAccess, verifyAccessJwt } from '../lib/access';
import { makeEnv } from './d1shim';

const req = (headers: Record<string, string> = {}, url = 'https://example.test/api/admin/entries') => new Request(url, { headers });
const b64u = (b: ArrayBuffer | string) => Buffer.from(typeof b === 'string' ? b : new Uint8Array(b)).toString('base64url');

async function makeJwt(over: Record<string, unknown> = {}, team = 'team.cloudflareaccess.com', aud = 'AUD1') {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1' };
  const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1' }));
  const p = b64u(JSON.stringify({ aud: [aud], exp: 2_000_000_000, iss: `https://${team}`, ...over }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(`${h}.${p}`));
  const fetcher = async () => new Response(JSON.stringify({ keys: [jwk] }));
  return { token: `${h}.${p}.${b64u(sig)}`, fetcher };
}

describe('管理API の Access 検査', () => {
  it('Cf-Access-Jwt-Assertion が無ければ 401', async () => {
    const r = await requireAccess(req(), makeEnv());
    expect(r?.status).toBe(401);
  });
  it('ヘッダがあれば（検証設定なしなら）通る', async () => {
    expect(await requireAccess(req({ 'Cf-Access-Jwt-Assertion': 'x.y.z' }), makeEnv())).toBeNull();
  });
  it('ACCESS_BYPASS_LOCAL は localhost でのみ有効', async () => {
    const env = makeEnv({ ACCESS_BYPASS_LOCAL: '1' });
    expect(await requireAccess(req({}, 'http://localhost:8788/api/admin/entries'), env)).toBeNull();
    expect((await requireAccess(req({}, 'https://numazu.pages.dev/api/admin/entries'), env))?.status).toBe(401);
  });
  it('JWT 検証: 正しい署名・aud は通り、aud 違い・期限切れ・改ざんは拒否', async () => {
    const { token, fetcher } = await makeJwt();
    const T = 'team.cloudflareaccess.com';
    expect(await verifyAccessJwt(token, T, 'AUD1', fetcher, 1_700_000_000)).toBe(true);
    expect(await verifyAccessJwt(token, T, 'OTHER', fetcher, 1_700_000_000)).toBe(false);
    expect(await verifyAccessJwt(token, T, 'AUD1', fetcher, 2_100_000_000)).toBe(false);
    const [h, p, s] = token.split('.');
    const forged = `${h}.${b64u(JSON.stringify({ aud: ['AUD1'], exp: 2_000_000_000, iss: `https://${T}`, email: 'evil' }))}.${s}`;
    expect(await verifyAccessJwt(forged, T, 'AUD1', fetcher, 1_700_000_000)).toBe(false);
  });
  it('検証設定ありで不正トークンなら 403', async () => {
    const env = makeEnv({ CF_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com', CF_ACCESS_AUD: 'AUD1' });
    const r = await requireAccess(req({ 'Cf-Access-Jwt-Assertion': 'a.b.c' }), env, async () => new Response('{}'));
    expect(r?.status).toBe(403);
  });
});
