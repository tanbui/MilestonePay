import Link from "next/link";
import type { ComponentType } from "react";
import {
  IconActivity,
  IconGrid,
  IconInvoice,
  IconPayout,
  IconProjects,
  IconSettings,
} from "@/components/ui/icons";
import { cx } from "@/components/ui/primitives";

export interface NavCounts {
  overdue?: number;
  approvals?: number;
  drafts?: number;
}

const items: { href: string; label: string; icon: ComponentType<{ size?: number }>; count?: keyof NavCounts; tone?: "warn" | "light" }[] = [
  { href: "/", label: "Overview", icon: IconGrid, count: "approvals", tone: "light" },
  { href: "/projects", label: "Projects", icon: IconProjects, count: "drafts", tone: "light" },
  { href: "/invoices", label: "Invoices", icon: IconInvoice, count: "overdue", tone: "warn" },
  { href: "/payouts", label: "Payouts", icon: IconPayout },
  { href: "/activity", label: "Agent activity", icon: IconActivity },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

/** The sidebar links. Pure, so it can render in a Suspense fallback; pass `pathname` to mark the active link. */
export function NavList({ counts = {}, pathname = "" }: { counts?: NavCounts; pathname?: string }) {
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-1">
      {items.map(({ href, label, icon: Icon, count, tone }) => {
        const active = pathname !== "" && (href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/projects" && pathname.startsWith("/milestones")));
        const n = count ? counts[count] : undefined;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex min-h-11 flex-[1_1_180px] items-center gap-2.5 rounded-lg px-3 no-underline",
              active ? "bg-side-active font-medium text-white" : "text-side-text hover:bg-side-active/60 hover:text-white",
            )}
          >
            <Icon size={18} />
            {label}
            {n ? (
              <span
                className={cx(
                  "ml-auto rounded-full px-2 py-px text-xs font-semibold",
                  tone === "warn" ? "bg-warn text-white" : "bg-white text-ink",
                )}
              >
                <span className="sr-only">(</span>
                {n}
                <span className="sr-only">)</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
