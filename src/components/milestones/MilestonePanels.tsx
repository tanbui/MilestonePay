import {
  addEvidenceAction,
  dismissReminderAction,
  removeEvidenceAction,
  saveReminderAction,
  simulatePaymentAction,
} from "@/app/actions";
import { evidenceIcon } from "@/components/dashboard/EvidenceChips";
import { ActionButton } from "@/components/ui/ActionButton";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { Field, Select, TextArea, TextInput } from "@/components/ui/fields";
import { IconCheck, IconExternal, IconInfo, IconTrash, IconWarn } from "@/components/ui/icons";
import { Avatar, Badge, Card, CardHeader, Chip, cx, payoutStatusLabel } from "@/components/ui/primitives";
import { addDays, formatRelative, formatShortDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { getSubcontractor, nextMilestone, overdueDays, payoutShares, type MilestoneView } from "@/lib/domain/rules";
import type { AppState, CriterionVerdict, EvidenceKind, ReminderDraft } from "@/lib/domain/types";

const verdictStyle: Record<CriterionVerdict, { icon: React.ReactNode; className: string; label: string }> = {
  met: { icon: <IconCheck size={16} />, className: "bg-ok-soft text-ok", label: "Met" },
  not_met: { icon: <IconWarn size={16} />, className: "bg-warn-soft text-warn", label: "Not met" },
  unclear: { icon: <IconInfo size={16} />, className: "bg-info-soft text-info", label: "Unclear" },
};

export function AcceptanceCard({ view, today, timeZone }: { view: MilestoneView; today: string; timeZone: string }) {
  const m = view.milestone;
  const check = m.check;
  const met = check ? check.results.filter((r) => r.verdict === "met").length : 0;
  const byId = new Map(m.evidence.map((e) => [e.id, e]));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <div className="flex flex-[1_1_260px] flex-col gap-0.5">
          <h2 className="text-base font-semibold">Acceptance check</h2>
          <span className="text-[13px] text-muted">
            {m.criteria.length} criteria{m.sourceRef ? ` from ${m.sourceRef}` : ""}
            {check ? ` · checked ${formatRelative(check.checkedAt, today, timeZone)}${check.model !== "mock" ? ` by ${check.model}` : " (mock AI)"}` : " · not checked yet"}
          </span>
        </div>
        {check ? (
          <div className="flex items-center gap-2.5">
            <div aria-hidden="true" className="flex gap-[3px]">
              {check.results.map((r) => (
                <span key={r.criterionId} className={cx("h-2 w-5 rounded-sm", r.verdict === "met" ? "bg-ok" : r.verdict === "not_met" ? "bg-warn" : "bg-info-line")} />
              ))}
            </div>
            <span className={cx("text-[13px] font-semibold", check.allMet ? "text-ok" : "text-warn")}>
              {met} of {check.results.length} met
            </span>
          </div>
        ) : null}
      </div>
      <ol>
        {m.criteria.map((c) => {
          const result = check?.results.find((r) => r.criterionId === c.id);
          const v = result ? verdictStyle[result.verdict] : undefined;
          return (
            <li key={c.id} className="flex gap-3.5 border-t border-line-soft px-5 py-4">
              <span className={cx("inline-flex size-7 shrink-0 items-center justify-center rounded-full", v ? v.className : "bg-chip text-muted")}>
                {v ? v.icon : <span className="size-1.5 rounded-full bg-faint" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  {c.ref ? <span className="font-mono text-xs text-muted">{c.ref}</span> : null}
                  <span className="font-semibold">{c.text}</span>
                  {v ? <span className={cx("text-xs font-semibold", v.className.split(" ")[1])}>{v.label}</span> : null}
                </div>
                {result ? <p className="text-[13px] text-ink-2">{result.reasoning}</p> : null}
                {result?.evidenceIds.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {result.evidenceIds.map((id) => {
                      const e = byId.get(id);
                      if (!e) return null;
                      const Icon = evidenceIcon[e.kind];
                      return (
                        <Chip key={id} icon={<Icon size={13} />}>
                          {e.label}
                        </Chip>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {check?.note ? (
        <div className="mx-5 mb-5 flex gap-3 rounded-lg bg-canvas px-4 py-3.5">
          <IconInfo size={18} className="mt-px shrink-0 text-ink-2" />
          <div className="flex flex-col gap-0.5 text-[13px]">
            <span className="font-semibold">Worth knowing</span>
            <span className="text-ink-2">{check.note}</span>
          </div>
        </div>
      ) : null}
      {!check ? (
        <p className="border-t border-line-soft px-5 py-4 text-[13px] text-muted">
          When the team is done, add their evidence below and run the check. The agent compares every criterion with the evidence and brings you the
          invoice when all of them are met.
        </p>
      ) : null}
    </Card>
  );
}

const KINDS: { value: EvidenceKind; label: string }[] = [
  { value: "pull_request", label: "Pull request" },
  { value: "ci_run", label: "CI run" },
  { value: "test_report", label: "Test report" },
  { value: "email", label: "Client email" },
  { value: "demo", label: "Demo" },
  { value: "link", label: "Link" },
  { value: "note", label: "Note" },
];

export function EvidenceCard({ view, editable }: { view: MilestoneView; editable: boolean }) {
  const m = view.milestone;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Evidence" subtitle={editable ? "What the team submitted for this milestone. The agent only judges what's here." : "What the team submitted for this milestone."} />
      {m.evidence.length ? (
        <ul>
          {m.evidence.map((e) => {
            const Icon = evidenceIcon[e.kind];
            const criterion = m.criteria.find((c) => c.id === e.criterionId);
            return (
              <li key={e.id} className="flex gap-3 border-t border-line-soft px-5 py-3.5 first:border-0">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-chip text-ink-2">
                  <Icon size={15} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-medium">{e.label}</span>
                    {criterion?.ref ? <span className="text-xs text-muted">for {criterion.ref}</span> : null}
                    {e.url ? (
                      <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs">
                        Open <IconExternal size={12} />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : null}
                  </div>
                  <p className="text-[13px] whitespace-pre-line text-ink-2">{e.detail}</p>
                </div>
                {editable ? (
                  <ActionButton
                    action={removeEvidenceAction.bind(null, m.id, e.id)}
                    variant="ghost"
                    pendingText="…"
                    ariaLabel={`Remove ${e.label}`}
                    className="size-11 px-0"
                  >
                    <IconTrash size={16} />
                  </ActionButton>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-5 py-4 text-[13px] text-muted">No evidence yet.</p>
      )}
      {editable ? (
        <details className="border-t border-line">
          <summary className="flex min-h-11 cursor-pointer items-center px-5 py-3 text-[13px] font-medium">Add evidence</summary>
          <ActionForm action={addEvidenceAction.bind(null, m.id)} className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            <Field label="Type" htmlFor={`kind-${m.id}`}>
              <Select id={`kind-${m.id}`} name="kind" defaultValue="pull_request">
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Supports criterion (optional)" htmlFor={`crit-${m.id}`}>
              <Select id={`crit-${m.id}`} name="criterionId" defaultValue="">
                <option value="">Let the agent decide</option>
                {m.criteria.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.ref ? `${c.ref} · ` : ""}
                    {c.text.slice(0, 60)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" htmlFor={`label-${m.id}`}>
              <TextInput id={`label-${m.id}`} name="label" required placeholder="PR #214 merged into main" />
            </Field>
            <Field label="Link (optional)" htmlFor={`url-${m.id}`}>
              <TextInput id={`url-${m.id}`} name="url" type="url" placeholder="https://github.com/…" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="What it shows" htmlFor={`detail-${m.id}`} hint="Paste the test summary, the client's approval email or a short description.">
                <TextArea id={`detail-${m.id}`} name="detail" required rows={4} />
              </Field>
            </div>
            <div>
              <SubmitButton pendingText="Adding…">Add evidence</SubmitButton>
            </div>
          </ActionForm>
        </details>
      ) : null}
    </Card>
  );
}

export function InvoiceCard({ view, agencyName, today }: { view: MilestoneView; agencyName: string; today: string }) {
  const m = view.milestone;
  const inv = view.invoice;
  const termDays = inv?.termDays ?? view.project.paymentTermDays;
  const status = !inv || inv.status === "draft" ? { label: "Draft", tone: "neutral" as const } : inv.status === "paid" ? { label: "Paid", tone: "ok" as const } : view.status === "overdue" ? { label: `Overdue ${view.overdueDays} days`, tone: "warn" as const } : { label: "Awaiting payment", tone: "info" as const };
  const due = inv?.dueDate ?? addDays(today, termDays);

  return (
    <Card className="flex flex-col gap-4 px-5 py-4">
      <div className="flex items-center gap-2.5">
        <h2 className="text-base font-semibold">{inv && inv.status !== "draft" ? `Invoice ${inv.number}` : "PayPal invoice draft"}</h2>
        <span className="ml-auto">
          <Badge tone={status.tone}>{status.label}</Badge>
        </span>
      </div>
      <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
        <dt className="text-muted">Bill to</dt>
        <dd>
          {view.client.contactName}, {view.client.name}
          <br />
          <span className="text-muted break-all">{view.client.contactEmail || "No billing email yet"}</span>
        </dd>
        <dt className="text-muted">Terms</dt>
        <dd>
          {termDays === 0 ? "Due on receipt" : `Net ${termDays}`} · {inv?.dueDate ? "due" : "due about"} {formatShortDate(due)}
        </dd>
        <dt className="text-muted">Reference</dt>
        <dd>{m.sourceRef ?? view.project.name}</dd>
        <dt className="text-muted">From</dt>
        <dd>{agencyName}</dd>
      </dl>
      <div className="flex gap-3 border-y border-line-soft py-3 text-[13px]">
        <span className="flex-1">
          {m.code} · {m.title}
        </span>
        <span className="font-mono">{formatMoney(m.amountCents, true)}</span>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="flex-1 text-[13px] font-semibold">Total due</span>
        <span className="font-mono text-[22px] font-medium">{formatMoney(inv?.status === "paid" ? 0 : m.amountCents, true)}</span>
      </div>
      {inv?.payerUrl ? (
        <a href={inv.payerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium">
          Open the PayPal invoice <IconExternal size={13} />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : null}
      {inv?.status === "sent" ? (
        <ActionButton action={simulatePaymentAction.bind(null, inv.id)} pendingText="Paying…">
          Simulate client payment (demo)
        </ActionButton>
      ) : null}
      <p className="text-xs text-muted">
        {inv?.status === "sent"
          ? `Sent through PayPal Invoicing${inv.issueDate ? ` on ${formatShortDate(inv.issueDate)}` : ""}. The client pays with PayPal or a card from the invoice link.`
          : inv?.status === "paid"
            ? "Paid through PayPal."
            : "Approving creates this invoice in PayPal Invoicing and emails it to the client, who can pay with PayPal or a card."}
      </p>
    </Card>
  );
}

export function ReminderCard({ reminder, view, today, timeZone }: { reminder: ReminderDraft; view: MilestoneView; today: string; timeZone: string }) {
  const inv = view.invoice!;
  return (
    <section id="reminder" aria-labelledby="rem-h" className="flex scroll-mt-6 flex-col gap-3 rounded-xl border border-warn-line bg-white px-5 py-4">
      <div className="flex items-center gap-2">
        <h2 id="rem-h" className="text-base font-semibold">
          Reminder draft
        </h2>
        <span className="ml-auto text-xs text-muted">{formatRelative(reminder.createdAt, today, timeZone)}</span>
      </div>
      <p className="text-[13px] text-ink-2">
        {inv.number} is {overdueDays(inv, today)} days overdue. {reminder.scheduleNote ?? ""} Edit anything before it goes out through PayPal.
      </p>
      <ActionForm action={saveReminderAction.bind(null, reminder.id)} className="flex flex-col gap-3">
        <Field label="Subject" htmlFor={`subj-${reminder.id}`}>
          <TextInput id={`subj-${reminder.id}`} name="subject" defaultValue={reminder.subject} required />
        </Field>
        <Field label="Message" htmlFor={`body-${reminder.id}`}>
          <TextArea id={`body-${reminder.id}`} name="body" defaultValue={reminder.body} rows={7} required />
        </Field>
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="intent" value="send" variant="primary" pendingText="Sending…">
            Send reminder
          </SubmitButton>
          <SubmitButton name="intent" value="save" pendingText="Saving…">
            Save draft
          </SubmitButton>
        </div>
      </ActionForm>
      <ActionButton action={dismissReminderAction.bind(null, reminder.id)} variant="ghost" pendingText="Dismissing…" formClassName="self-start">
        Dismiss
      </ActionButton>
    </section>
  );
}

export function WhenPaidCard({ state, view }: { state: AppState; view: MilestoneView }) {
  const m = view.milestone;
  const next = nextMilestone(state, m);
  const shares = payoutShares(m);
  const payouts = state.payouts.filter((p) => p.milestoneId === m.id);

  if (m.status === "paid") {
    return (
      <Card className="flex flex-col gap-3.5 px-5 py-4">
        <h2 className="text-base font-semibold">After payment</h2>
        {payouts.length ? (
          <ul className="flex flex-col gap-3">
            {payouts.map((p) => {
              const sub = getSubcontractor(state, p.subcontractorId);
              const s = payoutStatusLabel[p.status];
              return (
                <li key={p.id} className="flex items-center gap-3">
                  <Avatar initials={sub?.initials ?? "?"} tone="ok" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-medium">{sub?.name}</span>
                    <span className="text-xs text-muted">PayPal Payouts{p.paypalBatchId ? ` · batch ${p.paypalBatchId}` : ""}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-[13px]">{formatMoney(p.amountCents)}</span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">No subcontractor payouts for this milestone.</p>
        )}
        {next ? (
          <p className="border-t border-line-soft pt-3 text-[13px] text-ink-2">
            {m.gated ? `${next.code} ${next.title} is unlocked.` : `${next.code} ${next.title} wasn't gated on this payment.`}
          </p>
        ) : null}
      </Card>
    );
  }

  const steps: React.ReactNode[] = [];
  for (const s of shares) {
    const sub = getSubcontractor(state, s.subcontractorId);
    steps.push(
      <>
        {sub?.name}&apos;s {s.percent}% share, <span className="font-mono">{formatMoney(s.amountCents)}</span>, is queued in PayPal Payouts for your approval.
      </>,
    );
  }
  if (next) {
    steps.push(m.gated ? `${next.code} ${next.title} unlocks${next.startDate ? ` (planned start ${formatShortDate(next.startDate)})` : ""}.` : `${next.code} ${next.title} isn't waiting on this payment.`);
  } else {
    steps.push("This is the final milestone, so the project closes.");
  }
  steps.push(`${view.client.name} gets PayPal's receipt for the payment.`);

  return (
    <Card className="flex flex-col gap-3.5 px-5 py-4">
      <h2 className="text-base font-semibold">When it&apos;s paid</h2>
      <ol className="flex flex-col gap-3 text-[13px]">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-chip text-xs font-semibold">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <p className="border-t border-line-soft pt-3 text-[13px] text-ink-2">
        If it&apos;s still unpaid after the due date, I&apos;ll draft a reminder and show you the schedule impact before changing anything.
      </p>
    </Card>
  );
}
