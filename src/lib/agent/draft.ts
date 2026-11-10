import type { SowExtraction } from "@/lib/ai/schemas";
import { addDays, maxDate } from "@/lib/domain/dates";
import { newId } from "@/lib/domain/ids";
import { dollarsToCents, formatMoney } from "@/lib/domain/money";
import type { AgentFlag, AppState, ISODate, ISODateTime, Milestone, Project } from "@/lib/domain/types";

export interface DraftMeta {
  fileName: string;
  uploadedAt: ISODateTime;
  today: ISODate;
  defaultTermDays: number;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
}

/**
 * Turns what the SOW reader extracted into a draft project: client,
 * milestones with acceptance criteria, and the flags the user reviews
 * before anything is created in PayPal.
 */
export function draftFromExtraction(state: AppState, x: SowExtraction, meta: DraftMeta): Project {
  // Reuse the client when we already know them.
  let client = state.clients.find((c) => c.name.toLowerCase() === x.clientName.toLowerCase());
  if (!client) {
    client = {
      id: newId(`cl_${slug(x.clientName)}`),
      name: x.clientName,
      contactName: x.contactName ?? "Accounts payable",
      contactEmail: x.contactEmail ?? "",
    };
    state.clients.push(client);
  }

  const milestonesTotal = x.milestones.reduce((sum, m) => sum + dollarsToCents(m.amount), 0);
  const project: Project = {
    id: newId("pr"),
    clientId: client.id,
    name: x.projectName,
    currency: "USD",
    totalCents: x.totalFee != null ? dollarsToCents(x.totalFee) : milestonesTotal,
    status: "draft",
    createdAt: meta.uploadedAt,
    paymentTermDays: x.paymentTermDays ?? meta.defaultTermDays,
    source: {
      fileName: meta.fileName,
      pages: x.pageCount,
      uploadedAt: meta.uploadedAt,
      sections: x.sections,
    },
    flags: [],
  };

  // Milestones without dates are laid end to end, three weeks each.
  let cursor = addDays(meta.today, 7);
  const milestones: Milestone[] = x.milestones.map((m, i) => {
    const start = m.startDate ?? cursor;
    const end = m.endDate && m.endDate >= start ? m.endDate : addDays(start, 18);
    cursor = maxDate(cursor, addDays(end, 3));
    return {
      id: newId("ms"),
      projectId: project.id,
      code: `M${i + 1}`,
      title: m.title,
      amountCents: dollarsToCents(m.amount),
      startDate: start,
      endDate: end,
      status: "upcoming",
      gated: i < x.milestones.length - 1,
      progress: 0,
      sourceRef: m.sourceRef,
      criteria: m.criteria.map((c) => ({
        id: newId("ac"),
        ref: c.ref,
        text: c.text,
        measurable: c.measurable,
      })),
      evidence: [],
      splits: [],
      delayDays: 0,
    };
  });

  const flags: AgentFlag[] = [];

  x.milestones.forEach((m, i) => {
    m.criteria.forEach((c, j) => {
      if (c.measurable) return;
      const ms = milestones[i];
      const crit = ms.criteria[j];
      const where = c.ref ? `§${c.ref} asks for` : "The SOW asks for";
      flags.push({
        id: newId("fl"),
        kind: "unmeasurable",
        severity: "warning",
        title: `${c.topic} isn't measurable as written`,
        detail: `${where} “${c.text}.” I can't check that when ${ms.code} is marked done${
          c.suggestion ? ", so I suggest a number." : "."
        }`,
        suggestion: c.suggestion ? { milestoneId: ms.id, criterionId: crit.id, text: c.suggestion } : undefined,
        resolved: false,
      });
    });
  });

  if (x.paymentTermDays == null) {
    flags.push({
      id: newId("fl"),
      kind: "payment_terms",
      severity: "info",
      title: "Payment terms aren't stated",
      detail: `The SOW doesn't say when invoices are due, so every invoice uses your default, Net ${meta.defaultTermDays}.`,
      resolved: false,
    });
  }

  if (x.totalFee != null) {
    const stated = dollarsToCents(x.totalFee);
    const where = x.totalFeeRef ?? "the SOW";
    if (stated === milestonesTotal) {
      flags.push({
        id: newId("fl"),
        kind: "totals",
        severity: "ok",
        title: "Milestones add up to the total fee",
        detail: `${milestones.length} milestones total ${formatMoney(milestonesTotal)}, which matches ${where}.`,
        resolved: true,
      });
    } else {
      flags.push({
        id: newId("fl"),
        kind: "totals",
        severity: "warning",
        title: "Milestones don't add up to the total fee",
        detail: `The milestones total ${formatMoney(milestonesTotal)}, but ${where} says ${formatMoney(stated)}.`,
        resolved: false,
      });
    }
  }

  for (const note of x.notes) {
    flags.push({
      id: newId("fl"),
      kind: "note",
      severity: "ok",
      title: note.title,
      detail: note.detail,
      resolved: true,
    });
  }

  project.flags = flags;
  state.projects.push(project);
  state.milestones.push(...milestones);
  return project;
}

/** Flags that still need a decision from the user. */
export function openFlags(project: Project): AgentFlag[] {
  return project.flags.filter((f) => !f.resolved && f.severity !== "ok");
}
