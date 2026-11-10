import { getConfig } from "@/lib/env";
import { createClaudeGateway } from "./claude";
import { createMockAi } from "./mock";
import type { AiGateway } from "./types";

export type { AiGateway } from "./types";

let override: AiGateway | undefined;

/** Claude when ANTHROPIC_API_KEY is set, otherwise the deterministic mock. */
export function getAi(): AiGateway {
  if (override) return override;
  const { ai } = getConfig();
  return ai.mode === "claude" && ai.apiKey ? createClaudeGateway(ai.apiKey, ai.model) : createMockAi();
}

/** For tests. */
export function setAi(gateway: AiGateway | undefined): void {
  override = gateway;
}
