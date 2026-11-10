import type { ComponentType } from "react";
import { IconFile, IconGauge, IconLink, IconMail, IconMonitor, IconPullRequest, IconCheck } from "@/components/ui/icons";
import { Chip } from "@/components/ui/primitives";
import type { Evidence, EvidenceKind } from "@/lib/domain/types";

export const evidenceIcon: Record<EvidenceKind, ComponentType<{ size?: number }>> = {
  pull_request: IconPullRequest,
  ci_run: IconCheck,
  test_report: IconGauge,
  email: IconMail,
  demo: IconMonitor,
  link: IconLink,
  note: IconFile,
};

export function EvidenceChips({ evidence, max = 3 }: { evidence: Evidence[]; max?: number }) {
  if (!evidence.length) return null;
  const shown = evidence.slice(0, max);
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((e) => {
        const Icon = evidenceIcon[e.kind];
        return (
          <Chip key={e.id} icon={<Icon size={13} />}>
            {e.label}
          </Chip>
        );
      })}
      {evidence.length > max ? <Chip>+{evidence.length - max} more</Chip> : null}
    </div>
  );
}
