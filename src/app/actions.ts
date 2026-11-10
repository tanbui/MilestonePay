"use server";

/**
 * Server actions behind every button. Each one wraps an agent workflow,
 * turns errors into a message the UI can show, and refreshes the page.
 *
 * Note: this is a single-user hackathon demo with no sign-in. Anyone who can
 * reach the deployment can call these, so only use PayPal sandbox keys.
 */
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import * as wf from "@/lib/agent/workflows";
import type { ActionResult } from "@/lib/action-result";
import type { EvidenceKind } from "@/lib/domain/types";
import { PaypalError } from "@/lib/paypal";

function friendly(error: unknown): string {
  if (error instanceof wf.WorkflowError) return error.message;
  if (error instanceof PaypalError) {
    return `${error.message}${error.debugId ? ` (debug id ${error.debugId})` : ""}`;
  }
  if (error instanceof Error) {
    console.error(error);
    return error.message || "Something went wrong.";
  }
  return "Something went wrong.";
}

async function run(work: () => Promise<unknown>, message?: string): Promise<ActionResult> {
  try {
    await work();
  } catch (error) {
    return { ok: false, error: friendly(error) };
  }
  refresh();
  return { ok: true, message };
}

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "");

// Invoices, reminders and payouts -------------------------------------------

export async function sendInvoiceAction(milestoneId: string, _p: ActionResult, _fd: FormData) {
  return run(() => wf.sendMilestoneInvoice(milestoneId));
}

export async function simulatePaymentAction(invoiceId: string, _p: ActionResult, _fd: FormData) {
  return run(() => wf.simulateClientPayment(invoiceId));
}

export async function sendReminderAction(reminderId: string, _p: ActionResult, _fd: FormData) {
  return run(() => wf.sendReminder(reminderId));
}

export async function saveReminderAction(reminderId: string, _p: ActionResult, fd: FormData) {
  const subject = text(fd, "subject");
  const body = text(fd, "body");
  const intent = text(fd, "intent");
  return run(async () => {
    await wf.updateReminder(reminderId, subject, body);
    if (intent === "send") await wf.sendReminder(reminderId);
  }, intent === "send" ? undefined : "Saved");
}

export async function dismissReminderAction(reminderId: string, _p: ActionResult, _fd: FormData) {
  return run(() => wf.dismissReminder(reminderId));
}

export async function approvePayoutAction(payoutId: string, _p: ActionResult, _fd: FormData) {
  return run(() => wf.approvePayout(payoutId));
}

// Delivery --------------------------------------------------------------------

export async function startMilestoneAction(milestoneId: string, _p: ActionResult, _fd: FormData) {
  return run(() => wf.startMilestone(milestoneId));
}

export async function addEvidenceAction(milestoneId: string, _p: ActionResult, fd: FormData) {
  return run(
    () =>
      wf.addEvidence(milestoneId, {
        kind: (text(fd, "kind") || "note") as EvidenceKind,
        label: text(fd, "label"),
        url: text(fd, "url"),
        detail: text(fd, "detail"),
        criterionId: text(fd, "criterionId"),
      }),
    "Evidence added",
  );
}

export async function removeEvidenceAction(milestoneId: string, evidenceId: string, _p: ActionResult, _fd: FormData) {
  return run(() => wf.removeEvidence(milestoneId, evidenceId));
}

export async function runCheckAction(milestoneId: string, _p: ActionResult, _fd: FormData) {
  return run(() => wf.runAcceptanceCheck(milestoneId));
}

export async function requestChangesAction(milestoneId: string, _p: ActionResult, _fd: FormData) {
  return run(() => wf.requestChanges(milestoneId));
}

// New project from SOW --------------------------------------------------------

export async function applySuggestionAction(projectId: string, flagId: string, undo: boolean, _p: ActionResult, _fd: FormData) {
  return run(() => wf.applySuggestion(projectId, flagId, undo));
}

export async function resolveFlagAction(projectId: string, flagId: string, _p: ActionResult, _fd: FormData) {
  return run(() => wf.resolveFlag(projectId, flagId));
}

export async function setTermsAction(projectId: string, _p: ActionResult, fd: FormData) {
  return run(() => wf.setPaymentTerms(projectId, Number(text(fd, "days"))), "Terms updated");
}

export async function toggleGateAction(milestoneId: string, _p: ActionResult, _fd: FormData) {
  return run(() => wf.toggleGate(milestoneId));
}

export async function setSplitAction(milestoneId: string, _p: ActionResult, fd: FormData) {
  return run(() => wf.setSplit(milestoneId, text(fd, "subcontractorId"), Number(text(fd, "percent"))), "Saved");
}

export async function confirmDraftAction(projectId: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  try {
    await wf.confirmDraft(projectId);
  } catch (error) {
    return { ok: false, error: friendly(error) };
  }
  redirect("/");
}

export async function discardDraftAction(projectId: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  try {
    await wf.discardDraft(projectId);
  } catch (error) {
    return { ok: false, error: friendly(error) };
  }
  redirect("/projects");
}

// Agent and demo controls -----------------------------------------------------

export async function runSweepAction(_p: ActionResult, _fd: FormData): Promise<ActionResult> {
  try {
    const r = await wf.runAgentSweep();
    refresh();
    const parts = [];
    if (r.shifted) parts.push(`moved ${r.shifted} phase${r.shifted === 1 ? "" : "s"}`);
    if (r.remindersDrafted) parts.push(`drafted ${r.remindersDrafted} reminder${r.remindersDrafted === 1 ? "" : "s"}`);
    return { ok: true, message: parts.length ? `Agent ${parts.join(" and ")}.` : "Nothing new for the agent to do." };
  } catch (error) {
    return { ok: false, error: friendly(error) };
  }
}

export async function resetDemoAction(_p: ActionResult, _fd: FormData) {
  return run(() => wf.resetDemo(), "Demo data reset");
}
