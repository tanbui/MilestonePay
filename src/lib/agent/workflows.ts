/**
 * Agent workflows: the steps Milestone Pay takes on the user's behalf.
 *
 * Each workflow reads the state, calls PayPal and/or Claude outside of any
 * store transaction, then writes the outcome back. Anything that moves money
 * (sending an invoice, a reminder or a payout) only runs when a person
 * approves it in the UI; the agent prepares, the human confirms.
 */
import { sampleProjectStart } from "@/data/samples";
import { getAi } from "@/lib/ai";
import { formatShortDate } from "@/lib/domain/dates";
import { newId } from "@/lib/domain/ids";
import { formatMoney } from "@/lib/domain/money";
import {
  allocateInvoiceNumber,
  applyInvoicePaid,
  applyOverdueShifts,
  getClient,
  getMilestone,
  getProject,
  getSubcontractor,
  invoiceForMilestone,
  logActivity,
  nextMilestone,
  overdueDays,
  projectMilestones,
  viewMilestone,
} from "@/lib/domain/rules";
import type { AppState, Evidence, EvidenceKind, Invoice, Milestone } from "@/lib/domain/types";
import { getConfig, today } from "@/lib/env";
import { getPaypal, type PaypalWebhookEvent } from "@/lib/paypal";
import { getStore } from "@/lib/store";
import { draftFromExtraction, openFlags } from "./draft";

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new WorkflowError(`${what} not found.`);
  return value;
}

function label(state: AppState, m: Milestone): string {
  const project = getProject(state, m.projectId);
  const client = project && getClient(state, project.clientId);
  return `${client?.name ?? "Client"} ${m.code}`;
}

// ---------------------------------------------------------------------------
// New project from a SOW

export async function createDraftFromSow(input: {
  fileName: string;
  mediaType: "application/pdf" | "text/plain";
  data: string;
}): Promise<{ projectId: string }> {
  const config = getConfig();
  const t = today(config);
  const extraction = await getAi().extractSow({
    ...input,
    today: t,
    projectStart: sampleProjectStart(t),
    agencyName: config.agencyName,
  });
  if (!extraction.milestones.length) {
    throw new WorkflowError("I couldn't find any billable milestones in that document.");
  }

  return getStore().update((state) => {
    const project = draftFromExtraction(state, extraction, {
      fileName: input.fileName,
      uploadedAt: new Date().toISOString(),
      today: t,
      defaultTermDays: state.settings.defaultTermDays,
    });
    const pages = extraction.pageCount ? ` (${extraction.pageCount} pages)` : "";
    const open = openFlags(project).length;
    logActivity(state, {
      kind: "agent",
      text: `Read ${input.fileName}${pages} → ${extraction.milestones.length} milestones, ${open} item${open === 1 ? "" : "s"} to check`,
      projectId: project.id,
    });
    return { projectId: project.id };
  });
}

export async function applySuggestion(projectId: string, flagId: string, undo = false): Promise<void> {
  await getStore().update((state) => {
    const project = must(getProject(state, projectId), "Project");
    const flag = must(project.flags.find((f) => f.id === flagId), "Flag");
    if (!flag.suggestion) throw new WorkflowError("This item has no suggestion.");
    const m = must(getMilestone(state, flag.suggestion.milestoneId), "Milestone");
    const criterion = must(m.criteria.find((c) => c.id === flag.suggestion!.criterionId), "Criterion");
    if (undo) {
      if (criterion.originalText) criterion.text = criterion.originalText;
      delete criterion.originalText;
      criterion.measurable = false;
      flag.resolved = false;
    } else {
      criterion.originalText ??= criterion.text;
      criterion.text = flag.suggestion.text;
      criterion.measurable = true;
      flag.resolved = true;
    }
  });
}

export async function resolveFlag(projectId: string, flagId: string): Promise<void> {
  await getStore().update((state) => {
    const project = must(getProject(state, projectId), "Project");
    const flag = must(project.flags.find((f) => f.id === flagId), "Flag");
    flag.resolved = true;
  });
}

