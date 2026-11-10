"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormAction } from "@/lib/action-result";
import { buttonClass, cx, type ButtonVariant } from "./primitives";

/** A form bound to a server action, with inline success / error messages. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  // React resets uncontrolled fields after the action completes.
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state && !state.ok ? (
        <p role="alert" className="mt-2 text-xs font-medium text-warn">
          {state.error}
        </p>
      ) : null}
      {state && state.ok && state.message ? (
        <p role="status" className="mt-2 text-xs font-medium text-ok">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/** Submit button that shows a pending label while its form is submitting. */
export function SubmitButton({
  children,
  pendingText = "Working…",
  variant = "secondary",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  const mine = !name || !data || data.get(name) === value;
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={buttonClass(variant, cx(className))}>
      {pending && mine ? pendingText : children}
    </button>
  );
}
