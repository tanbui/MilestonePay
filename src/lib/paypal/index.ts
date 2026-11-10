import { getConfig } from "@/lib/env";
import { createMockGateway } from "./mock";
import { createSandboxGateway } from "./sandbox";
import type { PaypalGateway } from "./types";

export * from "./types";

let override: PaypalGateway | undefined;

/** The PayPal sandbox client when credentials are set, otherwise the mock. */
export function getPaypal(): PaypalGateway {
  if (override) return override;
  const config = getConfig();
  return config.paypal.mode === "sandbox" ? createSandboxGateway(config.paypal) : createMockGateway();
}

/** For tests. */
export function setPaypal(gateway: PaypalGateway | undefined): void {
  override = gateway;
}
