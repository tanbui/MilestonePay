import Link from "next/link";
import { approvePayoutAction, sendInvoiceAction, sendReminderAction } from "@/app/actions";
import { ActionButton } from "@/components/ui/ActionButton";
import { IconCheck, IconSparkle, IconWarn } from "@/components/ui/icons";
import { Avatar, Badge, buttonClass, Card, EmptyState } from "@/components/ui/primitives";
import { formatRelative } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import type { ApprovalItem } from "@/lib/domain/rules";
import { EvidenceChips } from "./EvidenceChips";

function CardShell({ tone, children }: { tone: "accent" | "warn" | "ok"; children: React.ReactNode }) {
  const border = tone === "accent" ? "border-accent-line" : tone === "warn" ? "border-warn-line" : "border-ok-line";
  return (
    <article className={`flex flex-[1_1_320px] flex-col gap-3.5 rounded-xl border bg-white p-5 ${border}`}>{children}</article>
  );
}

function Meta({ badge, at }: { badge: React.ReactNode; at: string }) {
  return (
    <div className="flex items-center gap-2">
      {badge}
      <span className="ml-auto text-xs text-muted">{at}</span>
    </div>
  );
}

export function ApprovalQueue({ items, today, timeZone }: { items: ApprovalItem[]; today: string; timeZone: string }) {
  return (
    <section aria-labelledby="queue-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="queue-h" className="text-base font-semibold">
          Needs your approval
        </h2>
        <span className="text-[13px] text-muted">The agent drafted these. Nothing reaches PayPal until you approve.</span>
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState>Nothing needs you right now. Verified milestones, overdue reminders and payouts will show up here.</EmptyState>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-4">
          {items.map((item) => {
            const when = formatRelative(item.at, today, timeZone);
            const { milestone: m, client, project } = item.view;

            if (item.kind === "ready_to_invoice") {
              return (
                <CardShell key={`r-${m.id}`} tone="accent">
                  <Meta badge={<Badge tone="accent" icon={<IconSparkle size={14} />}>Ready to invoice</Badge>} at={when} />
                  <div className="flex flex-col gap-1">
                    <h3 className="text-[15px] font-semibold">
                      {client.name} · {m.code} {m.title}
                    </h3>
                    <p className="text-[13px] text-ink-2">{m.check?.summary}</p>
                  </div>
                  <EvidenceChips evidence={m.evidence} />
                  <div className="mt-auto flex items-baseline gap-2">
                    <span className="font-mono text-xl font-medium">{formatMoney(m.amountCents)}</span>
                    <span className="text-xs text-muted">PayPal invoice · Net {project.paymentTermDays}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      action={sendInvoiceAction.bind(null, m.id)}
                      variant="accent"
                      pendingText="Sending…"
                      formClassName="flex-[1_1_140px]"
                    >
                      Send invoice
                    </ActionButton>
                    <Link href={`/milestones/${m.id}`} className={buttonClass("secondary", "flex-[1_1_140px]")}>
                      Review evidence
                    </Link>
                  </div>
                </CardShell>
              );
            }

            if (item.kind === "reminder") {
              return (
                <CardShell key={`rem-${item.reminder.id}`} tone="warn">
                  <Meta badge={<Badge tone="warn" icon={<IconWarn size={14} />}>Overdue {item.view.overdueDays} days</Badge>} at={when} />
                  <div className="flex flex-col gap-1">
                    <h3 className="text-[15px] font-semibold">
                      {client.name} · {item.invoice.number} · {formatMoney(item.invoice.amountCents)}
                    </h3>
                    <p className="text-[13px] text-ink-2">
                      {item.reminder.scheduleNote ? `${item.reminder.scheduleNote} ` : ""}I drafted a friendly reminder.
                    </p>
                  </div>
                  <blockquote className="line-clamp-4 rounded-lg bg-canvas px-3.5 py-3 text-[13px] whitespace-pre-line text-ink-2">
                    {item.reminder.body}
                  </blockquote>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <ActionButton
                      action={sendReminderAction.bind(null, item.reminder.id)}
                      variant="primary"
                      pendingText="Sending…"
                      formClassName="flex-[1_1_140px]"
                    >
                      Send reminder
                    </ActionButton>
                    <Link href={`/milestones/${m.id}#reminder`} className={buttonClass("secondary", "flex-[1_1_140px]")}>
                      Edit draft
                    </Link>
                  </div>
                </CardShell>
              );
            }

            const unlocked = item.unlocked;
            return (
              <CardShell key={`po-${item.payout.id}`} tone="ok">
                <Meta badge={<Badge tone="ok" icon={<IconCheck size={14} />}>Payment received</Badge>} at={when} />
                <div className="flex flex-col gap-1">
                  <h3 className="text-[15px] font-semibold">
                    {client.name} · {m.code} {m.title}
                  </h3>
                  <p className="text-[13px] text-ink-2">
                    {formatMoney(m.amountCents)} cleared.
                    {unlocked
                      ? ` ${unlocked.code} ${unlocked.title} is unlocked${unlocked.status === "in_progress" ? " and has started" : ""}.`
                      : ""}{" "}
                    I queued the subcontractor&apos;s share for your approval.
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                  <Avatar initials={item.subcontractor.initials} tone="ok" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[13px] font-medium">{item.subcontractor.name}</span>
                    <span className="text-xs text-muted">{item.subcontractor.role} · via PayPal Payouts</span>
                  </div>
                  <span className="ml-auto font-mono text-[15px] font-medium">{formatMoney(item.payout.amountCents)}</span>
                </div>
                {item.payout.error ? <p className="text-xs font-medium text-warn">Last attempt failed: {item.payout.error}</p> : null}
                <div className="mt-auto flex flex-wrap gap-2">
                  <ActionButton
                    action={approvePayoutAction.bind(null, item.payout.id)}
                    variant="ok"
                    pendingText="Paying…"
                    formClassName="flex-[1_1_140px]"
                  >
                    Approve payout
                  </ActionButton>
                  <Link href={`/milestones/${m.id}`} className={buttonClass("secondary", "flex-[1_1_140px]")}>
                    Details
                  </Link>
                </div>
              </CardShell>
            );
          })}
        </div>
      )}
    </section>
  );
}
