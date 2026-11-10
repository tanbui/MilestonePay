import { connection } from "next/server";
import { getConfig, today } from "@/lib/env";

/** Which integrations are live. Never returns secrets. */
export async function GET() {
  await connection();
  const config = getConfig();
  return Response.json({
    ok: true,
    today: today(config),
    paypal: config.paypal.mode,
    ai: config.ai.mode === "claude" ? config.ai.model : "mock",
    store: config.store.mode,
    webhookVerification: Boolean(config.paypal.webhookId) && !config.paypal.skipWebhookVerify,
  });
}
