import type { Env } from '../../lib/types';
import { requireAccess } from '../../lib/access';
// /admin（静的ページ）も同じ検査を通す
export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => (await requireAccess(request, env)) ?? next();
