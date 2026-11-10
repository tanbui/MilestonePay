import type { AppState } from "@/lib/domain/types";

/**
 * The app keeps all of its own data (projects, milestones, local invoice
 * records, activity) as one state document. That keeps the two backends
 * tiny: an in-memory copy for development and one JSONB row in Postgres for
 * a hosted demo. PayPal remains the source of truth for money movement.
 */
export interface Store {
  readonly kind: "memory" | "postgres";
  read(): Promise<AppState>;
  /**
   * Applies `mutate` to a fresh copy of the state and saves it. The callback
   * may be async; its return value is passed through.
   */
  update<T>(mutate: (state: AppState) => T | Promise<T>): Promise<T>;
  /** Replaces everything with fresh seed data. */
  reset(): Promise<AppState>;
}
