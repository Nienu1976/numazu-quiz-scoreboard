import raw from '../site.config.json';
import type { SiteConfig, Env } from './types';

export const siteConfig = raw as unknown as SiteConfig;

export type EntryState = 'open' | 'not_yet' | 'closed' | 'full';

/** 受付期間（null は無制限）。定員は confirmedCount を渡して判定（overflow=close のときのみ full） */
export function entryState(cfg: SiteConfig, now: Date, confirmedCount: number): EntryState {
  const { opensAt, closesAt, capacity, overflow } = cfg.entry;
  if (opensAt && now.getTime() < Date.parse(opensAt)) return 'not_yet';
  if (closesAt && now.getTime() >= Date.parse(closesAt)) return 'closed';
  if (overflow === 'close' && confirmedCount >= capacity) return 'full';
  return 'open';
}

/** ブラウザへ渡してよい設定だけ（Turnstile の site key は公開値） */
export function publicConfig(cfg: SiteConfig, env: Pick<Env, 'TURNSTILE_SITE_KEY' | 'TURNSTILE_SECRET'>, state: EntryState, confirmed: number, waitlist: number) {
  return {
    event: cfg.event,
    entry: {
      capacity: cfg.entry.capacity, overflow: cfg.entry.overflow,
      opensAt: cfg.entry.opensAt, closesAt: cfg.entry.closesAt,
      privacyNotice: cfg.entry.privacyNotice,
      state, confirmed, waitlist,
    },
    turnstileSiteKey: env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY ? env.TURNSTILE_SITE_KEY : null,
  };
}