export async function setPaymentTerms(projectId: string, days: number): Promise<void> {
  if (!Number.isInteger(days) || days < 0 || days > 120) throw new WorkflowError("Payment terms must be 0–120 days.");
  await getStore().update((state) => {
    const project = must(getProject(state, projectId), "Project");
    project.paymentTermDays = days;
    for (const f of project.flags) if (f.kind === "payment_terms") f.resolved = true;
    for (const inv of state.invoices) if (inv.projectId === projectId && inv.status === "draft") inv.termDays = days;
  });
}

export async function toggleGate(milestoneId: string): Promise<void> {
  await getStore().update((state) => {
    const m = must(getMilestone(state, milestoneId), "Milestone");
    m.gated = !m.gated;
  });
}

export async function setSplit(milestoneId: string, subcontractorId: string, percent: number): Promise<void> {
  await getStore().update((state) => {
    const m = must(getMilestone(state, milestoneId), "Milestone");
    if (!subcontractorId) {
      m.splits = [];
      return;
    }
    must(getSubcontractor(state, subcontractorId), "Subcontractor");
    if (!(percent > 0 && percent <= 100)) throw new WorkflowError("Share must be between 1 and 100 percent.");
    m.splits = [{ subcontractorId, percent }];
  });
}

export async function confirmDraft(projectId: string): Promise<void> {
  const t = today();
  await getStore().update((state) => {
    const project = must(getProject(state, projectId), "Project");
    if (project.status !== "draft") throw new WorkflowError("This project was already created.");
    project.status = "active";
    project.flags = project.flags.map((f) => ({ ...f, resolved: true }));
    const milestones = projectMilestones(state, projectId);
    for (const m of milestones) {
      state.invoices.push({
        id: newId("inv"),
        number: allocateInvoiceNumber(state),
        projectId,
        milestoneId: m.id,
        amountCents: m.amountCents,
        status: "draft",
        termDays: project.paymentTermDays,
      });
    }
    if (milestones[0] && milestones[0].startDate <= t) milestones[0].status = "in_progress";
    const client = getClient(state, project.clientId);
    logActivity(state, {
      kind: "user",
      text: `Created ${client?.name} · ${project.name} with ${milestones.length} milestones and ${milestones.length} invoice drafts`,
      projectId,
    });
  });
}

export async function discardDraft(projectId: string): Promise<void> {
  await getStore().update((state) => {
    const project = must(getProject(state, projectId), "Project");
    if (project.status !== "draft") throw new WorkflowError("Only drafts can be discarded.");
    const ids = new Set(state.milestones.filter((m) => m.projectId === projectId).map((m) => m.id));
    state.projects = state.projects.filter((p) => p.id !== projectId);
    state.milestones = state.milestones.filter((m) => !ids.has(m.id));
    state.invoices = state.invoices.filter((i) => i.projectId !== projectId);
    if (!state.projects.some((p) => p.clientId === project.clientId)) {
      state.clients = state.clients.filter((c) => c.id !== project.clientId);
    }
  });
}

// ---------------------------------------------------------------------------
// Delivery: evidence and acceptance checks

export async function startMilestone(milestoneId: string): Promise<void> {
  const t = today();
  await getStore().update((state) => {
    const m = must(getMilestone(state, milestoneId), "Milestone");
    const view = viewMilestone(state, m, t);
    if (view.status === "locked" || view.status === "blocked") {
      throw new WorkflowError(`${m.code} waits until ${view.waitingOn?.code} is paid.`);
    }
    if (m.status !== "upcoming") return;
    m.status = "in_progress";
    if (m.startDate > t) m.startDate = t;
    logActivity(state, { kind: "user", text: `Started ${label(state, m)} ${m.title}`, projectId: m.projectId, milestoneId });
  });
}

