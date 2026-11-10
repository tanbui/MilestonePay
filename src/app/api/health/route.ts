import { connection } from "next/server";
import { getConfig, today } from "@/lib/env";
import { getStore } from "@/lib/store";

/**
 * Quick configuration check. Shows which integrations are live and whether
 * the data store answers. Never returns secrets.
 */
export async function GET() {
  await connection();
  const config = getConfig();
  const problems: string[] = [];

  if (process.env.APP_TIMEZONE && config.timeZone !== process.env.APP_TIMEZONE.trim().replace(/^["']|["']$/g, "")) {
    problems.push(`APP_TIMEZONE "${process.env.APP_TIMEZONE}" isn't a valid IANA time zone (e.g. America/Los_Angeles); using ${config.timeZone}.`);
  }
  if (process.env.PAYPAL_CLIENT_ID && !process.env.PAYPAL_CLIENT_SECRET) problems.push("PAYPAL_CLIENT_ID is set but PAYPAL_CLIENT_SECRET is empty.");
  if (config.paypal.mode === "sandbox" && !config.paypal.webhookId && !config.paypal.skipWebhookVerify) {
    problems.push("PAYPAL_WEBHOOK_ID is empty, so PayPal webhooks are rejected (fine until you add the webhook).");
  }
  if (config.store.mode === "memory" && process.env.VERCEL) {
    problems.push("No DATABASE_URL: data is in memory and differs between serverless instances.");
  }

  let storeOk = true;
  try {
    const state = await getStore().read();
    if (!Array.isArray(state?.projects)) throw new Error("Stored state is not in the expected format.");
  } catch (error) {
    storeOk = false;
    const e = error as { code?: string; message?: string };
    problems.push(`Data store (${config.store.mode}) failed: ${[e.code, e.message].filter(Boolean).join(" ")}`);
  }

  return Response.json(
    {
      ok: storeOk,
      today: today(config),
      timeZone: config.timeZone,
      paypal: config.paypal.mode,
      ai: config.ai.mode === "claude" ? config.ai.model : "mock",
      store: config.store.mode,
      storeOk,
      webhookVerification: Boolean(config.paypal.webhookId) && !config.paypal.skipWebhookVerify,
      problems,
    },
    { status: storeOk ? 200 : 503 },
  );
}
