import type { Env } from '../../../lib/types';
import { adminList } from '../../../lib/handlers';
export const onRequestGet: PagesFunction<Env> = ({ env }) => adminList(env);
