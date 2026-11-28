import type { Env } from '../../../lib/types';
import { requireAccess } from '../../../lib/access';
// /api/admin/* はすべて Cloudflare Access 経由必須（Access ポリシーに加えて Functions 側でも検査）
export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => (await requireAccess(request, env)) ?? next();
