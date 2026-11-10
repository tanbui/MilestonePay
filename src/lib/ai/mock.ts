import { pinecrestExtraction } from "@/data/samples";
import type { AcceptanceOutput } from "./schemas";
import type { AiGateway } from "./types";

const STOP = new Set(["with", "from", "that", "this", "under", "than", "more", "have", "into", "each", "every", "both", "when", "after"]);

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9%]+/)
      .filter((w) => w.length >= 4 && !STOP.has(w)),
  );
}

/**
 * Deterministic stand-in for Claude, used when ANTHROPIC_API_KEY is not set.
 * The SOW reader always returns the sample Pinecrest SOW; the acceptance
 * check matches evidence to criteria by tag or shared keywords.
 */
export function createMockAi(): AiGateway {
  return {
    mode: "mock",
    model: "mock",

    async extractSow(input) {
      return pinecrestExtraction(input.today);
    },

    async checkAcceptance({ milestone }): Promise<AcceptanceOutput> {
      const results = milestone.criteria.map((c) => {
        const tagged = milestone.evidence.filter((e) => e.criterionId === c.id);
        const words = keywords(c.text);
        const matched = tagged.length
          ? tagged
          : milestone.evidence.filter((e) => {
              const ev = keywords(`${e.label} ${e.detail}`);
              let shared = 0;
              for (const w of words) if (ev.has(w)) shared += 1;
              return shared >= 2;
            });
        if (!matched.length) {
          return {
            criterionId: c.id,
            verdict: "unclear" as const,
            reasoning: "No submitted evidence speaks to this criterion yet.",
            evidenceIds: [],
          };
        }
        return {
          criterionId: c.id,
          verdict: "met" as const,
          reasoning: `Supported by ${matched.map((e) => e.label).join(" and ")}.`,
          evidenceIds: matched.map((e) => e.id),
        };
      });
      const met = results.filter((r) => r.verdict === "met").length;
      return {
        results,
        summary:
          met === results.length
            ? `All ${results.length} acceptance criteria are met by the submitted evidence.`
            : `${met} of ${results.length} acceptance criteria are met. The rest need more evidence.`,
        note: null,
      };
    },

    async draftReminder(input) {
      const waiting = input.nextPhase
        ? ` We're ready to start ${input.nextPhase} the day it clears.`
        : "";
      const opener =
        input.previousReminders > 0
          ? `Hi ${input.contactName.split(" ")[0]}, following up on invoice ${input.invoiceNumber} (${input.amount}), which was due on ${input.dueDate}.`
          : `Hi ${input.contactName.split(" ")[0]}, a quick heads-up that the ${input.milestoneTitle.toLowerCase()} invoice (${input.amount}) came due on ${input.dueDate}.`;
      return {
        subject: `${input.previousReminders > 0 ? "Following up on" : "Quick heads-up on"} invoice ${input.invoiceNumber}`,
        body: `${opener}${waiting} You can pay from the link in the original PayPal invoice.\n\nThanks,\n${input.agencyName}`,
      };
    },
  };
}
