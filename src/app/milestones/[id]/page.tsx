import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requestChangesAction, runCheckAction, sendInvoiceAction, startMilestoneAction } from "@/app/actions";
import { AcceptanceCard, EvidenceCard, InvoiceCard, ReminderCard, WhenPaidCard } from "@/components/milestones/MilestonePanels";
import { PageBody, PageHeader, PageSkeleton } from "@/components/shell/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { IconSparkle } from "@/components/ui/icons";
import { MilestoneBadge } from "@/components/ui/primitives";
import { formatRange } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { getMilestone, viewMilestone } from "@/lib/domain/rules";
import { loadPageData } from "@/lib/queries";

export default function MilestonePage(props: PageProps<"/milestones/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MilestoneDetail params={props.params} />
    </Suspense>
  );
}

async function MilestoneDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { state, today, config } = await loadPageData();
  const m = getMilestone(state, id);
  if (!m) notFound();
  const view = viewMilestone(state, m, today);
  const { client, project } = view;
  const tz = config.timeZone;
  const reminder = view.invoice ? state.reminders.find((r) => r.invoiceId === view.invoice!.id && r.status === "draft") : undefined;
  const editable = !["invoiced", "paid"].includes(m.status) && project.status === "active";

  let actions: React.ReactNode = null;
  if (project.status === "active") {
    if (m.status === "verified") {
      actions = (
        <>
          <ActionButton action={requestChangesAction.bind(null, m.id)} pendingText="Saving…">
            Request changes
          </ActionButton>
          <ActionButton action={sendInvoiceAction.bind(null, m.id)} variant="accent" pendingText="Sending through PayPal…">
            Send invoice · {formatMoney(m.amountCents)}
          </ActionButton>
        </>
      );
    } else if (m.status === "in_progress" || m.status === "changes_requested" || m.status === "submitted") {
      actions = (
        <ActionButton action={runCheckAction.bind(null, m.id)} variant="accent" pendingText="Checking evidence…">
          <IconSparkle size={16} />
          {m.check ? "Run the check again" : "Mark done and run the check"}
        </ActionButton>
      );
    } else if (view.status === "upcoming") {
      actions = (
        <ActionButton action={startMilestoneAction.bind(null, m.id)} variant="primary" pendingText="Starting…">
          Start milestone
        </ActionButton>
      );
    }
  }

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/", label: "Overview" }, { href: `/projects/${project.id}`, label: client.name }, { label: `${m.code} ${m.title}` }]}
        title={`${m.code} · ${m.title}`}
        badge={<MilestoneBadge status={view.status} overdueDays={view.overdueDays} />}
        subtitle={`${client.name} · ${project.name} · ${formatRange(m.startDate, m.endDate)}${m.sourceRef ? ` · ${m.sourceRef}` : ""}${
          view.waitingOn ? ` · waits until ${view.waitingOn.code} is paid` : ""
        }`}
        actions={actions}
      />
      <PageBody>
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-6">
            <AcceptanceCard view={view} today={today} timeZone={tz} />
            <EvidenceCard view={view} editable={editable} />
          </div>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
            {reminder ? <ReminderCard reminder={reminder} view={view} today={today} timeZone={tz} /> : null}
            <InvoiceCard view={view} agencyName={state.settings.agencyName} today={today} />
            <WhenPaidCard state={state} view={view} />
          </div>
        </div>
      </PageBody>
    </>
  );
}
