/**
 * Pure business rules. Everything here takes the app state (and "today")
 * and either reads it or mutates it in place; no I/O. The agent workflows
 * in `src/lib/agent` call these and add the PayPal and Claude side effects.
 */
import { addDays, dateOf, diffDays, formatShortDate, maxDate, minDate, startOfWeek } from "./dates";
import { newId } from "./ids";
import { formatMoney, percentOf } from "./money";
import type {
  ActivityEvent,
  AppState,
  Cents,
  Client,
  ISODate,
  ISODateTime,
  Invoice,
  Milestone,
  Payout,
  Project,
  ReminderDraft,
  Subcontractor,
} from "./types";

// ---------------------------------------------------------------------------
// Lookups

export function codeOrder(code: string): number {
  const n = parseInt(code.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export function projectMilestones(state: AppState, projectId: string): Milestone[] {
  return state.milestones
    .filter((m) => m.projectId === projectId)
    .sort((a, b) => codeOrder(a.code) - codeOrder(b.code));
}

export function previousMilestone(state: AppState, m: Milestone): Milestone | undefined {
  const list = projectMilestones(state, m.projectId);
  const i = list.findIndex((x) => x.id === m.id);
  return i > 0 ? list[i - 1] : undefined;
}

export function nextMilestone(state: AppState, m: Milestone): Milestone | undefined {
  const list = projectMilestones(state, m.projectId);
  const i = list.findIndex((x) => x.id === m.id);
  return i >= 0 && i < list.length - 1 ? list[i + 1] : undefined;
}

export function getProject(state: AppState, id: string): Project | undefined {
  return state.projects.find((p) => p.id === id);
}

export function getClient(state: AppState, id: string): Client | undefined {
  return state.clients.find((c) => c.id === id);
}

export function getMilestone(state: AppState, id: string): Milestone | undefined {
  return state.milestones.find((m) => m.id === id);
}

export function getSubcontractor(state: AppState, id: string): Subcontractor | undefined {
  return state.subcontractors.find((s) => s.id === id);
}

/** The milestone's current invoice (ignores cancelled ones). */
export function invoiceForMilestone(state: AppState, milestoneId: string): Invoice | undefined {
  return state.invoices.find((i) => i.milestoneId === milestoneId && i.status !== "cancelled");
}

export function overdueDays(invoice: Invoice | undefined, today: ISODate): number {
  if (!invoice || invoice.status !== "sent" || !invoice.dueDate) return 0;
  return Math.max(0, diffDays(today, invoice.dueDate));
}

// ---------------------------------------------------------------------------
// Milestone status as the user sees it

export type DisplayStatus =
  | "paid"
  | "invoiced"
  | "overdue"
  | "verified"
  | "submitted"
  | "changes_requested"
  | "in_progress"
  | "locked"
  | "blocked"
  | "upcoming";

export interface MilestoneView {
  milestone: Milestone;
  project: Project;
  client: Client;
  invoice?: Invoice;
  status: DisplayStatus;
  overdueDays: number;
  /** For locked / blocked milestones: the unpaid milestone they wait on. */
  waitingOn?: Milestone;
}

export function viewMilestone(state: AppState, m: Milestone, today: ISODate): MilestoneView {
  const project = getProject(state, m.projectId)!;
  const client = getClient(state, project.clientId)!;
  const invoice = invoiceForMilestone(state, m.id);
  const od = overdueDays(invoice, today);
  const base = { milestone: m, project, client, invoice, overdueDays: od };

  switch (m.status) {
    case "paid":
      return { ...base, status: "paid" };
    case "invoiced":
      return { ...base, status: od > 0 ? "overdue" : "invoiced" };
    case "verified":
    case "submitted":
    case "changes_requested":
    case "in_progress":
      return { ...base, status: m.status };
    case "upcoming": {
      const prev = previousMilestone(state, m);
      if (prev && prev.gated && prev.status !== "paid") {
        const prevOverdue = overdueDays(invoiceForMilestone(state, prev.id), today) > 0;
        return { ...base, status: prevOverdue ? "blocked" : "locked", waitingOn: prev };
      }
      return { ...base, status: "upcoming" };
    }
  }
}

export function payoutShares(m: Milestone): { subcontractorId: string; percent: number; amountCents: Cents }[] {
  return m.splits.map((s) => ({ ...s, amountCents: percentOf(m.amountCents, s.percent) }));
}

// ---------------------------------------------------------------------------
// Mutations

export function logActivity(
  state: AppState,
  entry: Omit<ActivityEvent, "id" | "at"> & { at?: ISODateTime },
): ActivityEvent {
  const event: ActivityEvent = { id: newId("act"), at: entry.at ?? new Date().toISOString(), ...entry };
  state.activity.unshift(event);
  if (state.activity.length > 200) state.activity.length = 200;
  return event;
}

export function allocateInvoiceNumber(state: AppState): string {
  const n = state.nextInvoiceNumber;
  state.nextInvoiceNumber = n + 1;
  return `MP-${n}`;
}

export interface PaidResult {
  invoice: Invoice;
  milestone: Milestone;
  unlocked?: Milestone;
  payouts: Payout[];
}

/**
 * Marks an invoice paid and applies the consequences: the milestone is paid,
 * subcontractor payouts are queued for approval, and the next phase unlocks.
 * Returns null when the invoice is unknown or already paid (idempotent).
 */
export function applyInvoicePaid(
  state: AppState,
  invoiceId: string,
  opts: { today: ISODate; now?: ISODateTime },
): PaidResult | null {
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  if (!invoice || invoice.status === "paid" || invoice.status === "cancelled") return null;
  const milestone = getMilestone(state, invoice.milestoneId);
  if (!milestone) return null;

  const now = opts.now ?? new Date().toISOString();
  invoice.status = "paid";
  invoice.paidAt = now;
  milestone.status = "paid";
  milestone.paidAt = now;
  milestone.progress = 100;

  const payouts: Payout[] = [];
  for (const share of payoutShares(milestone)) {
    const exists = state.payouts.some(
      (p) => p.milestoneId === milestone.id && p.subcontractorId === share.subcontractorId,
    );
    if (exists || share.amountCents <= 0) continue;
    const payout: Payout = {
      id: newId("po"),
      milestoneId: milestone.id,
      subcontractorId: share.subcontractorId,
      amountCents: share.amountCents,
      status: "pending_approval",
      createdAt: now,
    };
    state.payouts.push(payout);
    payouts.push(payout);
  }

  let unlocked: Milestone | undefined;
  const next = nextMilestone(state, milestone);
  if (next && milestone.gated && next.status === "upcoming") {
    unlocked = next;
    if (next.startDate <= opts.today) {
      next.status = "in_progress";
      next.startDate = opts.today;
      if (next.endDate < next.startDate) next.endDate = next.startDate;
    }
  }

  return { invoice, milestone, unlocked, payouts };
}

export interface ShiftResult {
  invoice: Invoice;
  blocked: Milestone;
  shiftedDays: number;
  totalDelayDays: number;
}

/**
 * For every overdue invoice on a gated milestone, pushes the phase that waits
 * on it (and every later phase in that project) back in whole weeks so the
 * plan stays honest. Safe to run repeatedly.
 */
export function applyOverdueShifts(state: AppState, today: ISODate): ShiftResult[] {
  const results: ShiftResult[] = [];
  for (const invoice of state.invoices) {
    const od = overdueDays(invoice, today);
    if (od <= 0) continue;
    const milestone = getMilestone(state, invoice.milestoneId);
    if (!milestone || !milestone.gated) continue;
    const blocked = nextMilestone(state, milestone);
    if (!blocked || blocked.status !== "upcoming") continue;

    const required = Math.ceil(od / 7) * 7;
    if (blocked.delayDays >= required) continue;
    const delta = required - blocked.delayDays;

    const later = projectMilestones(state, milestone.projectId).filter(
      (m) => codeOrder(m.code) >= codeOrder(blocked.code) && m.status === "upcoming",
    );
    for (const m of later) {
      m.startDate = addDays(m.startDate, delta);
      m.endDate = addDays(m.endDate, delta);
      m.delayDays += delta;
    }
    results.push({ invoice, blocked, shiftedDays: delta, totalDelayDays: blocked.delayDays });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Dashboard view models

export type ApprovalItem =
  | { kind: "ready_to_invoice"; at: ISODateTime; view: MilestoneView }
  | { kind: "reminder"; at: ISODateTime; view: MilestoneView; reminder: ReminderDraft; invoice: Invoice }
  | {
      kind: "payout";
      at: ISODateTime;
      view: MilestoneView;
      payout: Payout;
      subcontractor: Subcontractor;
      unlocked?: Milestone;
    };

export function approvalQueue(state: AppState, today: ISODate): ApprovalItem[] {
  const items: ApprovalItem[] = [];

  for (const m of state.milestones) {
    if (m.status !== "verified") continue;
    items.push({ kind: "ready_to_invoice", at: m.check?.checkedAt ?? state.seededAt, view: viewMilestone(state, m, today) });
  }

  for (const reminder of state.reminders) {
    if (reminder.status !== "draft") continue;
    const invoice = state.invoices.find((i) => i.id === reminder.invoiceId);
    if (!invoice || invoice.status !== "sent") continue;
    const m = getMilestone(state, invoice.milestoneId);
    if (!m) continue;
    items.push({ kind: "reminder", at: reminder.createdAt, view: viewMilestone(state, m, today), reminder, invoice });
  }

  for (const payout of state.payouts) {
    if (payout.status !== "pending_approval") continue;
    const m = getMilestone(state, payout.milestoneId);
    const sub = getSubcontractor(state, payout.subcontractorId);
    if (!m || !sub) continue;
    const next = nextMilestone(state, m);
    items.push({
      kind: "payout",
      at: payout.createdAt,
      view: viewMilestone(state, m, today),
      payout,
      subcontractor: sub,
      unlocked: next && m.gated ? next : undefined,
    });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export interface Kpis {
  awaitingCents: Cents;
  awaitingCount: number;
  overdueCents: Cents;
  overdueCount: number;
  blockedPhases: number;
  readyCents: Cents;
  readyCount: number;
  collectedCents: Cents;
  collectedCount: number;
  collectedClients: string[];
  payoutsQueuedCents: Cents;
  payoutsNeedApproval: number;
}

export function dashboardKpis(state: AppState, today: ISODate, timeZone: string): Kpis {
  const k: Kpis = {
    awaitingCents: 0,
    awaitingCount: 0,
    overdueCents: 0,
    overdueCount: 0,
    blockedPhases: 0,
    readyCents: 0,
    readyCount: 0,
    collectedCents: 0,
    collectedCount: 0,
    collectedClients: [],
    payoutsQueuedCents: 0,
    payoutsNeedApproval: 0,
  };
  const since = addDays(today, -30);

  for (const inv of state.invoices) {
    if (inv.status === "sent") {
      k.awaitingCents += inv.amountCents;
      k.awaitingCount += 1;
      if (overdueDays(inv, today) > 0) {
        k.overdueCents += inv.amountCents;
        k.overdueCount += 1;
      }
    }
    if (inv.status === "paid" && inv.paidAt) {
      const paidDay = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(inv.paidAt));
      if (paidDay >= since) {
        k.collectedCents += inv.amountCents;
        k.collectedCount += 1;
        const project = getProject(state, inv.projectId);
        const client = project && getClient(state, project.clientId);
        const short = client?.name.split(" ")[0];
        if (short && !k.collectedClients.includes(short)) k.collectedClients.push(short);
      }
    }
  }

  for (const m of state.milestones) {
    const project = getProject(state, m.projectId);
    if (!project || project.status !== "active") continue;
    if (m.status === "verified") {
      k.readyCents += m.amountCents;
      k.readyCount += 1;
    }
    if (viewMilestone(state, m, today).status === "blocked") k.blockedPhases += 1;
  }

  for (const p of state.payouts) {
    if (p.status === "pending_approval" || p.status === "processing") {
      k.payoutsQueuedCents += p.amountCents;
    }
    if (p.status === "pending_approval") k.payoutsNeedApproval += 1;
  }
  return k;
}

export type PayoutRow =
  | { kind: "payout"; payout: Payout; subcontractor: Subcontractor; view: MilestoneView }
  | { kind: "waiting"; subcontractor: Subcontractor; view: MilestoneView; amountCents: Cents };

/** Stored payouts plus the shares still waiting on a client payment. */
export function payoutRows(state: AppState, today: ISODate): PayoutRow[] {
  const rank = { pending_approval: 0, processing: 1, failed: 1, sent: 3 } as const;
  const stored: PayoutRow[] = state.payouts.flatMap((p) => {
    const sub = getSubcontractor(state, p.subcontractorId);
    const m = getMilestone(state, p.milestoneId);
    return sub && m ? [{ kind: "payout" as const, payout: p, subcontractor: sub, view: viewMilestone(state, m, today) }] : [];
  });

  const waiting: PayoutRow[] = [];
  for (const m of state.milestones) {
    if (m.status === "paid") continue;
    const project = getProject(state, m.projectId);
    if (!project || project.status !== "active") continue;
    if (!["verified", "invoiced", "submitted"].includes(m.status)) continue;
    for (const share of payoutShares(m)) {
      const sub = getSubcontractor(state, share.subcontractorId);
      if (sub) waiting.push({ kind: "waiting", subcontractor: sub, view: viewMilestone(state, m, today), amountCents: share.amountCents });
    }
  }

  const order = (r: PayoutRow) => (r.kind === "waiting" ? 2 : rank[r.payout.status]);
  return [...stored, ...waiting].sort((a, b) => {
    const d = order(a) - order(b);
    if (d !== 0) return d;
    const at = (r: PayoutRow) => (r.kind === "payout" ? r.payout.sentAt ?? r.payout.createdAt : "");
    return at(b).localeCompare(at(a));
  });
}

// ---------------------------------------------------------------------------
// Delivery timeline

export interface TimelineBar {
  view: MilestoneView;
  /** Position inside the visible window, in percent. */
  leftPct: number;
  widthPct: number;
  /** "before" / "after" when the milestone sits outside the window. */
  offscreen?: "after";
  label: string;
}

export interface TimelineGroup {
  project: Project;
  client: Client;
  summary: string;
  bars: TimelineBar[];
}

export interface TimelineModel {
  start: ISODate;
  end: ISODate;
  weeks: ISODate[];
  todayPct: number;
  groups: TimelineGroup[];
}

export function barLabel(view: MilestoneView, timeZone: string): string {
  const m = view.milestone;
  const amount = formatMoney(m.amountCents);
  switch (view.status) {
    case "paid":
      return `Paid ${m.paidAt ? formatShortDate(dateOf(m.paidAt, timeZone)) : ""} · ${amount}`;
    case "verified":
      return `Verified · ${amount}`;
    case "invoiced":
      return `Invoiced · due ${view.invoice?.dueDate ? formatShortDate(view.invoice.dueDate) : "soon"} · ${amount}`;
    case "overdue":
      return `Overdue ${view.overdueDays}d · ${amount}`;
    case "blocked": {
      const weeks = Math.round(m.delayDays / 7);
      const moved = weeks > 0 ? ` · moved +${weeks} week${weeks > 1 ? "s" : ""}` : "";
      return `Blocked by ${view.waitingOn?.code ?? "payment"}${moved} · ${amount}`;
    }
    case "locked":
      return `Unlocks when ${view.waitingOn?.code ?? "the last phase"} is paid · ${amount}`;
    case "in_progress":
      return `In progress · ${m.progress}% · ${amount}`;
    case "submitted":
      return `Checking evidence · ${amount}`;
    case "changes_requested":
      return `Changes requested · ${amount}`;
    case "upcoming":
      return `Upcoming · ${amount}`;
  }
}

export function projectSummary(state: AppState, project: Project, today: ISODate): string {
  const ms = projectMilestones(state, project.id);
  const paid = ms.filter((m) => m.status === "paid").length;
  const overdue = ms.filter((m) => viewMilestone(state, m, today).status === "overdue").length;
  const parts = [project.name, formatMoney(project.totalCents), `${paid} of ${ms.length} paid`];
  if (overdue) parts.push(`${overdue} overdue`);
  return parts.join(" · ");
}

export function buildTimeline(state: AppState, today: ISODate, timeZone: string, weeks = 8): TimelineModel {
  const start = startOfWeek(addDays(today, -21));
  const end = addDays(start, weeks * 7);
  const span = weeks * 7;
  const pct = (d: ISODate) => (diffDays(d, start) / span) * 100;

  const groups: TimelineGroup[] = [];
  for (const project of state.projects) {
    if (project.status !== "active") continue;
    const client = getClient(state, project.clientId)!;
    const bars: TimelineBar[] = [];
    for (const m of projectMilestones(state, project.id)) {
      const view = viewMilestone(state, m, today);
      const barEnd = addDays(m.endDate, 1);
      if (barEnd <= start) continue; // finished before the window
      const label = barLabel(view, timeZone);
      if (m.startDate >= end) {
        bars.push({ view, leftPct: 100, widthPct: 0, offscreen: "after", label });
        continue;
      }
      const s = maxDate(m.startDate, start);
      const e = minDate(barEnd, end);
      bars.push({ view, leftPct: pct(s), widthPct: Math.max(pct(e) - pct(s), 2), label });
    }
    if (bars.length) groups.push({ project, client, summary: projectSummary(state, project, today), bars });
  }

  return {
    start,
    end,
    weeks: Array.from({ length: weeks }, (_, i) => addDays(start, i * 7)),
    todayPct: ((diffDays(today, start) + 0.5) / span) * 100,
    groups,
  };
}
