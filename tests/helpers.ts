import { createSeedState } from "@/data/seed";
import type { AppState } from "@/lib/domain/types";

export const TODAY = "2026-11-09";

export function seed(): AppState {
  return createSeedState({
    today: TODAY,
    now: new Date("2026-11-09T18:00:00.000Z"),
    timeZone: "America/Los_Angeles",
    agencyName: "Lotus Dev Studio",
    defaultTermDays: 15,
  });
}

export function byId<T extends { id: string }>(list: T[], id: string): T {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}
