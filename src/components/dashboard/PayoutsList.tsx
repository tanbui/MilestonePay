import Link from "next/link";
import { Avatar, Card, CardHeader, EmptyState, payoutStatusLabel } from "@/components/ui/primitives";
import { dateOf, formatShortDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import type { PayoutRow } from "@/lib/domain/rules";

export function PayoutsList({ rows, timeZone, limit }: { rows: PayoutRow[]; timeZone: string; limit?: number }) {
  const shown = rows.slice(0, limit);
  return (
    <Card>
      <CardHeader
        id="pay-h"
        title="Subcontractor payouts"
        subtitle="Sent with PayPal Payouts once the client's payment clears"
        action={
          limit && rows.length > limit ? (
            <Link href="/payouts" className="inline-flex min-h-11 items-center text-[13px] font-medium">
              View all
            </Link>
          ) : undefined
        }
      />
      {shown.length === 0 ? (
        <EmptyState>No subcontractor shares yet.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3 px-5 py-4">
          {shown.map((row, i) => {
            const m = row.view.milestone;
            const where = `${row.view.client.name.split(" ")[0]} ${m.code} · ${row.subcontractor.role}`;
            let amount: number;
            let status: React.ReactNode;
            if (row.kind === "waiting") {
              amount = row.amountCents;
              status = <span className="text-[11px] font-medium text-muted">Waits on client</span>;
            } else {
              amount = row.payout.amountCents;
              const s = payoutStatusLabel[row.payout.status];
              const color = s.tone === "ok" ? "text-ok" : s.tone === "warn" ? "text-warn" : s.tone === "accent" ? "text-accent" : "text-info";
              const when = row.payout.status === "sent" && row.payout.sentAt ? ` ${formatShortDate(dateOf(row.payout.sentAt, timeZone))}` : "";
              status = <span className={`text-[11px] font-semibold ${color}`}>{s.label}{when}</span>;
            }
            return (
              <li key={row.kind === "payout" ? row.payout.id : `w-${m.id}-${row.subcontractor.id}-${i}`} className="flex items-center gap-3">
                <Avatar initials={row.subcontractor.initials} tone={row.kind === "payout" && row.payout.status === "pending_approval" ? "ok" : "neutral"} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13px] font-medium">{row.subcontractor.name}</span>
                  <Link href={`/milestones/${m.id}`} className="truncate text-xs text-muted no-underline hover:underline">
                    {where}
                  </Link>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-[13px]">{formatMoney(amount)}</span>
                  {status}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
