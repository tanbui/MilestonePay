import type { Kpis } from "@/lib/domain/rules";
import { formatMoney } from "@/lib/domain/money";

function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "warn" | "accent" | "ok" }) {
  const noteClass = tone === "warn" ? "font-medium text-warn" : tone === "accent" ? "font-medium text-accent" : tone === "ok" ? "font-medium text-ok" : "text-muted";
  return (
    <div className="flex flex-[1_1_220px] flex-col gap-1 rounded-xl border border-line bg-white px-5 py-4">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="font-mono text-[26px] font-medium tracking-tight">{value}</span>
      <span className={`text-[13px] ${noteClass}`}>{note}</span>
    </div>
  );
}

export function KpiRow({ k }: { k: Kpis }) {
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return (
    <section aria-label="Key numbers" className="flex flex-wrap gap-4">
      <Tile
        label="Awaiting payment"
        value={formatMoney(k.awaitingCents)}
        note={
          k.overdueCents
            ? `${formatMoney(k.overdueCents)} overdue${k.blockedPhases ? ` · blocking ${plural(k.blockedPhases, "phase")}` : ""}`
            : plural(k.awaitingCount, "open invoice")
        }
        tone={k.overdueCents ? "warn" : undefined}
      />
      <Tile
        label="Ready to invoice"
        value={formatMoney(k.readyCents)}
        note={k.readyCount ? `${plural(k.readyCount, "milestone")} verified by the agent` : "Nothing verified yet"}
        tone={k.readyCount ? "accent" : undefined}
      />
      <Tile
        label="Collected, last 30 days"
        value={formatMoney(k.collectedCents)}
        note={k.collectedCount ? `${plural(k.collectedCount, "payment")} · ${k.collectedClients.join(", ")}` : "No payments yet"}
      />
      <Tile
        label="Subcontractor payouts queued"
        value={formatMoney(k.payoutsQueuedCents)}
        note={k.payoutsNeedApproval ? `${k.payoutsNeedApproval} need${k.payoutsNeedApproval === 1 ? "s" : ""} your approval` : "All caught up"}
        tone={k.payoutsNeedApproval ? "accent" : undefined}
      />
    </section>
  );
}
