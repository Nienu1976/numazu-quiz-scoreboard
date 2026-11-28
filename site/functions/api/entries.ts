import type { Env } from '../../lib/types';
import { listPublic, postEntry } from '../../lib/handlers';
export const onRequestGet: PagesFunction<Env> = ({ env }) => listPublic(env);
export const onRequestPost: PagesFunction<Env> = ({ request, env }) => postEntry(request, env);