export async function addEvidence(
  milestoneId: string,
  input: { kind: EvidenceKind; label: string; url?: string; detail: string; criterionId?: string },
): Promise<void> {
  if (!input.label.trim() || !input.detail.trim()) throw new WorkflowError("Evidence needs a title and some detail.");
  await getStore().update((state) => {
    const m = must(getMilestone(state, milestoneId), "Milestone");
    if (["invoiced", "paid"].includes(m.status)) throw new WorkflowError("This milestone is already invoiced.");
    const evidence: Evidence = {
      id: newId("ev"),
      kind: input.kind,
      label: input.label.trim(),
      url: input.url?.trim() || undefined,
      detail: input.detail.trim(),
      criterionId: input.criterionId || undefined,
      addedAt: new Date().toISOString(),
    };
    m.evidence.push(evidence);
  });
}

export async function removeEvidence(milestoneId: string, evidenceId: string): Promise<void> {
  await getStore().update((state) => {
    const m = must(getMilestone(state, milestoneId), "Milestone");
    m.evidence = m.evidence.filter((e) => e.id !== evidenceId);
  });
}

/** Marks the milestone done and has the agent check it against its criteria. */
export async function runAcceptanceCheck(milestoneId: string): Promise<{ allMet: boolean }> {
  const store = getStore();
  const before = await store.read();
  const m = must(getMilestone(before, milestoneId), "Milestone");
  if (["invoiced", "paid"].includes(m.status)) throw new WorkflowError("This milestone is already invoiced.");
  if (!m.criteria.length) throw new WorkflowError("Add acceptance criteria before running a check.");
  const project = must(getProject(before, m.projectId), "Project");
  const client = must(getClient(before, project.clientId), "Client");

  const ai = getAi();
  const output = await ai.checkAcceptance({ milestone: m, projectName: project.name, clientName: client.name });

  return store.update((state) => {
    const target = must(getMilestone(state, milestoneId), "Milestone");
    const known = new Set(target.criteria.map((c) => c.id));
    const results = target.criteria.map(
      (c) =>
        output.results.find((r) => r.criterionId === c.id && known.has(r.criterionId)) ?? {
          criterionId: c.id,
          verdict: "unclear" as const,
          reasoning: "The check didn't return a verdict for this criterion.",
          evidenceIds: [],
        },
    );
    const met = results.filter((r) => r.verdict === "met").length;
    const allMet = met === results.length;
    target.check = {
      checkedAt: new Date().toISOString(),
      model: ai.model,
      results,
      summary: output.summary,
      note: output.note,
      allMet,
    };
    target.status = allMet ? "verified" : "changes_requested";
    if (allMet) target.progress = 100;
    logActivity(state, {
      kind: "agent",
      text: `Matched ${label(state, target)} to ${met} of ${results.length} acceptance criteria${allMet ? " · ready to invoice" : ""}`,
      projectId: target.projectId,
      milestoneId,
    });
    return { allMet };
  });
}

export async function requestChanges(milestoneId: string): Promise<void> {
  await getStore().update((state) => {
    const m = must(getMilestone(state, milestoneId), "Milestone");
    if (["invoiced", "paid"].includes(m.status)) throw new WorkflowError("This milestone is already invoiced.");
    m.status = "in_progress";
    logActivity(state, { kind: "user", text: `Sent ${label(state, m)} back to the team for changes`, projectId: m.projectId, milestoneId });
  });
}

// ---------------------------------------------------------------------------
// Invoicing (PayPal Invoicing API)

function splitName(full: string): { givenName: string; surname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { givenName: parts[0] || "Accounts", surname: "Payable" };
  return { givenName: parts[0], surname: parts.slice(1).join(" ") };
}

