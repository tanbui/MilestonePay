import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { resetDemoAction, runSweepAction } from "@/app/actions";
import { PageBody, PageHeader, PageSkeleton } from "@/components/shell/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { formatLongDate } from "@/lib/domain/dates";
import { loadPageData } from "@/lib/queries";

export const metadata: Metadata = { title: "Settings" };

const WEBHOOK_EVENTS = [
  "INVOICING.INVOICE.PAID",
  "INVOICING.INVOICE.CANCELLED",
  "PAYMENT.PAYOUTSBATCH.SUCCESS",
  "PAYMENT.PAYOUTSBATCH.DENIED",
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
  "PAYMENT.PAYOUTS-ITEM.FAILED",
];

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings />
    </Suspense>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-line-soft px-5 py-3 text-[13px] first:border-0 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

async function Settings() {
  const { state, today, config } = await loadPageData();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const webhookUrl = `${proto}://${host}/api/paypal/webhook`;
  const sandbox = config.paypal.mode === "sandbox";
  const claude = config.ai.mode === "claude";

  return (
    <>
      <PageHeader title="Settings" subtitle="Integrations, mock data and demo controls. Values come from environment variables; see .env.example." />
      <PageBody>
        <Card>
          <CardHeader title="PayPal" action={<Badge tone={sandbox ? "ok" : "neutral"}>{sandbox ? "Sandbox" : "Mock mode"}</Badge>} />
          <dl>
            <Row label="Mode">
              {sandbox
                ? "Sandbox. Invoices, reminders and payouts go to the PayPal sandbox."
                : "Mock. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to use the sandbox."}
            </Row>
            <Row label="API base">
              <code className="font-mono text-xs">{config.paypal.apiBase}</code>
            </Row>
            <Row label="Webhook URL">
              <code className="font-mono text-xs">{webhookUrl}</code>
              <p className="mt-1 text-xs text-muted">Add it to your sandbox app in the PayPal Developer Dashboard, then set PAYPAL_WEBHOOK_ID.</p>
            </Row>
            <Row label="Webhook events">
              <ul className="flex flex-wrap gap-1.5">
                {WEBHOOK_EVENTS.map((e) => (
                  <li key={e}>
                    <code className="rounded bg-chip px-1.5 py-0.5 font-mono text-[11px]">{e}</code>
                  </li>
                ))}
              </ul>
            </Row>
            <Row label="Webhook verification">
              {config.paypal.skipWebhookVerify
                ? "Skipped (PAYPAL_SKIP_WEBHOOK_VERIFY). Only use this for local testing."
                : config.paypal.webhookId
                  ? "On. Every event is verified with PayPal before it's applied."
                  : sandbox
                    ? "Not set up: add PAYPAL_WEBHOOK_ID or incoming events are rejected."
                    : "Not needed in mock mode."}
            </Row>
            <Row label="Sandbox buyer">{config.paypal.demoClientEmail ?? "Not set. Invoices go to each client's email (DEMO_CLIENT_EMAIL overrides)."}</Row>
            <Row label="Sandbox payee">{config.paypal.demoPayoutEmail ?? "Not set. Payouts go to each subcontractor's email (DEMO_PAYOUT_EMAIL overrides)."}</Row>
          </dl>
        </Card>

        <Card>
          <CardHeader title="AI agent" action={<Badge tone={claude ? "ok" : "neutral"}>{claude ? "Claude" : "Mock AI"}</Badge>} />
          <dl>
            <Row label="Mode">{claude ? `Claude (${config.ai.model}) with structured outputs.` : "Mock. Set ANTHROPIC_API_KEY to use Claude."}</Row>
            <Row label="What it does">Reads SOWs into milestones, checks delivery evidence against acceptance criteria, and drafts payment reminders.</Row>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Data" action={<Badge>{config.store.mode === "postgres" ? "Postgres" : "In memory"}</Badge>} />
          <dl>
            <Row label="Store">
              {config.store.mode === "postgres"
                ? "Postgres (DATABASE_URL). State survives restarts and is shared by every server instance."
                : "In-memory mock data. Resets when the server restarts; set DATABASE_URL for a hosted demo."}
            </Row>
            <Row label="Today">
              {formatLongDate(today)} ({config.timeZone}){config.demoToday ? " · pinned by DEMO_TODAY" : ""}
            </Row>
            <Row label="Agency name">{state.settings.agencyName}</Row>
            <Row label="Default terms">Net {state.settings.defaultTermDays}</Row>
            <Row label="Records">
              {state.projects.length} projects · {state.milestones.length} milestones · {state.invoices.length} invoices · {state.payouts.length} payouts
            </Row>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Demo controls" subtitle="For testing and the demo video." />
          <div className="flex flex-wrap gap-6 px-5 py-4">
            <div className="flex max-w-sm flex-col gap-2">
              <ActionButton action={runSweepAction} pendingText="Checking…" formClassName="self-start">
                Run agent sweep
              </ActionButton>
              <p className="text-xs text-muted">Moves phases blocked by overdue invoices and drafts reminders. Also runs daily on Vercel Cron.</p>
            </div>
            <div className="flex max-w-sm flex-col gap-2">
              <ActionButton action={resetDemoAction} pendingText="Resetting…" formClassName="self-start">
                Reset demo data
              </ActionButton>
              <p className="text-xs text-muted">Replaces everything with fresh mock data, dated relative to today.</p>
            </div>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
