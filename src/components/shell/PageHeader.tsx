import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  crumbs,
}: {
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  crumbs?: { href?: string; label: string }[];
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-line bg-white px-5 py-4 sm:px-8">
      {crumbs?.length ? (
        <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden="true">/</span> : null}
                {c.href ? (
                  <Link href={c.href} className="inline-flex min-h-8 items-center text-ink-2">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-ink">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle ? <p className="text-[13px] text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-start gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-7 px-5 pt-7 pb-12 sm:px-8">{children}</div>;
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="h-[92px] border-b border-line bg-white" />
      <PageBody>
        <span className="sr-only">Loading…</span>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-line bg-white" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl border border-line bg-white" />
      </PageBody>
    </div>
  );
}
