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

function clean(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
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
    timeZone: clean(env.APP_TIMEZONE) ?? "America/Los_Angeles",
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
