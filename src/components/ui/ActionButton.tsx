"use client";

import { useActionState, type ReactNode } from "react";
import type { FormAction } from "@/lib/action-result";
import { buttonClass, cx, type ButtonVariant } from "./primitives";

/**
 * A one-button form that calls a server action and shows its error inline.
 * Pass actions pre-bound with their ids, e.g. `sendInvoice.bind(null, id)`.
 */
export function ActionButton({
  action,
  children,
  pendingText = "Working…",
  variant = "secondary",
  className,
  formClassName,
  hidden,
  ariaLabel,
}: {
  action: FormAction;
  children: ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  className?: string;
  formClassName?: string;
  hidden?: Record<string, string>;
  ariaLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={cx("flex flex-col gap-1", formClassName)}>
      {hidden
        ? Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)
        : null}
      <button type="submit" disabled={pending} aria-label={ariaLabel} className={buttonClass(variant, cx("w-full", className))}>
        {pending ? pendingText : children}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="text-xs font-medium text-warn">
          {state.error}
        </p>
      ) : null}
      {state && state.ok && state.message ? (
        <p role="status" className="text-xs font-medium text-ok">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
