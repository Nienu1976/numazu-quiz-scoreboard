export interface Env {
  DB: D1Database;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  ACCESS_BYPASS_LOCAL?: string;
}
export type Status = 'confirmed' | 'waitlist' | 'cancelled';
export interface EntryRow {
  id: number; real_name: string; display_name: string; ki: string; kana: string; contact: string;
  status: Status; created_at: string; updated_at: string;
}
export interface SiteConfig {
  event: { name: string; subtitle: string; dateISO: string; dateLabel: string;
    venue: string | null; schedule: string | null; fee: string | null; terms: string | null; inquiry: string | null };
  entry: { capacity: number; overflow: 'waitlist' | 'close'; autoPromote: boolean;
    opensAt: string | null; closesAt: string | null; privacyNotice: string };
}
