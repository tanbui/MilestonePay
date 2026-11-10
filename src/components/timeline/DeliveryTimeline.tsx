import Link from "next/link";
import { IconCheck, IconLock, IconSparkle, IconWarn } from "@/components/ui/icons";
import { cx } from "@/components/ui/primitives";
import { addDays, formatShortDate } from "@/lib/domain/dates";
import type { DisplayStatus, TimelineBar, TimelineModel } from "@/lib/domain/rules";

/**
 * Delivery timeline (Gantt). Each phase shows its payment state, and phases
 * that wait on an unpaid milestone are drawn locked or blocked.
 *
 * Kept as one self-contained component so it can be swapped for Bryntum
 * Gantt later without touching the rest of the dashboard.
 */
const barStyle: Record<DisplayStatus, string> = {
  paid: "bg-ok text-white",
  verified: "bg-accent text-white",
  invoiced: "border border-info-line bg-info-soft text-info",
  overdue: "bg-warn text-white",
  blocked: "bar-blocked border border-dashed border-orange-600 text-warn-ink",
  locked: "border border-dashed border-faint bg-white text-muted",
  in_progress: "text-ink",
  submitted: "border border-info-line bg-info-soft text-info",
  changes_requested: "border border-warn-line bg-warn-soft text-warn-ink",
  upcoming: "border border-dashed border-faint bg-white text-muted",
};

function BarIcon({ status }: { status: DisplayStatus }) {
  if (status === "paid") return <IconCheck size={13} />;
  if (status === "verified") return <IconSparkle size={13} />;
  if (status === "overdue") return <IconWarn size={13} />;
  if (status === "locked" || status === "blocked") return <IconLock size={13} />;
  return null;
}

function Bar({ bar }: { bar: TimelineBar }) {
  const { view } = bar;
  const m = view.milestone;
  if (bar.offscreen === "after") {
    return (
      <Link
        href={`/milestones/${m.id}`}
        className="absolute top-2 right-1 flex h-7 items-center rounded-md border border-dashed border-faint bg-white px-2.5 text-xs font-medium whitespace-nowrap text-muted no-underline"
      >
        Starts {formatShortDate(m.startDate)} →
      </Link>
    );
  }
  const progressStyle =
    view.status === "in_progress"
      ? { background: `linear-gradient(to right, var(--color-progress) 0 ${m.progress}%, var(--color-progress-track) ${m.progress}% 100%)` }
      : undefined;
  return (
    <Link
      href={`/milestones/${m.id}`}
      title={bar.label}
      className={cx(
        "absolute top-2 flex h-7 items-center gap-1.5 overflow-hidden rounded-md px-2.5 text-xs font-medium whitespace-nowrap no-underline",
        barStyle[view.status],
      )}
      style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%`, ...progressStyle }}
    >
      <BarIcon status={view.status} />
      <span className="truncate">{bar.label}</span>
    </Link>
  );
}

const legend: { label: string; className: string }[] = [
  { label: "Paid", className: "bg-ok" },
  { label: "Verified, ready to invoice", className: "bg-accent" },
  { label: "Invoiced", className: "border border-info-line bg-info-soft" },
  { label: "Overdue", className: "bg-warn" },
  { label: "Blocked by payment", className: "border border-dashed border-orange-600 bg-orange-100" },
  { label: "In progress", className: "bg-progress" },
  { label: "Upcoming / waiting", className: "border border-dashed border-faint" },
];

export function DeliveryTimeline({ model, today }: { model: TimelineModel; today: string }) {
  const grid = { backgroundImage: "linear-gradient(to right, var(--color-line-soft) 1px, transparent 1px)", backgroundSize: `${100 / model.weeks.length}% 100%` };
  return (
    <section aria-labelledby="timeline-h" className="relative overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-5 py-4">
        <div className="flex flex-[1_1_280px] flex-col gap-0.5">
          <h2 id="timeline-h" className="text-base font-semibold">
            Delivery timeline
          </h2>
          <p className="text-[13px] text-muted">Each gated phase unlocks when the milestone before it is paid.</p>
        </div>
        <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cx("size-3 rounded-[3px]", l.className)} />
              {l.label}
            </li>
          ))}
        </ul>
      </div>

      {model.groups.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-muted">No active projects yet. Upload a SOW to start one.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <div className="relative min-w-[980px] pb-9">
            <div className="flex border-b border-line text-xs text-muted">
              <div className="w-60 shrink-0 px-5 py-2.5 font-medium">Milestone</div>
              <div className="flex flex-1">
                {model.weeks.map((w) => {
                  const current = w <= today && today < addDays(w, 7);
                  return (
                    <div key={w} className={cx("flex-1 border-l border-line-soft px-2 py-2.5", current && "font-semibold text-ink")}>
                      {formatShortDate(w)}
                    </div>
                  );
                })}
              </div>
            </div>

            {model.groups.map((g) => (
              <div key={g.project.id}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-soft bg-raised px-5 py-2.5 text-[13px]">
                  <Link href={`/projects/${g.project.id}`} className="font-semibold text-ink no-underline hover:underline">
                    {g.client.name}
                  </Link>
                  <span className="text-muted">{g.summary}</span>
                </div>
                {g.bars.map((bar) => (
                  <div key={bar.view.milestone.id} className="flex border-b border-line-soft">
                    <div className="flex h-11 w-60 shrink-0 items-center gap-2 px-5 text-[13px]">
                      <span className="font-mono text-xs text-muted">{bar.view.milestone.code}</span>
                      <span className="truncate">{bar.view.milestone.title}</span>
                    </div>
                    <div className="relative h-11 flex-1" style={grid}>
                      <Bar bar={bar} />
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-[37px] bottom-[30px] z-10 w-0.5 bg-accent"
              style={{ left: `calc(15rem + (100% - 15rem) * ${model.todayPct / 100})` }}
            />
            <div
              className="absolute bottom-1.5 z-10 -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white"
              style={{ left: `calc(15rem + (100% - 15rem) * ${model.todayPct / 100})` }}
            >
              Today · {formatShortDate(today)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
