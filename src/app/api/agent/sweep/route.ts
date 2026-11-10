import { connection } from "next/server";
import { runAgentSweep } from "@/lib/agent/workflows";
import { getConfig } from "@/lib/env";

export const maxDuration = 60;

/**
 * Daily agent run: shifts phases blocked by overdue invoices and drafts
 * reminders for approval. Vercel Cron calls this with
 * `Authorization: Bearer $CRON_SECRET` (see vercel.json).
 */
async function handle(request: Request) {
  await connection();
  const { cronSecret } = getConfig();
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runAgentSweep();
  return Response.json(result);
}

export const GET = handle;
export const POST = handle;
