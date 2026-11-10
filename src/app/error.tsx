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
      <button type="button" onClick={reset} className={buttonClass("primary")}>
        Try again
      </button>
    </div>
  );
}
