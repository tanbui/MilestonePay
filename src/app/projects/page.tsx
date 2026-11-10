import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageBody, PageHeader, PageSkeleton } from "@/components/shell/PageHeader";
import { IconUpload } from "@/components/ui/icons";
import { Badge, buttonClass, Card, EmptyState } from "@/components/ui/primitives";
import { openFlags } from "@/lib/agent/draft";
import { formatMoney } from "@/lib/domain/money";
import { getClient, projectMilestones, viewMilestone } from "@/lib/domain/rules";
import { loadPageData } from "@/lib/queries";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Projects />
    </Suspense>
  );
}

async function Projects() {
  const { state, today } = await loadPageData();
  const order = { draft: 0, active: 1, complete: 2 } as const;
  const projects = [...state.projects].sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} projects`}
        actions={
          <Link href="/projects/new" className={buttonClass("primary")}>
            <IconUpload size={16} />
            Upload SOW
          </Link>
        }
      />
      <PageBody>
        <Card className="overflow-hidden">
          {projects.length === 0 ? (
            <EmptyState>No projects yet. Upload a SOW to start one.</EmptyState>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th scope="col" className="border-b border-line px-5 py-2.5 font-medium">Project</th>
                    <th scope="col" className="border-b border-line px-3 py-2.5 text-right font-medium">Total</th>
                    <th scope="col" className="border-b border-line px-3 py-2.5 font-medium">Milestones</th>
                    <th scope="col" className="border-b border-line px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const client = getClient(state, p.clientId);
                    const ms = projectMilestones(state, p.id);
                    const views = ms.map((m) => viewMilestone(state, m, today));
                    const paid = views.filter((v) => v.status === "paid").length;
                    const overdue = views.filter((v) => v.status === "overdue").length;
                    const ready = views.filter((v) => v.status === "verified").length;
                    return (
                      <tr key={p.id} className="border-b border-line-soft last:border-0">
                        <td className="px-5 py-3">
                          <Link href={`/projects/${p.id}`} className="flex flex-col no-underline">
                            <span className="font-medium text-ink">{client?.name}</span>
                            <span className="text-muted">{p.name}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right font-mono">{formatMoney(p.totalCents)}</td>
                        <td className="px-3 py-3 text-muted">
                          {ms.length} milestones · {paid} paid
                        </td>
                        <td className="px-5 py-3">
                          {p.status === "draft" ? (
                            <Badge tone="accent">Draft · {openFlags(p).length} to review</Badge>
                          ) : overdue ? (
                            <Badge tone="warn">{overdue} overdue</Badge>
                          ) : ready ? (
                            <Badge tone="accent">{ready} ready to invoice</Badge>
                          ) : paid === ms.length && ms.length ? (
                            <Badge tone="ok">Fully paid</Badge>
                          ) : (
                            <Badge>Active</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </PageBody>
    </>
  );
}
