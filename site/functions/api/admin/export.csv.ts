import type { Env } from '../../../lib/types';
import { adminCsv } from '../../../lib/handlers';
export const onRequestGet: PagesFunction<Env> = ({ request, env }) => adminCsv(env, new URL(request.url));
