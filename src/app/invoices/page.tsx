import type { Metadata } from "next";
import { Suspense } from "react";
import { InvoicesTable } from "@/components/dashboard/InvoicesTable";
import { PageBody, PageHeader, PageSkeleton } from "@/components/shell/PageHeader";
import { formatMoney } from "@/lib/domain/money";
import { dashboardKpis } from "@/lib/domain/rules";
import { loadPageData } from "@/lib/queries";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Invoices />
    </Suspense>
  );
}

async function Invoices() {
  const { state, today, config } = await loadPageData();
  const k = dashboardKpis(state, today, config.timeZone);
  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={`${formatMoney(k.awaitingCents)} awaiting payment · ${formatMoney(k.overdueCents)} overdue · ${formatMoney(k.collectedCents)} collected in the last 30 days`}
      />
      <PageBody>
        <InvoicesTable state={state} today={today} timeZone={config.timeZone} />
        <p className="text-xs text-muted">
          “Simulate payment” is a demo control. In sandbox mode it records the payment in PayPal, which fires the same INVOICING.INVOICE.PAID webhook a real
          payment would.
        </p>
      </PageBody>
    </>
  );
}
