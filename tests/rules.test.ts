import { describe, expect, it } from "vitest";
import { openFlags, draftFromExtraction } from "@/lib/agent/draft";
import { pinecrestExtraction } from "@/data/samples";
import { addDays } from "@/lib/domain/dates";
import {
  applyInvoicePaid,
  applyOverdueShifts,
  approvalQueue,
  buildTimeline,
  dashboardKpis,
  getMilestone,
  projectMilestones,
  viewMilestone,
} from "@/lib/domain/rules";
import { byId, seed, TODAY } from "./helpers";

const status = (state: ReturnType<typeof seed>, id: string, today = TODAY) =>
  viewMilestone(state, byId(state.milestones, id), today).status;

describe("milestone status", () => {
  it("derives what the dashboard shows from the seed data", () => {
    const s = seed();
    expect(status(s, "ms_h1")).toBe("paid");
    expect(status(s, "ms_h2")).toBe("verified");
    expect(status(s, "ms_h3")).toBe("locked");
    expect(status(s, "ms_l2")).toBe("overdue");
    expect(status(s, "ms_l3")).toBe("blocked");
    expect(status(s, "ms_n2")).toBe("in_progress");
    expect(status(s, "ms_n3")).toBe("locked");
    expect(status(s, "ms_c1")).toBe("invoiced");
    // Cobalt M1 has no payment gate, so M2 is already under way.
    expect(status(s, "ms_c2")).toBe("in_progress");
  });

  it("reports days overdue", () => {
    const s = seed();
    expect(viewMilestone(s, byId(s.milestones, "ms_l2"), TODAY).overdueDays).toBe(5);
  });
});

describe("applyInvoicePaid", () => {
  it("pays the milestone, queues payouts and unlocks the next phase", () => {
    const s = seed();
    const result = applyInvoicePaid(s, "inv_1042", { today: TODAY })!;
    expect(result.milestone.status).toBe("paid");
    expect(result.payouts).toHaveLength(1);
    expect(result.payouts[0]).toMatchObject({ subcontractorId: "sub_linh", amountCents: 448_000, status: "pending_approval" });
    expect(result.unlocked?.id).toBe("ms_l3");
    // M3 starts next week, so it is unlocked but not started yet.
    expect(status(s, "ms_l3")).toBe("upcoming");
  });

  it("starts the next phase right away when its start date has passed", () => {
    const s = seed();
    const m3 = byId(s.milestones, "ms_l3");
    m3.startDate = addDays(TODAY, -1);
    applyInvoicePaid(s, "inv_1042", { today: TODAY });
    expect(m3.status).toBe("in_progress");
    expect(m3.startDate).toBe(TODAY);
  });

  it("is idempotent", () => {
    const s = seed();
    applyInvoicePaid(s, "inv_1042", { today: TODAY });
    expect(applyInvoicePaid(s, "inv_1042", { today: TODAY })).toBeNull();
    expect(s.payouts.filter((p) => p.milestoneId === "ms_l2")).toHaveLength(1);
  });
});

describe("applyOverdueShifts", () => {
  it("does nothing when the delay already covers the overdue time", () => {
    const s = seed();
    expect(applyOverdueShifts(s, TODAY)).toHaveLength(0);
  });

  it("pushes the blocked phase back another week as the invoice ages", () => {
    const s = seed();
    const later = addDays(TODAY, 3); // 8 days overdue → two weeks of delay
    const m3 = byId(s.milestones, "ms_l3");
    const before = m3.startDate;
    const results = applyOverdueShifts(s, later);
    expect(results).toHaveLength(1);
    expect(results[0].shiftedDays).toBe(7);
    expect(m3.delayDays).toBe(14);
    expect(m3.startDate).toBe(addDays(before, 7));
    expect(applyOverdueShifts(s, later)).toHaveLength(0);
  });
});

describe("dashboard", () => {
  it("computes the KPI row", () => {
    const k = dashboardKpis(seed(), TODAY, "America/Los_Angeles");
    expect(k.awaitingCents).toBe(2_080_000);
    expect(k.overdueCents).toBe(1_280_000);
    expect(k.blockedPhases).toBe(1);
    expect(k.readyCents).toBe(1_400_000);
    expect(k.payoutsQueuedCents).toBe(320_000);
    expect(k.payoutsNeedApproval).toBe(1);
  });

  it("builds the approval queue", () => {
    const kinds = approvalQueue(seed(), TODAY).map((i) => i.kind).sort();
    expect(kinds).toEqual(["payout", "ready_to_invoice", "reminder"]);
  });

  it("lays out the timeline around today", () => {
    const t = buildTimeline(seed(), TODAY, "America/Los_Angeles");
    expect(t.weeks).toHaveLength(8);
    expect(t.groups.map((g) => g.client.name)).toEqual(["Harbor Health", "Lumen Retail", "Northwind Logistics", "Cobalt Fintech"]);
    expect(t.todayPct).toBeGreaterThan(30);
    expect(t.todayPct).toBeLessThan(50);
  });
});

describe("draftFromExtraction", () => {
  it("turns the sample SOW into a draft with flags", () => {
    const s = seed();
    const draft = draftFromExtraction(s, pinecrestExtraction(TODAY), {
      fileName: "sow.pdf",
      uploadedAt: new Date().toISOString(),
      today: TODAY,
      defaultTermDays: 15,
    });
    const ms = projectMilestones(s, draft.id);
    expect(ms.map((m) => m.code)).toEqual(["M1", "M2", "M3", "M4"]);
    expect(ms.reduce((sum, m) => sum + m.amountCents, 0)).toBe(5_000_000);
    expect(draft.totalCents).toBe(5_000_000);
    expect(ms[3].gated).toBe(false);
    expect(openFlags(draft).map((f) => f.kind).sort()).toEqual(["payment_terms", "unmeasurable"]);
    const flag = draft.flags.find((f) => f.kind === "unmeasurable")!;
    const m3 = getMilestone(s, flag.suggestion!.milestoneId)!;
    expect(m3.code).toBe("M3");
  });
});
