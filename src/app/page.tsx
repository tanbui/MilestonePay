import Link from "next/link";
import { Suspense } from "react";
import { runSweepAction } from "@/app/actions";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { ApprovalQueue } from "@/components/dashboard/ApprovalQueue";
import { InvoicesTable } from "@/components/dashboard/InvoicesTable";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { PayoutsList } from "@/components/dashboard/PayoutsList";
import { PageBody, PageHeader, PageSkeleton } from "@/components/shell/PageHeader";
import { DeliveryTimeline } from "@/components/timeline/DeliveryTimeline";
import { ActionButton } from "@/components/ui/ActionButton";
import { IconSparkle, IconUpload } from "@/components/ui/icons";
import { buttonClass } from "@/components/ui/primitives";
import { formatLongDate } from "@/lib/domain/dates";
import { approvalQueue, buildTimeline, dashboardKpis, payoutRows } from "@/lib/domain/rules";
import { loadPageData } from "@/lib/queries";

export default function OverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const { state, today, config } = await loadPageData();
  const tz = config.timeZone;
  const active = state.projects.filter((p) => p.status === "active");
  const milestoneCount = state.milestones.filter((m) => active.some((p) => p.id === m.projectId)).length;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={`${formatLongDate(today)} · ${active.length} active projects · ${milestoneCount} milestones`}
        actions={
          <>
            <ActionButton action={runSweepAction} pendingText="Checking…" variant="secondary">
              <IconSparkle size={16} />
              Run agent
            </ActionButton>
            <Link href="/projects/new" className={buttonClass("primary")}>
              <IconUpload size={16} />
              Upload SOW
            </Link>
          </>
        }
      />
      <PageBody>
        <KpiRow k={dashboardKpis(state, today, tz)} />
        <ApprovalQueue items={approvalQueue(state, today)} today={today} timeZone={tz} />
        <DeliveryTimeline model={buildTimeline(state, today, tz)} today={today} />
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-0 flex-[2_1_560px]">
            <InvoicesTable state={state} today={today} timeZone={tz} limit={6} />
          </div>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
            <PayoutsList rows={payoutRows(state, today)} timeZone={tz} limit={4} />
            <ActivityFeed events={state.activity} today={today} timeZone={tz} limit={5} />
          </div>
        </div>
      </PageBody>
    </>
  );
}
