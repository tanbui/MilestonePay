/**
 * Core domain model for Milestone Pay.
 *
 * Money is stored in integer cents. Business dates (milestone start/end,
 * invoice due dates) are plain calendar dates as `YYYY-MM-DD` strings.
 * Timestamps (activity, payments) are ISO-8601 instants.
 */

export type Cents = number;
/** Calendar date, `YYYY-MM-DD`. */
export type ISODate = string;
/** Instant, e.g. `2026-11-09T17:42:00.000Z`. */
export type ISODateTime = string;

export interface Client {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
}

export interface Subcontractor {
  id: string;
  name: string;
  initials: string;
  role: string;
  paypalEmail: string;
}

export type ProjectStatus = "draft" | "active" | "complete";

export interface SourceDocument {
  fileName: string;
  pages: number | null;
  uploadedAt: ISODateTime;
  /** Where each detail was found, e.g. { label: "Total fee", ref: "p. 2" }. */
  sections: { label: string; ref: string }[];
}

export type FlagSeverity = "warning" | "info" | "ok";
export type FlagKind = "unmeasurable" | "payment_terms" | "totals" | "note";

export interface AgentFlag {
  id: string;
  kind: FlagKind;
  severity: FlagSeverity;
  title: string;
  detail: string;
  /** For unmeasurable criteria: a measurable replacement the user can accept. */
  suggestion?: { milestoneId: string; criterionId: string; text: string };
  resolved: boolean;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  currency: "USD";
  totalCents: Cents;
  status: ProjectStatus;
  createdAt: ISODateTime;
  paymentTermDays: number;
  source?: SourceDocument;
  /** Items the agent flagged while reading the SOW (draft review). */
  flags: AgentFlag[];
}

export type MilestoneStatus =
  | "upcoming"
  | "in_progress"
  | "submitted"
  | "changes_requested"
  | "verified"
  | "invoiced"
  | "paid";

export interface AcceptanceCriterion {
  id: string;
  /** Short code from the SOW, e.g. "4.2.1". */
  ref: string | null;
  text: string;
  measurable: boolean;
  /** Kept when the user accepts an agent suggestion, so it can be undone. */
  originalText?: string;
}

export type EvidenceKind =
  | "pull_request"
  | "ci_run"
  | "test_report"
  | "email"
  | "demo"
  | "link"
  | "note";

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  label: string;
  url?: string;
  /** What the evidence says, e.g. pasted report text or the sign-off email. */
  detail: string;
  /** Optional hint from the team about which criterion this supports. */
  criterionId?: string;
  addedAt: ISODateTime;
}

export type CriterionVerdict = "met" | "not_met" | "unclear";

export interface CriterionResult {
  criterionId: string;
  verdict: CriterionVerdict;
  reasoning: string;
  evidenceIds: string[];
}

export interface AcceptanceCheck {
  checkedAt: ISODateTime;
  /** "mock" or the Claude model id that ran the check. */
  model: string;
  results: CriterionResult[];
  summary: string;
  /** Something worth knowing that did not affect the verdict. */
  note: string | null;
  allMet: boolean;
}

export interface PayoutSplit {
  subcontractorId: string;
  /** Share of the milestone amount, 0–100. */
  percent: number;
}

export interface Milestone {
  id: string;
  projectId: string;
  /** Display code, e.g. "M2". Also defines order within the project. */
  code: string;
  title: string;
  amountCents: Cents;
  startDate: ISODate;
  endDate: ISODate;
  status: MilestoneStatus;
  /** When true, the next milestone waits until this one is paid. */
  gated: boolean;
  /** Visual progress for in-progress work, 0–100. */
  progress: number;
  sourceRef: string | null;
  criteria: AcceptanceCriterion[];
  evidence: Evidence[];
  check?: AcceptanceCheck;
  splits: PayoutSplit[];
  /** Days this milestone has been pushed back because an earlier one is unpaid. */
  delayDays: number;
  paidAt?: ISODateTime;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

export interface Invoice {
  id: string;
  /** Our human-readable number, e.g. "MP-1042". */
  number: string;
  projectId: string;
  milestoneId: string;
  amountCents: Cents;
  status: InvoiceStatus;
  termDays: number;
  issueDate?: ISODate;
  dueDate?: ISODate;
  sentAt?: ISODateTime;
  paidAt?: ISODateTime;
  /** PayPal Invoicing id, e.g. "INV2-XXXX-XXXX-XXXX-XXXX". */
  paypalInvoiceId?: string;
  /** Link the client uses to pay. */
  payerUrl?: string;
}

export type PayoutStatus = "pending_approval" | "processing" | "sent" | "failed";

export interface Payout {
  id: string;
  milestoneId: string;
  subcontractorId: string;
  amountCents: Cents;
  status: PayoutStatus;
  createdAt: ISODateTime;
  sentAt?: ISODateTime;
  paypalBatchId?: string;
  error?: string;
}

export type ReminderStatus = "draft" | "sent" | "dismissed";

export interface ReminderDraft {
  id: string;
  invoiceId: string;
  subject: string;
  body: string;
  status: ReminderStatus;
  createdAt: ISODateTime;
  sentAt?: ISODateTime;
  /** Summary of the schedule change that came with the reminder. */
  scheduleNote?: string;
}

export type ActivityKind = "agent" | "paypal" | "user";

export interface ActivityEvent {
  id: string;
  at: ISODateTime;
  kind: ActivityKind;
  text: string;
  projectId?: string;
  milestoneId?: string;
}

export interface AppSettings {
  agencyName: string;
  defaultTermDays: number;
}

export interface AppState {
  schemaVersion: 1;
  seededAt: ISODateTime;
  settings: AppSettings;
  nextInvoiceNumber: number;
  clients: Client[];
  subcontractors: Subcontractor[];
  projects: Project[];
  milestones: Milestone[];
  invoices: Invoice[];
  payouts: Payout[];
  reminders: ReminderDraft[];
  activity: ActivityEvent[];
}