/** Creates and sends the milestone's invoice through PayPal. Needs a human approval in the UI. */
export async function sendMilestoneInvoice(milestoneId: string): Promise<Invoice> {
  const config = getConfig();
  const t = today(config);
  const store = getStore();

  const prepared = await store.update((state) => {
    const m = must(getMilestone(state, milestoneId), "Milestone");
    if (m.status !== "verified") throw new WorkflowError(`${m.code} isn't verified yet.`);
    const project = must(getProject(state, m.projectId), "Project");
    const client = must(getClient(state, project.clientId), "Client");
    let invoice = invoiceForMilestone(state, m.id);
    if (invoice && invoice.status !== "draft") throw new WorkflowError(`${invoice.number} was already sent.`);
    if (!invoice) {
      invoice = {
        id: newId("inv"),
        number: allocateInvoiceNumber(state),
        projectId: project.id,
        milestoneId: m.id,
        amountCents: m.amountCents,
        status: "draft",
        termDays: project.paymentTermDays,
      };
      state.invoices.push(invoice);
    }
    invoice.amountCents = m.amountCents;
    return { invoice: { ...invoice }, milestone: { ...m }, project: { ...project }, client: { ...client }, agency: state.settings.agencyName };
  });

  const { invoice, milestone: m, project, client, agency } = prepared;
  const email = config.paypal.demoClientEmail ?? client.contactEmail;
  if (!email) throw new WorkflowError(`Add a billing email for ${client.name} first.`);

  const paypal = getPaypal();
  // PayPal invoice numbers must be unique per merchant, and demo resets reuse ours.
  const paypalNumber = paypal.mode === "sandbox" ? `${invoice.number}-${Date.now().toString(36).toUpperCase()}` : invoice.number;
  const sent = await paypal.createAndSendInvoice({
    invoiceNumber: paypalNumber,
    recipient: { ...splitName(client.contactName), email },
    itemName: `${m.code} · ${m.title}`,
    itemDescription: `${project.name} for ${client.name}.${m.check ? ` ${m.check.summary}` : ""}`,
    amountCents: invoice.amountCents,
    currency: "USD",
    invoiceDate: t,
    termDays: invoice.termDays,
    note: `Thank you! This invoice covers milestone ${m.code} (${m.title}) of ${project.name}. — ${agency}`,
    reference: m.sourceRef ?? project.name,
  });

  return store.update((state) => {
    const inv = must(state.invoices.find((i) => i.id === invoice.id), "Invoice");
    const ms = must(getMilestone(state, milestoneId), "Milestone");
    inv.status = "sent";
    inv.issueDate = t;
    inv.dueDate = sent.dueDate;
    inv.sentAt = new Date().toISOString();
    inv.paypalInvoiceId = sent.paypalInvoiceId;
    inv.payerUrl = sent.payerUrl;
    ms.status = "invoiced";
    logActivity(state, {
      kind: "paypal",
      text: `Sent ${inv.number} (${formatMoney(inv.amountCents)}) to ${client.name} through PayPal Invoicing · due ${formatShortDate(sent.dueDate)}`,
      projectId: inv.projectId,
      milestoneId,
    });
    return { ...inv };
  });
}

/** Applies a payment (from the PayPal webhook or a simulated one). Idempotent. */
export async function markInvoicePaid(
  ref: { invoiceId?: string; paypalInvoiceId?: string },
  source: "webhook" | "simulated",
): Promise<boolean> {
  const t = today();
  return getStore().update((state) => {
    const invoice = state.invoices.find(
      (i) => (ref.invoiceId && i.id === ref.invoiceId) || (ref.paypalInvoiceId && i.paypalInvoiceId === ref.paypalInvoiceId),
    );
    if (!invoice) return false;
    const result = applyInvoicePaid(state, invoice.id, { today: t });
    if (!result) return false;

    const project = getProject(state, invoice.projectId);
    const client = project && getClient(state, project.clientId);
    const parts: string[] = [];
    if (result.unlocked) {
      parts.push(
        result.unlocked.status === "in_progress"
          ? `unlocked and started ${result.unlocked.code} ${result.unlocked.title}`
          : `unlocked ${result.unlocked.code} ${result.unlocked.title}`,
      );
    }
    if (result.payouts.length) {
      const names = result.payouts.map((p) => getSubcontractor(state, p.subcontractorId)?.name).filter(Boolean);
      parts.push(`queued ${names.join(" and ")}'s payout for approval`);
    }
    logActivity(state, {
      kind: "paypal",
      text: `${invoice.number} paid by ${client?.name ?? "client"} (${source === "webhook" ? "PayPal webhook" : "simulated payment"})${
        parts.length ? ` → ${parts.join(", ")}` : ""
      }`,
      projectId: invoice.projectId,
      milestoneId: invoice.milestoneId,
    });
    return true;
  });
}

