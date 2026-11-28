import type { Env } from '../../lib/types';
import { getConfig } from '../../lib/handlers';
export const onRequestGet: PagesFunction<Env> = ({ env }) => getConfig(env);
