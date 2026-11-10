"use client";

import { buttonClass } from "@/components/ui/primitives";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-3 px-6 py-24">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-[13px] text-muted">
        {error.message || "The page couldn't load."}
        {error.digest ? ` (ref ${error.digest})` : ""}
      </p>
      <p className="text-[13px] text-muted">
        On a deployed site the details are in the host&apos;s function logs (search for <code>[milestone-pay]</code>), and{" "}
        <a href="/api/health">/api/health</a> checks the configuration.
      </p>
      <button type="button" onClick={reset} className={buttonClass("primary")}>
        Try again
      </button>
    </div>
  );
}