/**
 * Demo helper: pays an invoice without a buyer account. In sandbox mode it
 * records the payment in PayPal (which also fires the PAID webhook); either
 * way the app applies the payment right away.
 */
export async function simulateClientPayment(invoiceId: string): Promise<void> {
  const state = await getStore().read();
  const invoice = must(state.invoices.find((i) => i.id === invoiceId), "Invoice");
  if (invoice.status !== "sent") throw new WorkflowError(`${invoice.number} isn't waiting for payment.`);
  const paypal = getPaypal();
  if (paypal.mode === "sandbox" && invoice.paypalInvoiceId) {
    await paypal.recordPayment(invoice.paypalInvoiceId, {
      amountCents: invoice.amountCents,
      date: today(),
      note: "Recorded by the Milestone Pay demo",
    });
  }
  await markInvoicePaid({ invoiceId }, "simulated");
}

// ---------------------------------------------------------------------------
// Overdue invoices: schedule shifts and reminder drafts

export async function runAgentSweep(): Promise<{ shifted: number; remindersDrafted: number }> {
  const config = getConfig();
  const t = today(config);
  const store = getStore();

  const shifts = await store.update((state) => {
    const results = applyOverdueShifts(state, t);
    for (const r of results) {
      const weeks = Math.round(r.shiftedDays / 7);
      logActivity(state, {
        kind: "agent",
        text: `Moved ${label(state, r.blocked)} back ${weeks} week${weeks === 1 ? "" : "s"} while ${r.invoice.number} is unpaid`,
        projectId: r.blocked.projectId,
        milestoneId: r.blocked.id,
      });
    }
    return results.map((r) => ({ invoiceId: r.invoice.id, note: `Moved ${r.blocked.code} ${r.blocked.title} back ${Math.round(r.shiftedDays / 7)} week(s) so the plan stays honest.` }));
  });

  // Draft one reminder per overdue invoice that doesn't already have one waiting.
  const state = await store.read();
  const recent = (iso?: string) => (iso ? Date.now() - new Date(iso).getTime() < 3 * 86_400_000 : false);
  const due = state.invoices.filter(
    (inv) =>
      overdueDays(inv, t) > 0 &&
      !state.reminders.some((r) => r.invoiceId === inv.id && (r.status === "draft" || recent(r.sentAt))),
  );

  const ai = getAi();
  let drafted = 0;
  for (const inv of due) {
    const m = getMilestone(state, inv.milestoneId);
    const project = getProject(state, inv.projectId);
    const client = project && getClient(state, project.clientId);
    if (!m || !project || !client) continue;
    const next = nextMilestone(state, m);
    const scheduleNote = shifts.find((s) => s.invoiceId === inv.id)?.note;
    const draft = await ai.draftReminder({
      agencyName: state.settings.agencyName,
      clientName: client.name,
      contactName: client.contactName,
      invoiceNumber: inv.number,
      amount: formatMoney(inv.amountCents),
      dueDate: formatShortDate(inv.dueDate!),
      daysOverdue: overdueDays(inv, t),
      milestoneTitle: m.title,
      nextPhase: next && m.gated ? `${next.code} ${next.title}` : undefined,
      scheduleNote,
      previousReminders: state.reminders.filter((r) => r.invoiceId === inv.id && r.status === "sent").length,
    });
    await store.update((s) => {
      s.reminders.push({
        id: newId("rem"),
        invoiceId: inv.id,
        subject: draft.subject,
        body: draft.body,
        status: "draft",
        createdAt: new Date().toISOString(),
        scheduleNote,
      });
      logActivity(s, {
        kind: "agent",
        text: `Drafted a reminder for ${inv.number} (${overdueDays(inv, t)} days overdue)`,
        projectId: inv.projectId,
        milestoneId: inv.milestoneId,
      });
    });
    drafted += 1;
  }

  return { shifted: shifts.length, remindersDrafted: drafted };
}

