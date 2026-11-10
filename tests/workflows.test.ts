import { beforeEach, describe, expect, it } from "vitest";
import { PINECREST_SOW_TEXT } from "@/data/samples";
import { setAi } from "@/lib/ai";
import { createMockAi } from "@/lib/ai/mock";
import * as wf from "@/lib/agent/workflows";
import { addDays } from "@/lib/domain/dates";
import { getMilestone, projectMilestones } from "@/lib/domain/rules";
import { setPaypal } from "@/lib/paypal";
import { createMockGateway } from "@/lib/paypal/mock";
import { getStore, setStore } from "@/lib/store";
import { createMemoryStore } from "@/lib/store/memory";
import { byId, seed, TODAY } from "./helpers";

beforeEach(() => {
  setStore(createMemoryStore(seed()));
  setPaypal(createMockGateway());
  setAi(createMockAi());
});

const read = () => getStore().read();

describe("invoice → payment → payout", () => {
  it("runs the full money loop for a verified milestone", async () => {
    const invoice = await wf.sendMilestoneInvoice("ms_h2");
    expect(invoice).toMatchObject({ number: "MP-1045", status: "sent", issueDate: TODAY, dueDate: addDays(TODAY, 15) });
    expect(invoice.paypalInvoiceId).toMatch(/^INV2-/);
    expect(byId((await read()).milestones, "ms_h2").status).toBe("invoiced");

    await wf.simulateClientPayment(invoice.id);
    let s = await read();
    expect(byId(s.invoices, invoice.id).status).toBe("paid");
    const payout = s.payouts.find((p) => p.milestoneId === "ms_h2")!;
    expect(payout).toMatchObject({ subcontractorId: "sub_minh", amountCents: 560_000, status: "pending_approval" });

    await wf.approvePayout(payout.id);
    s = await read();
    expect(byId(s.payouts, payout.id).status).toBe("sent");
    expect(s.activity[0].text).toContain("Minh Le");
  });

  it("refuses to invoice a milestone that isn't verified", async () => {
    await expect(wf.sendMilestoneInvoice("ms_n2")).rejects.toThrow(/isn't verified/);
  });

  it("applies the PayPal PAID webhook by PayPal invoice id", async () => {
    const invoice = await wf.sendMilestoneInvoice("ms_h2");
    const result = await wf.handleWebhookEvent({
      id: "WH-1",
      event_type: "INVOICING.INVOICE.PAID",
      resource: { invoice: { id: invoice.paypalInvoiceId } },
    });
    expect(result.handled).toBe(true);
    expect(byId((await read()).invoices, invoice.id).status).toBe("paid");
    // A replayed webhook changes nothing.
    expect((await wf.handleWebhookEvent({ id: "WH-1", event_type: "INVOICING.INVOICE.PAID", resource: { invoice: { id: invoice.paypalInvoiceId } } })).handled).toBe(false);
  });
});

describe("acceptance check", () => {
  it("verifies a milestone when evidence covers every criterion", async () => {
    await wf.addEvidence("ms_n2", { kind: "demo", label: "Route acceptance demo", detail: "Drivers accept the day's route on Android.", criterionId: "ac_n2_1" });
    await wf.addEvidence("ms_n2", { kind: "test_report", label: "Offline test", detail: "Last synced route kept for 24 hours offline.", criterionId: "ac_n2_2" });
    const { allMet } = await wf.runAcceptanceCheck("ms_n2");
    expect(allMet).toBe(true);
    expect(byId((await read()).milestones, "ms_n2").status).toBe("verified");
  });

  it("asks for changes when evidence is missing", async () => {
    await wf.addEvidence("ms_n2", { kind: "demo", label: "Route demo", detail: "Drivers accept routes.", criterionId: "ac_n2_1" });
    const { allMet } = await wf.runAcceptanceCheck("ms_n2");
    expect(allMet).toBe(false);
    const m = byId((await read()).milestones, "ms_n2");
    expect(m.status).toBe("changes_requested");
    expect(m.check?.results.find((r) => r.criterionId === "ac_n2_2")?.verdict).toBe("unclear");
  });
});

describe("new project from SOW", () => {
  it("drafts, fixes a flagged criterion and creates the project", async () => {
    const { projectId } = await wf.createDraftFromSow({ fileName: "Pinecrest.md", mediaType: "text/plain", data: PINECREST_SOW_TEXT });
    let s = await read();
    const project = byId(s.projects, projectId);
    expect(project.status).toBe("draft");

    const flag = project.flags.find((f) => f.kind === "unmeasurable")!;
    await wf.applySuggestion(projectId, flag.id);
    s = await read();
    const m3 = getMilestone(s, flag.suggestion!.milestoneId)!;
    expect(m3.criteria.some((c) => c.text.startsWith("p95 latency"))).toBe(true);

    await wf.applySuggestion(projectId, flag.id, true);
    s = await read();
    expect(getMilestone(s, m3.id)!.criteria.some((c) => c.text.startsWith("Reasonable"))).toBe(true);

    await wf.setPaymentTerms(projectId, 30);
    await wf.confirmDraft(projectId);
    s = await read();
    expect(byId(s.projects, projectId).status).toBe("active");
    const drafts = s.invoices.filter((i) => i.projectId === projectId);
    expect(drafts).toHaveLength(4);
    expect(drafts.every((i) => i.status === "draft" && i.termDays === 30)).toBe(true);
    expect(projectMilestones(s, projectId)).toHaveLength(4);
  });

  it("discards a draft and its new client", async () => {
    const { projectId } = await wf.createDraftFromSow({ fileName: "x.md", mediaType: "text/plain", data: "..." });
    const clientsBefore = (await read()).clients.length;
    await wf.discardDraft(projectId);
    const s = await read();
    expect(s.projects.some((p) => p.id === projectId)).toBe(false);
    // The seed already has a Pinecrest draft, so the client stays.
    expect(s.clients.length).toBe(clientsBefore);
  });
});

describe("agent sweep", () => {
  it("drafts a reminder only when none is waiting", async () => {
    expect(await wf.runAgentSweep()).toEqual({ shifted: 0, remindersDrafted: 0 });
    await wf.dismissReminder("rem_1042");
    expect((await wf.runAgentSweep()).remindersDrafted).toBe(1);
    const s = await read();
    const draft = s.reminders.find((r) => r.invoiceId === "inv_1042" && r.status === "draft")!;
    expect(draft.subject).toContain("MP-1042");
    expect(draft.body).toContain("Storefront sync");
  });

  it("sends a reminder for a mock invoice without calling PayPal", async () => {
    await wf.sendReminder("rem_1042");
    const s = await read();
    expect(byId(s.reminders, "rem_1042").status).toBe("sent");
  });
});
