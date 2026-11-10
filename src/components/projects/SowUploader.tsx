"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { IconFile, IconSparkle, IconUpload } from "@/components/ui/icons";
import { buttonClass, cx } from "@/components/ui/primitives";

const MAX_BYTES = 4 * 1024 * 1024;

export function SowUploader({ aiMode }: { aiMode: "mock" | "claude" }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<false | "file" | "sample">(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function pick(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("That file is over 4 MB. Try a smaller PDF or paste the text into a .txt file.");
      return;
    }
    setFile(f);
  }

  async function submit(kind: "file" | "sample") {
    setError(null);
    const body = new FormData();
    if (kind === "sample") body.set("sample", "pinecrest");
    else if (file) body.set("file", file);
    else return;
    setBusy(kind);
    try {
      const res = await fetch("/api/sow", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { projectId?: string; error?: string };
      if (!res.ok || !json.projectId) throw new Error(json.error ?? `Upload failed (${res.status}).`);
      router.push(`/projects/${json.projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={cx(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed bg-white px-6 py-10 text-center",
          dragging ? "border-accent bg-accent-soft" : "border-line-strong",
        )}
      >
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <IconUpload size={22} />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold">Drop a statement of work here</p>
          <p className="text-[13px] text-muted">PDF, Markdown or plain text, up to 4 MB.</p>
        </div>
        <label className={buttonClass("secondary", "cursor-pointer")}>
          Choose a file
          <input
            ref={input}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        {file ? (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 rounded-lg border border-line px-3 py-2 text-[13px]">
            <IconFile size={16} />
            <span className="font-medium break-all">{file.name}</span>
            <span className="text-muted">{Math.max(1, Math.round(file.size / 1024))} KB</span>
            <button type="button" onClick={() => submit("file")} disabled={Boolean(busy)} className={buttonClass("accent")}>
              <IconSparkle size={16} />
              {busy === "file" ? "Reading the SOW…" : "Read with the agent"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-5 py-4">
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
          <span className="text-[13px] font-semibold">No SOW handy?</span>
          <span className="text-[13px] text-muted">
            Use the sample: an 11-page SOW for a credit union app with one vague performance clause and no payment terms.
          </span>
        </div>
        <button type="button" onClick={() => submit("sample")} disabled={Boolean(busy)} className={buttonClass("primary")}>
          {busy === "sample" ? "Reading the SOW…" : "Use the sample SOW"}
        </button>
      </div>

      {busy ? (
        <p role="status" className="text-[13px] text-muted">
          {aiMode === "claude"
            ? "Claude is reading the document, pulling out milestones and checking every acceptance criterion. This takes 20–60 seconds."
            : "Mock AI is preparing the sample extraction."}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-warn">
          {error}
        </p>
      ) : null}
      {aiMode === "mock" ? (
        <p className="text-xs text-muted">
          Mock AI mode: no ANTHROPIC_API_KEY is set, so any upload returns the sample SOW&apos;s extraction. Add a key to have Claude read
          your own documents.
        </p>
      ) : null}
    </div>
  );
}
