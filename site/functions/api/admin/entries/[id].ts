import type { Env } from '../../../../lib/types';
import { adminPatch, adminCancel } from '../../../../lib/handlers';
export const onRequestPatch: PagesFunction<Env, 'id'> = ({ request, env, params }) => adminPatch(env, String(params.id), request);
export const onRequestDelete: PagesFunction<Env, 'id'> = ({ env, params }) => adminCancel(env, String(params.id));
