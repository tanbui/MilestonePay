import { createSeedState } from "@/data/seed";
import { getConfig, today } from "@/lib/env";
import type { AppState } from "@/lib/domain/types";

export function freshSeed(): AppState {
  const config = getConfig();
  return createSeedState({
    today: today(config),
    timeZone: config.timeZone,
    agencyName: config.agencyName,
    defaultTermDays: config.defaultTermDays,
  });
}
