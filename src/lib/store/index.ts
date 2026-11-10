import { getConfig } from "@/lib/env";
import { createMemoryStore } from "./memory";
import { createPostgresStore } from "./postgres";
import type { Store } from "./types";

export type { Store } from "./types";

let cached: Store | undefined;

/** Postgres when DATABASE_URL is set, otherwise the in-memory mock store. */
export function getStore(): Store {
  if (cached) return cached;
  const { store } = getConfig();
  cached = store.mode === "postgres" && store.databaseUrl ? createPostgresStore(store.databaseUrl) : createMemoryStore();
  return cached;
}

/** For tests: swap in a specific store. */
export function setStore(store: Store | undefined): void {
  cached = store;
}
