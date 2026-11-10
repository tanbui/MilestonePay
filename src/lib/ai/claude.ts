import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { DocumentBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";
import {
  ACCEPTANCE_SYSTEM,
  REMINDER_SYSTEM,
  SOW_SYSTEM,
  acceptanceUserPrompt,
  reminderUserPrompt,
  sowUserPrompt,
} from "./prompts";
import { AcceptanceSchema, ReminderSchema, SowExtractionSchema } from "./schemas";
import type { AiGateway } from "./types";

/**
 * Claude-backed agent skills. Each call uses structured outputs, so the
 * response is validated against a Zod schema before the app touches it.
 */
export function createClaudeGateway(apiKey: string, model: string): AiGateway {
  const client = new Anthropic({ apiKey });

  async function parsed<T>(promise: Promise<{ parsed_output: T | null; stop_reason?: string | null }>): Promise<T> {
    const message = await promise;
    if (!message.parsed_output) {
      throw new Error(`Claude returned no structured output (stop reason: ${message.stop_reason ?? "unknown"}).`);
    }
    return message.parsed_output;
  }

  return {
    mode: "claude",
    model,

    async extractSow(input) {
      const document: DocumentBlockParam =
        input.mediaType === "application/pdf"
          ? { type: "document", title: input.fileName, source: { type: "base64", media_type: "application/pdf", data: input.data } }
          : { type: "document", title: input.fileName, source: { type: "text", media_type: "text/plain", data: input.data } };

      return parsed(
        client.messages.parse({
          model,
          max_tokens: 8000,
          system: SOW_SYSTEM,
          messages: [{ role: "user", content: [document, { type: "text", text: sowUserPrompt(input) }] }],
          output_config: { format: zodOutputFormat(SowExtractionSchema) },
        }),
      );
    },

    async checkAcceptance(input) {
      return parsed(
        client.messages.parse({
          model,
          max_tokens: 3000,
          system: ACCEPTANCE_SYSTEM,
          messages: [{ role: "user", content: acceptanceUserPrompt(input) }],
          output_config: { format: zodOutputFormat(AcceptanceSchema) },
        }),
      );
    },

    async draftReminder(input) {
      return parsed(
        client.messages.parse({
          model,
          max_tokens: 1000,
          system: REMINDER_SYSTEM,
          messages: [{ role: "user", content: reminderUserPrompt(input) }],
          output_config: { format: zodOutputFormat(ReminderSchema) },
        }),
      );
    },
  };
}
