import { connection } from "next/server";
import type { AppState, ISODate } from "@/lib/domain/types";
import { getConfig, today, type AppConfig } from "@/lib/env";
import { getStore } from "@/lib/store";

export interface PageData {
  state: AppState;
  today: ISODate;
  config: AppConfig;
}

/**
 * Reads the app state at request time. `connection()` keeps these reads out
 * of prerendering (the store is not a fetch Next.js can see).
 */
export async function loadPageData(): Promise<PageData> {
  await connection();
  const config = getConfig();
  try {
    const state = await getStore().read();
    return { state, today: today(config), config };
  } catch (error) {
    // Production hides server error messages from the browser; this line is
    // what shows up in the host's function logs.
    console.error(`[milestone-pay] Couldn't load app data from the ${config.store.mode} store:`, error);
    throw error;
  }
}