export async function updateReminder(reminderId: string, subject: string, body: string): Promise<void> {
  if (!subject.trim() || !body.trim()) throw new WorkflowError("The reminder needs a subject and a message.");
  await getStore().update((state) => {
    const r = must(state.reminders.find((x) => x.id === reminderId), "Reminder");
    r.subject = subject.trim();
    r.body = body.trim();
  });
}

export async function dismissReminder(reminderId: string): Promise<void> {
  await getStore().update((state) => {
    const r = must(state.reminders.find((x) => x.id === reminderId), "Reminder");
    r.status = "dismissed";
  });
}

/** Sends the reminder through PayPal's invoice reminder email. */
export async function sendReminder(reminderId: string): Promise<void> {
  const store = getStore();
  const state = await store.read();
  const reminder = must(state.reminders.find((r) => r.id === reminderId), "Reminder");
  if (reminder.status !== "draft") throw new WorkflowError("This reminder was already handled.");
  const invoice = must(state.invoices.find((i) => i.id === reminder.invoiceId), "Invoice");
  if (invoice.status !== "sent") throw new WorkflowError(`${invoice.number} isn't waiting for payment.`);

  const paypal = getPaypal();
  const viaPaypal = Boolean(invoice.paypalInvoiceId);
  if (invoice.paypalInvoiceId) {
    await paypal.sendReminder(invoice.paypalInvoiceId, { subject: reminder.subject, note: reminder.body });
  }

  await store.update((s) => {
    const r = must(s.reminders.find((x) => x.id === reminderId), "Reminder");
    r.status = "sent";
    r.sentAt = new Date().toISOString();
    logActivity(s, {
      kind: viaPaypal ? "paypal" : "user",
      text: viaPaypal
        ? `Sent a PayPal reminder for ${invoice.number}`
        : `Marked the reminder for ${invoice.number} as sent (mock invoice, not in PayPal)`,
      projectId: invoice.projectId,
      milestoneId: invoice.milestoneId,
    });
  });
}

// ---------------------------------------------------------------------------
// Subcontractor payouts (PayPal Payouts API)

