import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DraftReview } from "@/components/projects/DraftReview";
import { PageBody, PageHeader, PageSkeleton } from "@/components/shell/PageHeader";
import { DeliveryTimeline } from "@/components/timeline/DeliveryTimeline";
import { Card, CardHeader, MilestoneBadge } from "@/components/ui/primitives";
import { formatRange } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { buildTimeline, getClient, getProject, projectMilestones, projectSummary, viewMilestone } from "@/lib/domain/rules";
import { loadPageData } from "@/lib/queries";

export default function ProjectPage(props: PageProps<"/projects/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Project params={props.params} />
    </Suspense>
  );
}

async function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { state, today, config } = await loadPageData();
  const project = getProject(state, id);
  if (!project) notFound();

  if (project.status === "draft") {
    return <DraftReview state={state} project={project} today={today} timeZone={config.timeZone} />;
  }

  const client = getClient(state, project.clientId)!;
  const timeline = buildTimeline(state, today, config.timeZone, 10);
  const own = { ...timeline, groups: timeline.groups.filter((g) => g.project.id === project.id) };

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/", label: "Overview" }, { href: "/projects", label: "Projects" }, { label: client.name }]}
        title={`${client.name} · ${project.name}`}
        subtitle={projectSummary(state, project, today)}
      />
      <PageBody>
        <Card className="overflow-hidden">
          <CardHeader title="Milestones" subtitle={`Invoices use Net ${project.paymentTermDays} terms. Billing contact: ${client.contactName} (${client.contactEmail || "no email"})`} />
          <ol>
            {projectMilestones(state, project.id).map((m) => {
              const v = viewMilestone(state, m, today);
              return (
                <li key={m.id} className="border-t border-line-soft first:border-0">
                  <Link href={`/milestones/${m.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 text-[13px] text-ink no-underline hover:bg-raised">
                    <span className="font-mono text-xs text-muted">{m.code}</span>
                    <span className="min-w-[180px] flex-1 font-medium">{m.title}</span>
                    <span className="text-muted">{formatRange(m.startDate, m.endDate)}</span>
                    <span className="w-24 text-right font-mono">{formatMoney(m.amountCents)}</span>
                    <MilestoneBadge status={v.status} overdueDays={v.overdueDays} />
                  </Link>
                </li>
              );
            })}
          </ol>
        </Card>
        <DeliveryTimeline model={own} today={today} />
      </PageBody>
    </>
  );
}
