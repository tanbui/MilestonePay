import type { ISODate, Milestone } from "@/lib/domain/types";
import type { AcceptanceOutput, ReminderOutput, SowExtraction } from "./schemas";

export interface SowInput {
  fileName: string;
  /** PDFs go to Claude as documents; anything else is sent as text. */
  mediaType: "application/pdf" | "text/plain";
  /** Base64 for PDFs, plain text otherwise. */
  data: string;
  /** Calendar date of "Week 1" if the SOW only gives week numbers. */
  projectStart: ISODate;
  today: ISODate;
  agencyName: string;
}

export interface AcceptanceInput {
  milestone: Milestone;
  projectName: string;
  clientName: string;
}

export interface ReminderInput {
  agencyName: string;
  clientName: string;
  contactName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  daysOverdue: number;
  milestoneTitle: string;
  /** e.g. "M3 Storefront sync" — the phase waiting on this payment. */
  nextPhase?: string;
  scheduleNote?: string;
  /** Earlier reminders for this invoice, so the tone can escalate gently. */
  previousReminders: number;
}

export interface AiGateway {
  readonly mode: "mock" | "claude";
  readonly model: string;
  extractSow(input: SowInput): Promise<SowExtraction>;
  checkAcceptance(input: AcceptanceInput): Promise<AcceptanceOutput>;
  draftReminder(input: ReminderInput): Promise<ReminderOutput>;
}
