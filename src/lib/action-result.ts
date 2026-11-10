/** What every server action returns, for `useActionState`. */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string } | null;

export type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
