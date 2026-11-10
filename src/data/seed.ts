/**
 * Mock data for development, tests and demos.
 *
 * Every date is relative to "today", so the dashboard always looks current:
 * one invoice is a few days overdue, one milestone was just verified, one
 * payment cleared yesterday and a new SOW is waiting for review.
 */
import { draftFromExtraction } from "@/lib/agent/draft";
import { addDays, formatShortDate, zonedTime } from "@/lib/domain/dates";
import type {
  AppState,
  Client,
  Evidence,
  ISODate,
  Invoice,
  Milestone,
  Payout,
  Project,
  Subcontractor,
} from "@/lib/domain/types";
import { PINECREST_SOW_FILENAME, pinecrestExtraction } from "./samples";

export interface SeedOptions {
  today: ISODate;
  now?: Date;
  timeZone: string;
  agencyName: string;
  defaultTermDays: number;
}

export function createSeedState(opts: SeedOptions): AppState {
  const T = opts.today;
  const tz = opts.timeZone;
  const now = opts.now ?? new Date();
  const d = (offset: number) => addDays(T, offset);
  const at = (offset: number, hour: number, minute = 0) => zonedTime(d(offset), hour, minute, tz);
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

  const clients: Client[] = [
    { id: "cl_harbor", name: "Harbor Health", contactName: "Priya Nair", contactEmail: "ap@harborhealth.example" },
    { id: "cl_lumen", name: "Lumen Retail", contactName: "Dana Whitfield", contactEmail: "dana@lumenretail.example" },
    { id: "cl_northwind", name: "Northwind Logistics", contactName: "Marcus Bell", contactEmail: "ap@northwind.example" },
    { id: "cl_cobalt", name: "Cobalt Fintech", contactName: "Elena Ruiz", contactEmail: "finance@cobaltfintech.example" },
  ];

  const subcontractors: Subcontractor[] = [
    { id: "sub_quang", name: "Quang Do", initials: "QD", role: "UX design", paypalEmail: "quang.do@contractor.example" },
    { id: "sub_linh", name: "Linh Pham", initials: "LP", role: "Backend", paypalEmail: "linh.pham@contractor.example" },
    { id: "sub_minh", name: "Minh Le", initials: "ML", role: "API developer", paypalEmail: "minh.le@contractor.example" },
  ];

  const project = (p: Omit<Project, "currency" | "status" | "flags" | "paymentTermDays">): Project => ({
    currency: "USD",
    status: "active",
    flags: [],
    paymentTermDays: opts.defaultTermDays,
    ...p,
  });

  const projects: Project[] = [
    project({ id: "pr_harbor", clientId: "cl_harbor", name: "Patient portal", totalCents: 4_200_000, createdAt: at(-30, 10) }),
    project({ id: "pr_lumen", clientId: "cl_lumen", name: "Inventory sync", totalCents: 4_080_000, createdAt: at(-60, 10) }),
    project({ id: "pr_northwind", clientId: "cl_northwind", name: "Driver app", totalCents: 2_700_000, createdAt: at(-40, 10) }),
    project({ id: "pr_cobalt", clientId: "cl_cobalt", name: "Compliance dashboard", totalCents: 2_400_000, createdAt: at(-15, 10) }),
  ];

  const milestone = (m: Partial<Milestone> & Pick<Milestone, "id" | "projectId" | "code" | "title" | "amountCents" | "startDate" | "endDate" | "status">): Milestone => ({
    gated: true,
    progress: 0,
    sourceRef: null,
    criteria: [],
    evidence: [],
    splits: [],
    delayDays: 0,
    ...m,
  });

  const harborEvidence: Evidence[] = [
    {
      id: "ev_h2_pr",
      kind: "pull_request",
      label: "PR #212 merged into main",
      url: "https://github.com/example/harbor-portal/pull/212",
      detail: "Adds claims, eligibility and appointment endpoints. 14 files changed. Approved by two reviewers.",
      criterionId: "ac_h2_1",
      addedAt: ago(140),
    },
    {
      id: "ev_h2_openapi",
      kind: "test_report",
      label: "OpenAPI diff · 14 of 14 endpoints",
      detail: "Contract test against API spec v1.3: 14 of 14 endpoints present, 0 unlisted public routes.",
      criterionId: "ac_h2_1",
      addedAt: ago(130),
    },
    {
      id: "ev_h2_load",
      kind: "test_report",
      label: `Load-test report · ${formatShortDate(d(-1))}`,
      detail: "k6 run, 10 minutes at 200 requests per second. p50 88 ms, p95 212 ms, p99 341 ms. Error rate 0.02%.",
      criterionId: "ac_h2_2",
      addedAt: ago(120),
    },
    {
      id: "ev_h2_ci",
      kind: "ci_run",
      label: "CI run #881 · 86% coverage",
      detail: "312 tests passed, 0 skipped, 0 failed. API layer line coverage 86%.",
      criterionId: "ac_h2_3",
      addedAt: ago(110),
    },
    {
      id: "ev_h2_email",
      kind: "email",
      label: `Approval email · ${formatShortDate(d(-1))}`,
      detail:
        "From Priya Nair: \"We walked through the staging demo with our team today. M2 (API integration) is approved from our side. Thanks!\"",
      criterionId: "ac_h2_4",
      addedAt: ago(100),
    },
  ];

  const milestones: Milestone[] = [
    // Harbor Health — M1 paid, M2 verified today, M3 waits on M2.
    milestone({
      id: "ms_h1",
      projectId: "pr_harbor",
      code: "M1",
      title: "Discovery and UX",
      amountCents: 1_000_000,
      startDate: d(-22),
      endDate: d(-9),
      status: "paid",
      progress: 100,
      paidAt: at(-6, 10, 20),
      splits: [{ subcontractorId: "sub_quang", percent: 25 }],
      criteria: [
        { id: "ac_h1_1", ref: "4.1.1", text: "Clickable prototype approved by Harbor Health", measurable: true },
        { id: "ac_h1_2", ref: "4.1.2", text: "Design system with components for all core screens", measurable: true },
      ],
    }),
    milestone({
      id: "ms_h2",
      projectId: "pr_harbor",
      code: "M2",
      title: "API integration",
      amountCents: 1_400_000,
      startDate: d(-8),
      endDate: d(0),
      status: "verified",
      progress: 100,
      sourceRef: "SOW §4.2",
      splits: [{ subcontractorId: "sub_minh", percent: 40 }],
      criteria: [
        { id: "ac_h2_1", ref: "4.2.1", text: "Claims, eligibility and appointment endpoints built to API spec v1.3", measurable: true },
        { id: "ac_h2_2", ref: "4.2.2", text: "p95 latency under 300 ms at 200 requests per second", measurable: true },
        { id: "ac_h2_3", ref: "4.2.3", text: "Automated test coverage of 80% or more on the API layer", measurable: true },
        { id: "ac_h2_4", ref: "4.2.4", text: "Client sign-off on the staging demo", measurable: true },
      ],
      evidence: harborEvidence,
      check: {
        checkedAt: ago(38),
        model: "mock",
        allMet: true,
        summary: "All 4 acceptance criteria are met. I checked the merged PR, the load-test report and the client's staging sign-off against the SOW.",
        note: "SOW §4.5 mentions audit logging for HIPAA. It's scoped to M3, so I didn't count it here. I'm flagging it so it doesn't get missed.",
        results: [
          { criterionId: "ac_h2_1", verdict: "met", reasoning: "Every endpoint in the spec is present, and no unlisted public routes were added.", evidenceIds: ["ev_h2_pr", "ev_h2_openapi"] },
          { criterionId: "ac_h2_2", verdict: "met", reasoning: "The load test ran 10 minutes at the agreed rate. p95 was 212 ms with a 0.02% error rate.", evidenceIds: ["ev_h2_load"] },
          { criterionId: "ac_h2_3", verdict: "met", reasoning: "Coverage is 86% across 312 passing tests. No tests were skipped in the latest run.", evidenceIds: ["ev_h2_ci"] },
          { criterionId: "ac_h2_4", verdict: "met", reasoning: "The client's approval email names this milestone explicitly, so it counts as sign-off.", evidenceIds: ["ev_h2_email"] },
        ],
      },
    }),
    milestone({
      id: "ms_h3",
      projectId: "pr_harbor",
      code: "M3",
      title: "Mobile app beta",
      amountCents: 1_800_000,
      startDate: d(1),
      endDate: d(29),
      status: "upcoming",
      gated: false,
      splits: [
        { subcontractorId: "sub_quang", percent: 20 },
        { subcontractorId: "sub_linh", percent: 30 },
      ],
      criteria: [
        { id: "ac_h3_1", ref: "4.3.1", text: "Beta build distributed to 50 test patients on iOS and Android", measurable: true },
        { id: "ac_h3_2", ref: "4.5", text: "HIPAA audit logging enabled for every record access", measurable: true },
      ],
    }),

    // Lumen Retail — M2 invoice is overdue, so M3 was pushed back a week.
    milestone({
      id: "ms_l1",
      projectId: "pr_lumen",
      code: "M1",
      title: "Inventory audit",
      amountCents: 1_300_000,
      startDate: d(-50),
      endDate: d(-31),
      status: "paid",
      progress: 100,
      paidAt: at(-28, 14, 5),
      splits: [{ subcontractorId: "sub_linh", percent: 30 }],
    }),
    milestone({
      id: "ms_l2",
      projectId: "pr_lumen",
      code: "M2",
      title: "Data migration",
      amountCents: 1_280_000,
      startDate: d(-22),
      endDate: d(-11),
      status: "invoiced",
      progress: 100,
      splits: [{ subcontractorId: "sub_linh", percent: 35 }],
      criteria: [
        { id: "ac_l2_1", ref: "5.2.1", text: "All 48,000 SKUs migrated with zero data loss", measurable: true },
        { id: "ac_l2_2", ref: "5.2.2", text: "Nightly reconciliation report shows matching counts", measurable: true },
      ],
    }),
    milestone({
      id: "ms_l3",
      projectId: "pr_lumen",
      code: "M3",
      title: "Storefront sync",
      amountCents: 1_500_000,
      startDate: d(7),
      endDate: d(27),
      status: "upcoming",
      gated: false,
      delayDays: 7,
    }),

    // Northwind Logistics — M1 paid yesterday, M2 started, payout waiting.
    milestone({
      id: "ms_n1",
      projectId: "pr_northwind",
      code: "M1",
      title: "Route engine",
      amountCents: 800_000,
      startDate: d(-22),
      endDate: d(-3),
      status: "paid",
      progress: 100,
      paidAt: at(-1, 16, 18),
      splits: [{ subcontractorId: "sub_linh", percent: 40 }],
    }),
    milestone({
      id: "ms_n2",
      projectId: "pr_northwind",
      code: "M2",
      title: "Driver app UI",
      amountCents: 1_250_000,
      startDate: d(-1),
      endDate: d(20),
      status: "in_progress",
      progress: 10,
      splits: [{ subcontractorId: "sub_linh", percent: 30 }],
      criteria: [
        { id: "ac_n2_1", ref: "3.2", text: "Drivers can see and accept the day's route on Android", measurable: true },
        { id: "ac_n2_2", ref: "3.3", text: "Offline mode keeps the last synced route for 24 hours", measurable: true },
      ],
    }),
    milestone({
      id: "ms_n3",
      projectId: "pr_northwind",
      code: "M3",
      title: "Launch and handoff",
      amountCents: 650_000,
      startDate: d(21),
      endDate: d(34),
      status: "upcoming",
      gated: false,
    }),

    // Cobalt Fintech — M1 invoiced (not gated), M2 already under way.
    milestone({
      id: "ms_c1",
      projectId: "pr_cobalt",
      code: "M1",
      title: "Compliance audit",
      amountCents: 800_000,
      startDate: d(-14),
      endDate: d(-2),
      status: "invoiced",
      progress: 100,
      gated: false,
    }),
    milestone({
      id: "ms_c2",
      projectId: "pr_cobalt",
      code: "M2",
      title: "Dashboard build",
      amountCents: 1_600_000,
      startDate: d(0),
      endDate: d(24),
      status: "in_progress",
      progress: 5,
      gated: false,
      splits: [{ subcontractorId: "sub_minh", percent: 30 }],
    }),
  ];

  const invoice = (i: Omit<Invoice, "termDays"> & { termDays?: number }): Invoice => ({
    termDays: opts.defaultTermDays,
    ...i,
  });

  const invoices: Invoice[] = [
    invoice({ id: "inv_1038", number: "MP-1038", projectId: "pr_lumen", milestoneId: "ms_l1", amountCents: 1_300_000, status: "paid", issueDate: d(-31), dueDate: d(-16), sentAt: at(-31, 9), paidAt: at(-28, 14, 5) }),
    invoice({ id: "inv_1041", number: "MP-1041", projectId: "pr_harbor", milestoneId: "ms_h1", amountCents: 1_000_000, status: "paid", issueDate: d(-18), dueDate: d(-3), sentAt: at(-18, 9), paidAt: at(-6, 10, 20) }),
    invoice({ id: "inv_1042", number: "MP-1042", projectId: "pr_lumen", milestoneId: "ms_l2", amountCents: 1_280_000, status: "sent", issueDate: d(-20), dueDate: d(-5), sentAt: at(-20, 9, 30) }),
    invoice({ id: "inv_1043", number: "MP-1043", projectId: "pr_northwind", milestoneId: "ms_n1", amountCents: 800_000, status: "paid", issueDate: d(-12), dueDate: d(3), sentAt: at(-12, 11), paidAt: at(-1, 16, 18) }),
    invoice({ id: "inv_1044", number: "MP-1044", projectId: "pr_cobalt", milestoneId: "ms_c1", amountCents: 800_000, status: "sent", issueDate: d(-1), dueDate: d(14), sentAt: at(-1, 11, 2) }),
  ];

  const payouts: Payout[] = [
    { id: "po_l1_linh", milestoneId: "ms_l1", subcontractorId: "sub_linh", amountCents: 390_000, status: "sent", createdAt: at(-28, 14, 5), sentAt: at(-28, 15) },
    { id: "po_h1_quang", milestoneId: "ms_h1", subcontractorId: "sub_quang", amountCents: 250_000, status: "sent", createdAt: at(-6, 10, 20), sentAt: at(-6, 11) },
    { id: "po_n1_linh", milestoneId: "ms_n1", subcontractorId: "sub_linh", amountCents: 320_000, status: "pending_approval", createdAt: at(-1, 16, 18) },
  ];

  const state: AppState = {
    schemaVersion: 1,
    seededAt: now.toISOString(),
    settings: { agencyName: opts.agencyName, defaultTermDays: opts.defaultTermDays },
    nextInvoiceNumber: 1045,
    clients,
    subcontractors,
    projects,
    milestones,
    invoices,
    payouts,
    reminders: [
      {
        id: "rem_1042",
        invoiceId: "inv_1042",
        status: "draft",
        createdAt: ago(135),
        subject: "Quick heads-up on invoice MP-1042",
        body:
          "Hi Dana, a quick heads-up that the data migration invoice ($12,800) came due on " +
          `${formatShortDate(d(-5))}. We're ready to start storefront sync the day it clears, and you can pay from the link in the original PayPal invoice.\n\nThanks,\n${opts.agencyName}`,
        scheduleNote: "Moved M3 Storefront sync back 1 week so the plan stays honest.",
      },
    ],
    activity: [],
  };

  // The draft waiting for review on "New project from SOW".
  const draft = draftFromExtraction(state, pinecrestExtraction(T), {
    fileName: PINECREST_SOW_FILENAME.replace(/\.md$/, ".pdf"),
    uploadedAt: ago(70),
    today: T,
    defaultTermDays: opts.defaultTermDays,
  });
  const splits: Record<string, Milestone["splits"]> = {
    M1: [{ subcontractorId: "sub_quang", percent: 25 }],
    M2: [{ subcontractorId: "sub_linh", percent: 35 }],
    M3: [{ subcontractorId: "sub_linh", percent: 35 }],
  };
  for (const m of state.milestones.filter((x) => x.projectId === draft.id)) {
    m.splits = splits[m.code] ?? [];
  }

  // Newest first.
  state.activity = [
    { id: "act_s1", at: ago(38), kind: "agent", text: "Matched Harbor Health M2 to 4 of 4 acceptance criteria", projectId: "pr_harbor", milestoneId: "ms_h2" },
    { id: "act_s2", at: ago(70), kind: "agent", text: `Read ${draft.source?.fileName} (11 pages) → 4 milestones, 2 items to check`, projectId: draft.id },
    { id: "act_s3", at: ago(135), kind: "agent", text: "Moved Lumen Retail M3 back 1 week while MP-1042 is unpaid, and drafted a reminder", projectId: "pr_lumen", milestoneId: "ms_l3" },
    { id: "act_s4", at: at(-1, 16, 18), kind: "paypal", text: "MP-1043 paid (PayPal webhook) → unlocked Northwind M2 and queued Linh Pham's payout", projectId: "pr_northwind", milestoneId: "ms_n1" },
    { id: "act_s5", at: at(-1, 11, 2), kind: "paypal", text: "Sent MP-1044 to Cobalt Fintech through PayPal Invoicing", projectId: "pr_cobalt", milestoneId: "ms_c1" },
    { id: "act_s6", at: at(-6, 11), kind: "paypal", text: "Paid Quang Do $2,500 through PayPal Payouts", projectId: "pr_harbor", milestoneId: "ms_h1" },
  ];

  return state;
}
