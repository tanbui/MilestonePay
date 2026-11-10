import type { AppState } from "@/lib/domain/types";
import { freshSeed } from "./seed-state";
import type { Store } from "./types";

/**
 * In-memory store seeded with mock data. Survives hot reloads in
 * development; on serverless hosts it resets whenever a new instance starts,
 * so set DATABASE_URL for a hosted demo.
 */
const globalForStore = globalThis as unknown as { __milestonePayState?: AppState; __milestonePayLock?: Promise<unknown> };

function current(): AppState {
  if (!globalForStore.__milestonePayState) globalForStore.__milestonePayState = freshSeed();
  return globalForStore.__milestonePayState;
}

export function createMemoryStore(initial?: AppState): Store {
  if (initial) globalForStore.__milestonePayState = structuredClone(initial);

  return {
    kind: "memory",
    async read() {
      return structuredClone(current());
    },
    async update(mutate) {
      // Serialize writers so concurrent requests can't interleave.
      const run = async () => {
        const draft = structuredClone(current());
        const result = await mutate(draft);
        globalForStore.__milestonePayState = draft;
        return result;
      };
      const previous = globalForStore.__milestonePayLock ?? Promise.resolve();
      const next = previous.then(run, run);
      globalForStore.__milestonePayLock = next.catch(() => undefined);
      return next;
    },
    async reset() {
      globalForStore.__milestonePayState = freshSeed();
      return structuredClone(globalForStore.__milestonePayState);
    },
  };
}
