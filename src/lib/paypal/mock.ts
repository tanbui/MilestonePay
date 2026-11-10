import { addDays } from "@/lib/domain/dates";
import type { PaypalGateway } from "./types";

function fakeId(prefix: string): string {
  const block = () => Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X");
  return `${prefix}-${block()}-${block()}-${block()}-${block()}`;
}

/**
 * Offline stand-in for PayPal. Returns realistic ids so the rest of the app
 * behaves exactly as it does against the sandbox. Payments are simulated
 * from the dashboard or Settings.
 */
export function createMockGateway(): PaypalGateway {
  return {
    mode: "mock",
    async createAndSendInvoice(input) {
      const id = fakeId("INV2");
      return {
        paypalInvoiceId: id,
        dueDate: addDays(input.invoiceDate, input.termDays),
        payerUrl: `https://www.sandbox.paypal.com/invoice/p/#${id}`,
      };
    },
    async sendReminder() {},
    async recordPayment() {},
    async createPayout() {
      return { batchId: fakeId("PB").replace(/-/g, "").slice(0, 13), status: "SUCCESS" };
    },
    async verifyWebhook() {
      // No PayPal to ask. The webhook route only accepts mock events locally.
      return true;
    },
  };
}
