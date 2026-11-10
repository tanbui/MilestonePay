import { todayInZone } from "./domain/dates";
import type { ISODate } from "./domain/types";

/**
 * Runtime configuration, read from environment variables.
 *
 * Every integration falls back to a mock when its credentials are missing,
 * so `npm run dev` works with no keys at all. See `.env.example`.
 */
export interface AppConfig {
  paypal: {
    mode: "mock" | "sandbox";
    clientId?: string;
    clientSecret?: string;
    apiBase: string;
    webhookId?: string;
    skipWebhookVerify: boolean;
    /** Sandbox buyer account that receives every invoice (optional). */
    demoClientEmail?: string;
    /** Sandbox personal account that receives every payout (optional). */
    demoPayoutEmail?: string;
  };
  ai: {
    mode: "mock" | "claude";
    apiKey?: string;
    model: string;
  };
  store: {
    mode: "memory" | "postgres";
    databaseUrl?: string;
  };
  timeZone: string;
  /** Pin "today" (YYYY-MM-DD) for repeatable demos. */
  demoToday?: ISODate;
  agencyName: string;
  defaultTermDays: number;
  cronSecret?: string;
}

function flag(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

/** Trims whitespace and one pair of surrounding quotes (easy to paste into a host's env UI). */
function clean(value: string | undefined): string | undefined {
  let v = value?.trim();
  if (v && v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) v = v.slice(1, -1).trim();
  return v ? v : undefined;
}

const DEFAULT_TIME_ZONE = "America/Los_Angeles";
let warnedTimeZone = false;

function validTimeZone(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    if (!warnedTimeZone) {
      warnedTimeZone = true;
      console.warn(`[milestone-pay] APP_TIMEZONE "${value}" isn't a valid IANA time zone; using ${DEFAULT_TIME_ZONE}.`);
    }
    return undefined;
  }
}

export function getConfig(): AppConfig {
  const env = process.env;

  const clientId = clean(env.PAYPAL_CLIENT_ID);
  const clientSecret = clean(env.PAYPAL_CLIENT_SECRET);
  const paypalMode =
    env.PAYPAL_MODE === "mock" || !clientId || !clientSecret ? "mock" : "sandbox";

  const apiKey = clean(env.ANTHROPIC_API_KEY);
  const aiMode = env.AI_MODE === "mock" || !apiKey ? "mock" : "claude";

  const databaseUrl = clean(env.DATABASE_URL);

  const demoToday = clean(env.DEMO_TODAY);

  return {
    paypal: {
      mode: paypalMode,
      clientId,
      clientSecret,
      apiBase: clean(env.PAYPAL_API_BASE) ?? "https://api-m.sandbox.paypal.com",
      webhookId: clean(env.PAYPAL_WEBHOOK_ID),
      skipWebhookVerify: flag(env.PAYPAL_SKIP_WEBHOOK_VERIFY),
      demoClientEmail: clean(env.DEMO_CLIENT_EMAIL),
      demoPayoutEmail: clean(env.DEMO_PAYOUT_EMAIL),
    },
    ai: {
      mode: aiMode,
      apiKey,
      model: clean(env.ANTHROPIC_MODEL) ?? "claude-sonnet-5-5",
    },
    store: {
      mode: databaseUrl ? "postgres" : "memory",
      databaseUrl,
    },
    timeZone: validTimeZone(clean(env.APP_TIMEZONE)) ?? DEFAULT_TIME_ZONE,
    demoToday: demoToday && /^\d{4}-\d{2}-\d{2}$/.test(demoToday) ? demoToday : undefined,
    agencyName: clean(env.AGENCY_NAME) ?? "Lotus Dev Studio",
    defaultTermDays: Number(env.DEFAULT_TERM_DAYS) > 0 ? Number(env.DEFAULT_TERM_DAYS) : 15,
    cronSecret: clean(env.CRON_SECRET),
  };
}

/** Today's business date for the app (honors DEMO_TODAY). */
export function today(config: AppConfig = getConfig()): ISODate {
  return config.demoToday ?? todayInZone(config.timeZone);
}
