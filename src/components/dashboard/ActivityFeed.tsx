import Link from "next/link";
import { Card, CardHeader, EmptyState, cx } from "@/components/ui/primitives";
import { formatRelative } from "@/lib/domain/dates";
import type { ActivityEvent } from "@/lib/domain/types";

const kindLabel: Record<ActivityEvent["kind"], { label: string; className: string }> = {
  agent: { label: "Agent", className: "bg-accent-soft text-accent" },
  paypal: { label: "PayPal", className: "bg-info-soft text-info" },
  user: { label: "You", className: "bg-chip text-ink-2" },
};

export function ActivityFeed({
  events,
  today,
  timeZone,
  limit,
}: {
  events: ActivityEvent[];
  today: string;
  timeZone: string;
  limit?: number;
}) {
  const shown = events.slice(0, limit);
  return (
    <Card>
      <CardHeader
        id="act-h"
        title="Agent activity"
        action={
          limit && events.length > limit ? (
            <Link href="/activity" className="inline-flex min-h-11 items-center text-[13px] font-medium">
              View all
            </Link>
          ) : undefined
        }
      />
      {shown.length === 0 ? (
        <EmptyState>No activity yet.</EmptyState>
      ) : (
        <ol className="flex flex-col gap-3 px-5 py-4 text-[13px]">
          {shown.map((e) => {
            const k = kindLabel[e.kind];
            return (
              <li key={e.id} className="flex gap-3">
                <span className="w-[86px] shrink-0 font-mono text-xs text-muted">{formatRelative(e.at, today, timeZone)}</span>
                <span className="flex flex-col gap-1">
                  <span
                    className={cx(
                      "w-fit rounded px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase",
                      k.className,
                    )}
                  >
                    {k.label}
                  </span>
                  {e.milestoneId ? (
                    <Link href={`/milestones/${e.milestoneId}`} className="text-ink no-underline hover:underline">
                      {e.text}
                    </Link>
                  ) : e.projectId ? (
                    <Link href={`/projects/${e.projectId}`} className="text-ink no-underline hover:underline">
                      {e.text}
                    </Link>
                  ) : (
                    e.text
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
