import type { ReactNode } from "react";
import type { DisplayStatus } from "@/lib/domain/rules";
import type { InvoiceStatus, PayoutStatus } from "@/lib/domain/types";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "accent" | "ok" | "secondary" | "ghost";

const buttonBase =
  "inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg font-medium text-sm transition-colors disabled:cursor-wait disabled:opacity-60 no-underline";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-ink-hover",
  accent: "bg-accent text-white hover:bg-accent-hover",
  ok: "bg-ok text-white hover:bg-ok-hover",
  secondary: "border border-line-strong bg-white text-ink hover:bg-canvas",
  ghost: "text-ink-2 hover:bg-chip",
};

export function buttonClass(variant: ButtonVariant = "secondary", extra?: string): string {
  return cx(buttonBase, buttonVariants[variant], extra);
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("relative rounded-xl border border-line bg-white", className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  id,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  id?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-4">
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {subtitle ? <p className="text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export type Tone = "accent" | "warn" | "ok" | "info" | "neutral";

const toneClass: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent",
  warn: "bg-warn-soft text-warn",
  ok: "bg-ok-soft text-ok",
  info: "bg-info-soft text-info",
  neutral: "bg-chip text-ink-2",
};

export function Badge({ tone = "neutral", children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        toneClass[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export const milestoneStatusLabel: Record<DisplayStatus, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "ok" },
  invoiced: { label: "Invoiced", tone: "info" },
  overdue: { label: "Overdue", tone: "warn" },
  verified: { label: "Verified · ready to invoice", tone: "accent" },
  submitted: { label: "Checking evidence", tone: "info" },
  changes_requested: { label: "Changes requested", tone: "warn" },
  in_progress: { label: "In progress", tone: "neutral" },
  locked: { label: "Waiting on payment", tone: "neutral" },
  blocked: { label: "Blocked by payment", tone: "warn" },
  upcoming: { label: "Upcoming", tone: "neutral" },
};

export function MilestoneBadge({ status, overdueDays }: { status: DisplayStatus; overdueDays?: number }) {
  const { label, tone } = milestoneStatusLabel[status];
  return <Badge tone={tone}>{status === "overdue" && overdueDays ? `Overdue ${overdueDays} days` : label}</Badge>;
}

export const invoiceStatusTone: Record<InvoiceStatus, Tone> = {
  draft: "neutral",
  sent: "info",
  paid: "ok",
  cancelled: "neutral",
};

export const payoutStatusLabel: Record<PayoutStatus, { label: string; tone: Tone }> = {
  pending_approval: { label: "Needs approval", tone: "accent" },
  processing: { label: "Processing", tone: "info" },
  sent: { label: "Sent", tone: "ok" },
  failed: { label: "Failed", tone: "warn" },
};

export function Avatar({ initials, tone = "neutral" }: { initials: string; tone?: "neutral" | "ok" }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        tone === "ok" ? "bg-ok-soft text-ok" : "bg-chip text-ink-2",
      )}
    >
      {initials}
    </span>
  );
}

export function Chip({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-xs text-ink-2">
      {icon}
      {children}
    </span>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("font-mono", className)}>{children}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-[13px] text-muted">{children}</p>;
}
