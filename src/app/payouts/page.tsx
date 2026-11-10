import type { Metadata } from "next";
import { Suspense } from "react";
import { approvePayoutAction } from "@/app/actions";
import { PayoutsList } from "@/components/dashboard/PayoutsList";
import { PageBody, PageHeader, PageSkeleton } from "@/components/shell/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { Avatar, Card, CardHeader } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/domain/money";
import { getClient, getMilestone, getProject, getSubcontractor, payoutRows } from "@/lib/domain/rules";
import { loadPageData } from "@/lib/queries";

export const metadata: Metadata = { title: "Payouts" };

export default function PayoutsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Payouts />
    </Suspense>
  );
}

async function Payouts() {
  const { state, today, config } = await loadPageData();
  const pending = state.payouts.filter((p) => p.status === "pending_approval");
  return (
    <>
      <PageHeader title="Payouts" subtitle="Subcontractor shares, paid through PayPal Payouts after the client's payment clears." />
      <PageBody>
        {pending.length ? (
          <Card>
            <CardHeader title="Waiting for your approval" />
            <ul>
              {pending.map((p) => {
                const sub = getSubcontractor(state, p.subcontractorId)!;
                const m = getMilestone(state, p.milestoneId)!;
                const client = getClient(state, getProject(state, m.projectId)!.clientId)!;
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 border-t border-line-soft px-5 py-3.5 first:border-0">
                    <Avatar initials={sub.initials} tone="ok" />
                    <div className="flex min-w-[200px] flex-1 flex-col">
                      <span className="text-[13px] font-medium">{sub.name}</span>
                      <span className="text-xs text-muted">
                        {client.name} {m.code} · {m.title}
                      </span>
                    </div>
                    <span className="font-mono">{formatMoney(p.amountCents)}</span>
                    <ActionButton action={approvePayoutAction.bind(null, p.id)} variant="ok" pendingText="Paying…">
                      Approve payout
                    </ActionButton>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}
        <PayoutsList rows={payoutRows(state, today)} timeZone={config.timeZone} />
      </PageBody>
    </>
  );
}
