import * as z from "zod";

/**
 * Structured-output schemas for Claude. Optional values are modeled as
 * `nullable` so every property is always present in the JSON.
 */

export const SowCriterionSchema = z.object({
  ref: z.string().nullable().describe("Section number in the SOW, e.g. '6.2' or '7.2'"),
  text: z.string().describe("The acceptance criterion, close to the SOW's wording"),
  topic: z.string().describe("Two to four words naming what the criterion is about, e.g. 'API performance'"),
  measurable: z
    .boolean()
    .describe("True when someone could objectively verify it from evidence (a number, a yes/no outcome, a named approval)"),
  suggestion: z
    .string()
    .nullable()
    .describe("When not measurable: a concrete, measurable rewrite. Otherwise null."),
});

export const SowMilestoneSchema = z.object({
  title: z.string(),
  amount: z.number().describe("Milestone fee in the SOW currency, as a plain number"),
  startDate: z.string().nullable().describe("YYYY-MM-DD"),
  endDate: z.string().nullable().describe("YYYY-MM-DD"),
  sourceRef: z.string().nullable().describe("Where the milestone is defined, e.g. 'p. 6 §5.1'"),
  criteria: z.array(SowCriterionSchema),
});

export const SowExtractionSchema = z.object({
  clientName: z.string(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  projectName: z.string(),
  currency: z.string().describe("ISO currency code, e.g. USD"),
  totalFee: z.number().nullable().describe("Total fee stated in the SOW"),
  totalFeeRef: z.string().nullable().describe("Where the total fee is stated, e.g. 'p. 2'"),
  paymentTermDays: z
    .number()
    .nullable()
    .describe("Days the client has to pay an invoice (Net 30 = 30). Null when the SOW does not say."),
  pageCount: z.number().nullable(),
  milestones: z.array(SowMilestoneSchema),
  notes: z
    .array(z.object({ title: z.string(), detail: z.string() }))
    .describe("Other things the agency should know: costs billed separately, items left out of milestones, risks"),
  sections: z
    .array(z.object({ label: z.string(), ref: z.string() }))
    .describe("Where each kind of detail was found, e.g. { label: 'Total fee', ref: 'p. 2' }"),
});

export type SowExtraction = z.infer<typeof SowExtractionSchema>;

export const AcceptanceSchema = z.object({
  results: z.array(
    z.object({
      criterionId: z.string(),
      verdict: z.enum(["met", "not_met", "unclear"]),
      reasoning: z.string().describe("One or two sentences citing the evidence"),
      evidenceIds: z.array(z.string()),
    }),
  ),
  summary: z.string().describe("One sentence for the approver"),
  note: z
    .string()
    .nullable()
    .describe("Something worth knowing that did not change the verdict, or null"),
});

export type AcceptanceOutput = z.infer<typeof AcceptanceSchema>;

export const ReminderSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type ReminderOutput = z.infer<typeof ReminderSchema>;
