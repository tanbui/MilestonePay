import type { Metadata } from "next";
import { Suspense } from "react";
import { runSweepAction } from "@/app/actions";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { PageBody, PageHeader, PageSkeleton } from "@/components/shell/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { IconSparkle } from "@/components/ui/icons";
import { loadPageData } from "@/lib/queries";

export const metadata: Metadata = { title: "Agent activity" };

export default function ActivityPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Activity />
    </Suspense>
  );
}

async function Activity() {
  const { state, today, config } = await loadPageData();
  return (
    <>
      <PageHeader
        title="Agent activity"
        subtitle="Everything the agent, PayPal and you did, newest first."
        actions={
          <ActionButton action={runSweepAction} pendingText="Checking…">
            <IconSparkle size={16} />
            Run agent
          </ActionButton>
        }
      />
      <PageBody>
        <ActivityFeed events={state.activity} today={today} timeZone={config.timeZone} />
      </PageBody>
    </>
  );
}
