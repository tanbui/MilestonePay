import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/ui/icons";
import { approvalQueue, overdueDays } from "@/lib/domain/rules";
import { getConfig } from "@/lib/env";
import { loadPageData } from "@/lib/queries";
import { NavLinks } from "./NavLinks";
import { NavList } from "./NavList";

async function LiveNav() {
  // The sidebar lives in the root layout, so it must never take the page down.
  const data = await loadPageData().catch(() => null);
  if (!data) return <NavLinks />;
  const { state, today } = data;
  return (
    <NavLinks
      counts={{
        approvals: approvalQueue(state, today).length,
        overdue: state.invoices.filter((i) => overdueDays(i, today) > 0).length,
        drafts: state.projects.filter((p) => p.status === "draft").length,
      }}
    />
  );
}

async function ModeCard() {
  const config = getConfig();
  const paypal = config.paypal.mode === "sandbox";
  const claude = config.ai.mode === "claude";
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-side-line p-3.5 text-[13px]">
      <div className="flex items-center gap-2 font-medium text-white">
        <span aria-hidden="true" className={paypal ? "size-2 rounded-full bg-emerald-400" : "size-2 rounded-full bg-amber-300"} />
        {paypal ? "PayPal sandbox connected" : "PayPal mock mode"}
      </div>
      <div className="flex items-center gap-2 font-medium text-white">
        <span aria-hidden="true" className={claude ? "size-2 rounded-full bg-emerald-400" : "size-2 rounded-full bg-amber-300"} />
        {claude ? `Claude · ${config.ai.model}` : "Mock AI (no API key)"}
      </div>
      <Link href="/settings" className="text-xs text-side-muted underline-offset-2 hover:text-white">
        {config.store.mode === "postgres" ? "Postgres store" : "In-memory mock data"} · settings
      </Link>
    </div>
  );
}

async function DynamicModeCard() {
  await connection();
  return <ModeCard />;
}

export function Sidebar() {
  return (
    <aside className="flex flex-[1_1_232px] flex-col gap-7 bg-side px-4 py-6 text-side-text">
      <Link href="/" className="flex items-center gap-2.5 px-2 text-white no-underline">
        <Logo />
        <span className="text-base font-semibold tracking-tight">Milestone Pay</span>
      </Link>
      <Suspense fallback={<NavList />}>
        <LiveNav />
      </Suspense>
      <div className="mt-auto">
        <Suspense fallback={<div className="h-24 rounded-xl border border-side-line" />}>
          <DynamicModeCard />
        </Suspense>
      </div>
    </aside>
  );
}
