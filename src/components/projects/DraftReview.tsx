import {
  applySuggestionAction,
  confirmDraftAction,
  discardDraftAction,
  resolveFlagAction,
  setSplitAction,
  setTermsAction,
  toggleGateAction,
} from "@/app/actions";
import { PageBody, PageHeader } from "@/components/shell/PageHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { Select, TextInput } from "@/components/ui/fields";
import { IconCheck, IconInfo, IconSparkle, IconWarn } from "@/components/ui/icons";
import { Avatar, Badge, Card, CardHeader, Chip, cx } from "@/components/ui/primitives";
import { openFlags } from "@/lib/agent/draft";
import { diffDays, formatRange, formatRelative } from "@/lib/domain/dates";
import { formatMoney, percentOf } from "@/lib/domain/money";
import { getClient, getSubcontractor, projectMilestones } from "@/lib/domain/rules";
import type { AgentFlag, AppState, Milestone, Project } from "@/lib/domain/types";

const TERM_OPTIONS = [0, 10, 14, 15, 30, 45, 60];

function Tile({ label, value, note, noteClass = "text-muted" }: { label: string; value: string; note: string; noteClass?: string }) {
  return (
    <div className="flex flex-[1_1_200px] flex-col gap-1 rounded-xl border border-line bg-white px-5 py-4">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="font-mono text-[26px] font-medium tracking-tight">{value}</span>
      <span className={cx("text-[13px]", noteClass)}>{note}</span>
    </div>
  );
}

function FlagIcon({ tone }: { tone: "warn" | "info" | "ok" }) {
  const cls = tone === "warn" ? "bg-warn-soft text-warn" : tone === "info" ? "bg-info-soft text-info" : "bg-ok-soft text-ok";
  return (
    <span className={cx("inline-flex size-7 shrink-0 items-center justify-center rounded-full", cls)}>
      {tone === "warn" ? <IconWarn size={16} /> : tone === "info" ? <IconInfo size={16} /> : <IconCheck size={16} />}
    </span>
  );
}

function FlagRow({ project, flag, state }: { project: Project; flag: AgentFlag; state: AppState }) {
  const m = flag.suggestion ? state.milestones.find((x) => x.id === flag.suggestion!.milestoneId) : undefined;
  const criterion = m?.criteria.find((c) => c.id === flag.suggestion?.criterionId);

  if (flag.kind === "unmeasurable") {
    if (flag.resolved && criterion?.originalText) {
      return (
        <li className="flex gap-3.5 border-t border-line-soft px-5 py-4">
          <FlagIcon tone="ok" />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <div className="flex flex-[1_1_280px] flex-col gap-1">
              <h3 className="text-[15px] font-semibold">{m?.code} criterion updated</h3>
              <p className="text-[13px] text-ink-2">
                It now reads “{criterion.text}.” I&apos;ll test against it when {m?.code} is marked done.
              </p>
            </div>
            <ActionButton action={applySuggestionAction.bind(null, project.id, flag.id, true)} pendingText="Undoing…">
              Undo
            </ActionButton>
          </div>
        </li>
      );
    }
    if (flag.resolved) {
      return (
        <li className="flex gap-3.5 border-t border-line-soft px-5 py-4">
          <FlagIcon tone="ok" />
          <div className="flex flex-col gap-1">
            <h3 className="text-[15px] font-semibold">Kept as written</h3>
            <p className="text-[13px] text-ink-2">{flag.detail}</p>
          </div>
        </li>
      );
    }
    return (
      <li className="flex gap-3.5 border-t border-line-soft bg-warn-wash px-5 py-4">
        <FlagIcon tone="warn" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-[15px] font-semibold">{flag.title}</h3>
            <p className="text-[13px] text-ink-2">{flag.detail}</p>
          </div>
          {flag.suggestion ? (
            <div className="flex flex-col gap-0.5 rounded-lg bg-canvas px-3.5 py-3">
              <span className="text-xs text-muted">Suggested {m?.code} criterion</span>
              <span className="text-sm font-medium">{flag.suggestion.text}</span>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {flag.suggestion ? (
              <ActionButton action={applySuggestionAction.bind(null, project.id, flag.id, false)} variant="accent" pendingText="Updating…">
                Use suggestion
              </ActionButton>
            ) : null}
            <ActionButton action={resolveFlagAction.bind(null, project.id, flag.id)} pendingText="Saving…">
              Keep as written
            </ActionButton>
          </div>
        </div>
      </li>
    );
  }

  if (flag.kind === "payment_terms") {
    return (
      <li className="flex gap-3.5 border-t border-line-soft px-5 py-4">
        <FlagIcon tone={flag.resolved ? "ok" : "info"} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-[15px] font-semibold">{flag.resolved ? `Payment terms set: Net ${project.paymentTermDays}` : flag.title}</h3>
            <p className="text-[13px] text-ink-2">
              {flag.resolved ? "Every invoice for this project uses these terms." : flag.detail}
            </p>
          </div>
          <ActionForm action={setTermsAction.bind(null, project.id)} className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`terms-${project.id}`} className="text-xs font-medium text-ink-2">
                Invoice terms
              </label>
              <Select id={`terms-${project.id}`} name="days" defaultValue={String(project.paymentTermDays)} className="w-44">
                {TERM_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? "Due on receipt" : `Net ${d}`}
                  </option>
                ))}
              </Select>
            </div>
            <SubmitButton pendingText="Saving…">{flag.resolved ? "Change terms" : "Use these terms"}</SubmitButton>
          </ActionForm>
        </div>
      </li>
    );
  }

  if (flag.kind === "totals" && !flag.resolved) {
    return (
      <li className="flex gap-3.5 border-t border-line-soft bg-warn-wash px-5 py-4">
        <FlagIcon tone="warn" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <div className="flex flex-[1_1_280px] flex-col gap-1">
            <h3 className="text-[15px] font-semibold">{flag.title}</h3>
            <p className="text-[13px] text-ink-2">{flag.detail}</p>
          </div>
          <ActionButton action={resolveFlagAction.bind(null, project.id, flag.id)} pendingText="Saving…">
            Acknowledge
          </ActionButton>
        </div>
      </li>
    );
  }

  return (
    <li className="flex gap-3.5 border-t border-line-soft px-5 py-4">
      <FlagIcon tone="ok" />
      <div className="flex flex-col gap-1">
        <h3 className="text-[15px] font-semibold">{flag.title}</h3>
        <p className="text-[13px] text-ink-2">{flag.detail}</p>
      </div>
    </li>
  );
}

