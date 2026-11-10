import { addDays, startOfWeek } from "@/lib/domain/dates";
import type { ISODate } from "@/lib/domain/types";
import type { SowExtraction } from "@/lib/ai/schemas";

/**
 * A sample statement of work for testing the SOW reader. It deliberately
 * leaves out payment terms and contains one criterion that isn't measurable,
 * so the agent has something to flag. A copy lives in `samples/`.
 */
export const PINECREST_SOW_FILENAME = "Pinecrest_SOW_v2.md";

export const PINECREST_SOW_TEXT = `--- Page 1 ---
STATEMENT OF WORK
Member Onboarding App

Client: Pinecrest Credit Union ("Pinecrest")
Vendor: Lotus Dev Studio ("Vendor")
Client contact: Jordan Lee, Digital Channels Lead (vendors@pinecrestcu.example)
Version 2

--- Page 2 ---
1. Purpose
Pinecrest wants new members to open an account from their phone in under ten minutes,
without visiting a branch.

2. Fees
2.1 The total fixed fee for this engagement is $50,000 (USD).
2.2 Fees are billed by milestone as set out in Section 5.

--- Page 3 ---
3. Scope
3.1 Native-feel mobile app for iOS and Android built with React Native.
3.2 Account opening flow: personal details, identity verification, funding the first deposit.
3.3 Integration with Pinecrest's core banking system for real-time account creation.
3.4 Admin console for the member services team to review flagged applications.

--- Page 4 ---
3.5 Out of scope: online banking features beyond account opening, card issuing, marketing website.

--- Page 5 ---
4. Team and responsibilities
4.1 Vendor provides a project lead, a UX designer, two engineers and a QA engineer.
4.2 Pinecrest provides a product owner who attends a weekly review and answers questions within two business days.
4.3 Pinecrest provides sandbox access to its core banking system by the start of Week 9.

--- Page 6 ---
5. Payment schedule
The project starts on the Monday after signature (Week 1).
5.1 M1 — Discovery and UX design. Weeks 1–3. Fee: $9,000.
5.2 M2 — Onboarding flow and ID verification. Weeks 4–8. Fee: $16,000.
5.3 M3 — Core banking integration. Weeks 9–13. Fee: $18,000.
5.4 M4 — Launch and 30-day support. Weeks 14–18. Fee: $7,000.

--- Page 7 ---
6. Acceptance criteria
6.1 M1 is accepted when (a) Pinecrest approves a clickable prototype of the full onboarding
flow, and (b) an accessibility review against WCAG 2.1 AA shows no open blockers.
6.2 M2 is accepted when (a) a new member can open an account end to end on iOS and Android
in the staging environment, and (b) the ID verification vendor is integrated, with a fallback
to manual review when automatic verification fails.

--- Page 8 ---
6.3 M3 is accepted when (a) member accounts sync with the core banking system in real time,
and (b) the API meets the performance requirement in Section 7.2.
6.4 M4 is accepted when (a) the app is approved and live in both app stores, and (b) 30 days
pass after launch with no open severity-1 issues.

7. Performance and security
7.1 Member data is encrypted in transit and at rest.
7.2 The API shall provide reasonable performance under normal load.

--- Page 9 ---
8. Expenses
8.1 Travel and third-party fees, including ID verification vendor fees, are billed at cost
and are separate from the milestone fees in Section 5.

--- Page 10 ---
9. Change requests
9.1 Changes to scope are agreed in writing and may change fees and dates.

10. Term
10.1 This SOW ends when M4 is accepted, unless ended earlier under the master services agreement.

--- Page 11 ---
Signatures
Pinecrest Credit Union: ______________________   Date: __________
Lotus Dev Studio: ___________________________   Date: __________
`;

/** Monday the sample project starts: the Monday of next week. */
export function sampleProjectStart(today: ISODate): ISODate {
  return startOfWeek(addDays(today, 7));
}

function week(start: ISODate, n: number): { first: ISODate; last: ISODate } {
  const first = addDays(start, (n - 1) * 7);
  return { first, last: addDays(first, 4) };
}

/**
 * What the SOW reader returns for the sample SOW. The mock AI returns this
 * for any upload, and the seed data uses it for the draft project.
 */
export function pinecrestExtraction(today: ISODate): SowExtraction {
  const s = sampleProjectStart(today);
  return {
    clientName: "Pinecrest Credit Union",
    contactName: "Jordan Lee",
    contactEmail: "vendors@pinecrestcu.example",
    projectName: "Member onboarding app",
    currency: "USD",
    totalFee: 50000,
    totalFeeRef: "p. 2",
    paymentTermDays: null,
    pageCount: 11,
    milestones: [
      {
        title: "Discovery and UX design",
        amount: 9000,
        startDate: week(s, 1).first,
        endDate: week(s, 3).last,
        sourceRef: "p. 6 §5.1",
        criteria: [
          {
            ref: "6.1",
            text: "Clickable prototype of the onboarding flow, approved by Pinecrest",
            topic: "Prototype approval",
            measurable: true,
            suggestion: null,
          },
          {
            ref: "6.1",
            text: "Accessibility review against WCAG 2.1 AA, with no open blockers",
            topic: "Accessibility review",
            measurable: true,
            suggestion: null,
          },
        ],
      },
      {
        title: "Onboarding flow and ID verification",
        amount: 16000,
        startDate: week(s, 4).first,
        endDate: week(s, 8).last,
        sourceRef: "p. 6 §5.2",
        criteria: [
          {
            ref: "6.2",
            text: "A new member can open an account end to end on iOS and Android in staging",
            topic: "End-to-end onboarding",
            measurable: true,
            suggestion: null,
          },
          {
            ref: "6.2",
            text: "ID verification vendor integrated, with a fallback to manual review",
            topic: "ID verification",
            measurable: true,
            suggestion: null,
          },
        ],
      },
      {
        title: "Core banking integration",
        amount: 18000,
        startDate: week(s, 9).first,
        endDate: week(s, 13).last,
        sourceRef: "p. 6 §5.3",
        criteria: [
          {
            ref: "6.3",
            text: "Member accounts sync with the core banking system in real time",
            topic: "Core banking sync",
            measurable: true,
            suggestion: null,
          },
          {
            ref: "7.2",
            text: "Reasonable API performance under normal load",
            topic: "API performance",
            measurable: false,
            suggestion: "p95 latency under 300 ms at 100 requests per second",
          },
        ],
      },
      {
        title: "Launch and 30-day support",
        amount: 7000,
        startDate: week(s, 14).first,
        endDate: addDays(week(s, 18).last, 4),
        sourceRef: "p. 6 §5.4",
        criteria: [
          {
            ref: "6.4",
            text: "App approved and live in both app stores",
            topic: "App store launch",
            measurable: true,
            suggestion: null,
          },
          {
            ref: "6.4",
            text: "30 days after launch with no open severity-1 issues",
            topic: "Post-launch stability",
            measurable: true,
            suggestion: null,
          },
        ],
      },
    ],
    notes: [
      {
        title: "Expenses are billed separately",
        detail: "Travel and third-party fees in §8 are billed at cost, so I didn't make them a milestone.",
      },
    ],
    sections: [
      { label: "Total fee", ref: "p. 2" },
      { label: "Milestones and dates", ref: "p. 6 §5" },
      { label: "Acceptance criteria", ref: "p. 7–8 §6" },
      { label: "Performance terms", ref: "p. 8 §7.2" },
      { label: "Expenses", ref: "p. 9 §8" },
    ],
  };
}
