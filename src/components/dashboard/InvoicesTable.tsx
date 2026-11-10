import Link from "next/link";
import { simulatePaymentAction } from "@/app/actions";
import { ActionButton } from "@/components/ui/ActionButton";
import { IconExternal } from "@/components/ui/icons";
import { Badge, Card, CardHeader, EmptyState, invoiceStatusTone, type Tone } from "@/components/ui/primitives";
import { dateOf, formatShortDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { getClient, getMilestone, getProject, overdueDays } from "@/lib/domain/rules";
import type { AppState, Invoice } from "@/lib/domain/types";

function statusOf(inv: Invoice, today: string, timeZone: string): { label: string; tone: Tone } {
  const od = overdueDays(inv, today);
  if (inv.status === "sent" && od > 0) return { label: `Overdue ${od} day${od === 1 ? "" : "s"}`, tone: "warn" };
  if (inv.status === "sent") return { label: "Awaiting payment", tone: invoiceStatusTone.sent };
  if (inv.status === "paid") return { label: `Paid ${inv.paidAt ? formatShortDate(dateOf(inv.paidAt, timeZone)) : ""}`, tone: "ok" };
  if (inv.status === "cancelled") return { label: "Cancelled", tone: "neutral" };
  return { label: "Draft", tone: "neutral" };
}

export function InvoicesTable({
  state,
  today,
  timeZone,
  limit,
  showDemoActions = true,
}: {
  state: AppState;
  today: string;
  timeZone: string;
  limit?: number;
  showDemoActions?: boolean;
}) {
  const rank = (i: Invoice) => (i.status === "sent" ? (overdueDays(i, today) > 0 ? 0 : 1) : i.status === "draft" ? 2 : 3);
  const rows = [...state.invoices]
    .filter((i) => getProject(state, i.projectId)?.status !== "draft")
    .sort((a, b) => rank(a) - rank(b) || b.number.localeCompare(a.number))
    .slice(0, limit);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        id="inv-h"
        title="Invoices"
        subtitle="One per milestone, sent and tracked through PayPal Invoicing"
        action={
          limit ? (
            <Link href="/invoices" className="inline-flex min-h-11 items-center text-[13px] font-medium">
              View all
            </Link>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <EmptyState>No invoices yet.</EmptyState>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="border-b border-line px-5 py-2.5 font-medium">Invoice</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-medium">Client and milestone</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 text-right font-medium">Amount</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-medium">Due</th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="border-b border-line px-5 py-2.5 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const m = getMilestone(state, inv.milestoneId);
                const project = getProject(state, inv.projectId);
                const client = project && getClient(state, project.clientId);
                const s = statusOf(inv, today, timeZone);
                return (
                  <tr key={inv.id} className="border-b border-line-soft last:border-0">
                    <td className="px-5 py-3 font-mono text-xs whitespace-nowrap">{inv.number}</td>
                    <td className="px-3 py-3">
                      {m ? (
                        <Link href={`/milestones/${m.id}`} className="text-ink no-underline hover:underline">
                          {client?.name} · {m.code} {m.title}
                        </Link>
                      ) : (
                        client?.name
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">{formatMoney(inv.amountCents)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted">{inv.dueDate ? formatShortDate(inv.dueDate) : `Net ${inv.termDays}`}</td>
                    <td className="px-3 py-3">
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </td>
                    <td className="px-5 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {inv.payerUrl ? (
                          <a
                            href={inv.payerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center gap-1 text-xs font-medium whitespace-nowrap"
                          >
                            PayPal invoice <IconExternal size={13} />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        ) : null}
                        {showDemoActions && inv.status === "sent" ? (
                          <ActionButton
                            action={simulatePaymentAction.bind(null, inv.id)}
                            pendingText="Paying…"
                            className="min-h-9 px-3 text-xs whitespace-nowrap"
                          >
                            Simulate payment
                          </ActionButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
