"use client";

/** Last-resort error page for failures in the root layout itself. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#f5f6f8", color: "#14171f" }}>
        <main style={{ maxWidth: 480, margin: "96px auto", padding: "0 24px" }}>
          <h1 style={{ fontSize: 20 }}>Milestone Pay couldn&apos;t start</h1>
          <p style={{ fontSize: 14, color: "#5b6170", lineHeight: 1.5 }}>
            This is usually a configuration problem. Open <a href="/api/health">/api/health</a> for a quick check, and look for lines
            starting with <code>[milestone-pay]</code> in your host&apos;s function logs.
            {error.digest ? ` Error reference: ${error.digest}.` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: 0, background: "#14171f", color: "#fff", fontSize: 14 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