export async function approvePayout(payoutId: string): Promise<void> {
  const config = getConfig();
  const store = getStore();
  const state = await store.read();
  const payout = must(state.payouts.find((p) => p.id === payoutId), "Payout");
  if (payout.status !== "pending_approval") throw new WorkflowError("This payout was already handled.");
  const sub = must(getSubcontractor(state, payout.subcontractorId), "Subcontractor");
  const m = must(getMilestone(state, payout.milestoneId), "Milestone");
  const project = must(getProject(state, m.projectId), "Project");
  const client = must(getClient(state, project.clientId), "Client");

  const paypal = getPaypal();
  try {
    const result = await paypal.createPayout({
      senderBatchId: `mp_${payout.id}_${Date.now().toString(36)}`,
      emailSubject: `Payment from ${state.settings.agencyName}`,
      emailMessage: `Your share of ${client.name} ${m.code} (${m.title}). Thank you!`,
      items: [
        {
          receiverEmail: config.paypal.demoPayoutEmail ?? sub.paypalEmail,
          amountCents: payout.amountCents,
          note: `${client.name} ${m.code} · ${m.title}`,
          senderItemId: payout.id,
        },
      ],
    });
    await store.update((s) => {
      const p = must(s.payouts.find((x) => x.id === payoutId), "Payout");
      p.status = paypal.mode === "mock" || result.status === "SUCCESS" ? "sent" : "processing";
      p.paypalBatchId = result.batchId;
      p.sentAt = new Date().toISOString();
      delete p.error;
      logActivity(s, {
        kind: "paypal",
        text: `${p.status === "sent" ? "Paid" : "Sending"} ${sub.name} ${formatMoney(p.amountCents)} through PayPal Payouts`,
        projectId: project.id,
        milestoneId: m.id,
      });
    });
  } catch (error) {
    await store.update((s) => {
      const p = s.payouts.find((x) => x.id === payoutId);
      if (p) p.error = error instanceof Error ? error.message : String(error);
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// PayPal webhooks

function invoiceIdFrom(resource: Record<string, unknown>): string | undefined {
  const invoice = (resource.invoice as Record<string, unknown> | undefined) ?? resource;
  return typeof invoice.id === "string" ? invoice.id : undefined;
}

export async function handleWebhookEvent(event: PaypalWebhookEvent): Promise<{ handled: boolean; message: string }> {
  const store = getStore();
  const resource = event.resource ?? {};

  switch (event.event_type) {
    case "INVOICING.INVOICE.PAID": {
      const id = invoiceIdFrom(resource);
      const changed = id ? await markInvoicePaid({ paypalInvoiceId: id }, "webhook") : false;
      return { handled: changed, message: changed ? `Marked ${id} paid` : `No unpaid invoice matches ${id}` };
    }
    case "INVOICING.INVOICE.CANCELLED": {
      const id = invoiceIdFrom(resource);
      const changed = await store.update((state) => {
        const inv = state.invoices.find((i) => i.paypalInvoiceId === id);
        if (!inv || inv.status === "paid") return false;
        inv.status = "cancelled";
        const m = getMilestone(state, inv.milestoneId);
        if (m && m.status === "invoiced") m.status = "verified";
        logActivity(state, { kind: "paypal", text: `${inv.number} was cancelled in PayPal`, projectId: inv.projectId, milestoneId: inv.milestoneId });
        return true;
      });
      return { handled: changed, message: changed ? `Cancelled ${id}` : `No open invoice matches ${id}` };
    }
    case "PAYMENT.PAYOUTSBATCH.SUCCESS":
    case "PAYMENT.PAYOUTSBATCH.DENIED": {
      const header = resource.batch_header as { payout_batch_id?: string } | undefined;
      const batchId = header?.payout_batch_id;
      const ok = event.event_type.endsWith("SUCCESS");
      const count = await store.update((state) => {
        let n = 0;
        for (const p of state.payouts) {
          if (p.paypalBatchId !== batchId || p.status === "sent") continue;
          p.status = ok ? "sent" : "failed";
          if (!ok) p.error = "PayPal denied the payout batch.";
          n += 1;
          const sub = getSubcontractor(state, p.subcontractorId);
          logActivity(state, {
            kind: "paypal",
            text: ok ? `PayPal confirmed ${sub?.name}'s payout of ${formatMoney(p.amountCents)}` : `PayPal denied ${sub?.name}'s payout`,
            milestoneId: p.milestoneId,
          });
        }
        return n;
      });
      return { handled: count > 0, message: `Updated ${count} payout(s)` };
    }
    case "PAYMENT.PAYOUTS-ITEM.SUCCEEDED":
    case "PAYMENT.PAYOUTS-ITEM.FAILED":
    case "PAYMENT.PAYOUTS-ITEM.BLOCKED":
    case "PAYMENT.PAYOUTS-ITEM.RETURNED":
    case "PAYMENT.PAYOUTS-ITEM.UNCLAIMED": {
      const item = resource.payout_item as { sender_item_id?: string } | undefined;
      const senderItemId = item?.sender_item_id;
      const ok = event.event_type.endsWith("SUCCEEDED");
      const changed = await store.update((state) => {
        const p = state.payouts.find((x) => x.id === senderItemId);
        if (!p) return false;
        p.status = ok ? "sent" : "failed";
        if (!ok) p.error = `PayPal reported ${event.event_type.split(".").pop()?.toLowerCase()}.`;
        return true;
      });
      return { handled: changed, message: changed ? `Updated payout ${senderItemId}` : `No payout matches ${senderItemId}` };
    }
    default:
      return { handled: false, message: `Ignored ${event.event_type}` };
  }
}

// ---------------------------------------------------------------------------

export async function resetDemo(): Promise<void> {
  await getStore().reset();
}