function MilestoneRow({ m, next, state, project }: { m: Milestone; next?: Milestone; state: AppState; project: Project }) {
  const split = m.splits[0];
  const sub = split ? getSubcontractor(state, split.subcontractorId) : undefined;
  return (
    <li id={m.code.toLowerCase()} className="flex flex-col gap-3 border-t border-line-soft px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-xs text-muted">{m.code}</span>
        <h3 className="text-[15px] font-semibold">{m.title}</h3>
        {m.sourceRef ? <Chip>{m.sourceRef}</Chip> : null}
        <span className="ml-auto font-mono text-[17px] font-medium">{formatMoney(m.amountCents)}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
        <span>{formatRange(m.startDate, m.endDate)}</span>
        <span>Invoice draft · Net {project.paymentTermDays}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Acceptance criteria</span>
        <ul className="flex flex-col gap-1.5 text-[13px]">
          {m.criteria.map((c) => {
            const updated = Boolean(c.originalText);
            const weak = !c.measurable;
            return (
              <li
                key={c.id}
                className={cx(
                  "flex items-start gap-2.5",
                  weak && "-mx-2 rounded-md bg-warn-soft px-2 py-1.5",
                  updated && "-mx-2 rounded-md bg-accent-soft px-2 py-1.5",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx("mt-[7px] size-1.5 shrink-0 rounded-full", weak ? "bg-warn" : updated ? "bg-accent" : "bg-faint")}
                />
                <span className={cx("flex-1", weak && "text-warn-ink")}>{c.text}</span>
                {weak ? (
                  <span className="text-xs font-semibold whitespace-nowrap text-warn">Not measurable{c.ref ? ` · §${c.ref}` : ""}</span>
                ) : updated ? (
                  <span className="text-xs font-semibold whitespace-nowrap text-accent">Updated{c.ref ? ` · §${c.ref}` : ""}</span>
                ) : c.ref ? (
                  <span className="font-mono text-xs text-muted">§{c.ref}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {next ? (
          <ActionButton action={toggleGateAction.bind(null, m.id)} pendingText="Saving…" className="justify-start text-[13px] font-normal">
            <span
              aria-hidden="true"
              className={cx("relative h-[18px] w-8 shrink-0 rounded-full", m.gated ? "bg-accent" : "bg-faint")}
            >
              <span className={cx("absolute top-0.5 size-3.5 rounded-full bg-white", m.gated ? "left-4" : "left-0.5")} />
            </span>
            <span>
              {m.gated ? `Payment gate: ${next.code} starts when ${m.code} is paid` : `No gate: ${next.code} can start before ${m.code} is paid`}
            </span>
            <span className="sr-only">{m.gated ? "(on, select to turn off)" : "(off, select to turn on)"}</span>
          </ActionButton>
        ) : (
          <span className="inline-flex min-h-11 items-center text-[13px] text-muted">Final milestone · closes the project when paid</span>
        )}
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[13px] text-ink-2">
            {sub ? (
              <>
                <Avatar initials={sub.initials} tone="ok" />
                {sub.name} · {split.percent}% · <span className="font-mono">{formatMoney(percentOf(m.amountCents, split.percent))}</span> via Payouts
              </>
            ) : (
              <span className="underline underline-offset-2">Add a subcontractor payout</span>
            )}
          </summary>
          <ActionForm action={setSplitAction.bind(null, m.id)} className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`sub-${m.id}`} className="text-xs font-medium text-ink-2">
                Subcontractor
              </label>
              <Select id={`sub-${m.id}`} name="subcontractorId" defaultValue={split?.subcontractorId ?? ""} className="w-48">
                <option value="">No payout</option>
                {state.subcontractors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.role}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`pct-${m.id}`} className="text-xs font-medium text-ink-2">
                Share %
              </label>
              <TextInput id={`pct-${m.id}`} name="percent" type="number" min={1} max={100} defaultValue={split?.percent ?? 30} className="w-24" />
            </div>
            <SubmitButton pendingText="Saving…">Save</SubmitButton>
          </ActionForm>
        </details>
      </div>
    </li>
  );
}

export function DraftReview({ state, project, today, timeZone }: { state: AppState; project: Project; today: string; timeZone: string }) {
  const client = getClient(state, project.clientId)!;
  const milestones = projectMilestones(state, project.id);
  const total = milestones.reduce((sum, m) => sum + m.amountCents, 0);
  const open = openFlags(project);
  const flagged = project.flags.filter((f) => f.kind !== "note");
  const first = milestones[0];
  const last = milestones[milestones.length - 1];
  const months = first && last ? Math.max(1, Math.round(diffDays(last.endDate, first.startDate) / 30)) : 0;
  const gates = milestones.filter((m, i) => m.gated && i < milestones.length - 1).length;
  const subs = new Set(milestones.flatMap((m) => m.splits.map((s) => s.subcontractorId)));
  const subNames = [...subs].map((id) => getSubcontractor(state, id)?.name).filter(Boolean);
  const totalsOk = project.flags.some((f) => f.kind === "totals" && f.severity === "ok");
  const source = project.source;
  const createLabel = `Create project and ${milestones.length} invoice draft${milestones.length === 1 ? "" : "s"}`;

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/", label: "Overview" }, { href: "/projects", label: "Projects" }, { label: "New project from SOW" }]}
        title={`${client.name} · ${project.name}`}
        badge={<Badge tone="accent" icon={<IconSparkle size={14} />}>Read by agent · review before creating</Badge>}
        subtitle={
          source
            ? `From ${source.fileName}, uploaded ${formatRelative(source.uploadedAt, today, timeZone)}. Nothing is created in PayPal until you confirm.`
            : "Nothing is created in PayPal until you confirm."
        }
        actions={
          <>
            <ActionButton action={discardDraftAction.bind(null, project.id)} pendingText="Discarding…">
              Discard
            </ActionButton>
            <ActionButton action={confirmDraftAction.bind(null, project.id)} variant="accent" pendingText="Creating…">
              {createLabel}
            </ActionButton>
          </>
        }
      />
      <PageBody>
        <section aria-label="What the agent found" className="flex flex-wrap gap-4">
          <Tile label="Milestones" value={String(milestones.length)} note={source?.sections.find((s) => /milestone/i.test(s.label))?.ref ? `Dates and amounts from ${source.sections.find((s) => /milestone/i.test(s.label))!.ref}` : "Dates and amounts from the SOW"} />
          <Tile
            label="Total"
            value={formatMoney(total)}
            note={totalsOk ? "Matches the fee in the SOW" : project.totalCents !== total ? `SOW says ${formatMoney(project.totalCents)}` : "Total fee not stated"}
            noteClass={totalsOk ? "font-medium text-ok" : "font-medium text-warn"}
          />
          <Tile label="Schedule" value={first && last ? formatRange(first.startDate, last.endDate) : "—"} note={`About ${months} month${months === 1 ? "" : "s"}`} />
          <Tile
            label="Needs your review"
            value={String(open.length)}
            note={`of ${flagged.length} item${flagged.length === 1 ? "" : "s"} I flagged`}
            noteClass={open.length ? "font-medium text-warn" : "font-medium text-ok"}
          />
        </section>

        <div className="flex flex-row-reverse flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-6">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-4">
                <h2 className="text-base font-semibold">Check before creating</h2>
                <span className="text-[13px] text-muted">I flag any term I can&apos;t turn into something checkable.</span>
              </div>
              <ol>
                {project.flags.map((f) => (
                  <FlagRow key={f.id} project={project} flag={f} state={state} />
                ))}
              </ol>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader title="Milestones" subtitle="Each one becomes a PayPal invoice and a phase on the timeline." />
              <ol>
                {milestones.map((m, i) => (
                  <MilestoneRow key={m.id} m={m} next={milestones[i + 1]} state={state} project={project} />
                ))}
              </ol>
            </Card>
          </div>

          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
            {source ? (
              <Card className="flex flex-col gap-4 px-5 py-4">
                <h2 className="text-base font-semibold">Source document</h2>
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-warn-soft text-[11px] font-semibold text-warn">
                    {source.fileName.split(".").pop()?.toUpperCase().slice(0, 4) ?? "DOC"}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[13px] font-medium break-all">{source.fileName}</span>
                    <span className="text-xs text-muted">
                      {source.pages ? `${source.pages} pages · ` : ""}uploaded {formatRelative(source.uploadedAt, today, timeZone)}
                    </span>
                  </div>
                </div>
                <figure className="flex flex-col gap-2">
                  <div aria-hidden="true" className="flex justify-center rounded-lg bg-chip p-5">
                    <div className="flex aspect-[8.5/11] w-full max-w-[220px] flex-col gap-[7px] rounded bg-white px-[18px] py-5 shadow-[0_1px_2px_rgba(20,23,31,0.08),0_4px_12px_rgba(20,23,31,0.06)]">
                      <div className="h-2 w-[58%] rounded-sm bg-ink-2" />
                      {[94, 88, 72].map((w) => (
                        <div key={w} className="h-[5px] rounded-sm bg-line" style={{ width: `${w}%` }} />
                      ))}
                      <div className="-mx-1.5 my-1.5 flex flex-col gap-[7px] rounded bg-accent-soft px-1.5 py-2 outline outline-accent-line">
                        <div className="h-1.5 w-[46%] rounded-sm bg-accent" />
                        {[90, 84, 92, 66, 88].map((w) => (
                          <div key={w} className="h-[5px] rounded-sm bg-accent-line" style={{ width: `${w}%` }} />
                        ))}
                      </div>
                      {[90, 82, 93, 60, 86].map((w) => (
                        <div key={w} className="h-[5px] rounded-sm bg-line" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  </div>
                  <figcaption className="text-center text-xs text-muted">
                    {source.sections.find((s) => /milestone/i.test(s.label))?.ref ?? "Payment schedule"}, where the milestones came from
                  </figcaption>
                </figure>
                <div className="flex flex-col gap-1">
                  <h3 className="mb-1 text-[13px] font-semibold">Where each detail came from</h3>
                  <ul className="text-[13px]">
                    {source.sections.map((s) => (
                      <li key={s.label} className="flex justify-between gap-3 border-t border-line-soft py-2">
                        <span>{s.label}</span>
                        <span className="font-mono text-xs text-muted">{s.ref}</span>
                      </li>
                    ))}
                    <li className="flex justify-between gap-3 border-t border-line-soft py-2">
                      <span>Payout shares</span>
                      <span className="text-xs text-muted">Your team, not the SOW</span>
                    </li>
                  </ul>
                </div>
              </Card>
            ) : null}

            <Card className="flex flex-col gap-3.5 px-5 py-4">
              <h2 className="text-base font-semibold">When you create the project</h2>
              <ol className="flex flex-col gap-3 text-[13px]">
                {[
                  `${milestones.length} invoice drafts are prepared. Each one is created and sent through PayPal Invoicing only when you approve it.`,
                  `The timeline gets ${gates} payment gate${gates === 1 ? "" : "s"}, so a gated phase starts only after the milestone before it is paid.`,
                  subNames.length
                    ? `Payout shares for ${subNames.join(" and ")} are saved, to send through PayPal Payouts after each payment clears.`
                    : "No subcontractor payouts are set up yet. Add them on any milestone above.",
                  "When your team marks a milestone done, I check it against its acceptance criteria and bring you the invoice to send.",
                ].map((text, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-chip text-xs font-semibold">{i + 1}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
              <ActionButton action={confirmDraftAction.bind(null, project.id)} variant="accent" pendingText="Creating…">
                {createLabel}
              </ActionButton>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}
