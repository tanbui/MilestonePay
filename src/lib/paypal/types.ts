import type { Cents, ISODate } from "@/lib/domain/types";

export interface InvoiceInput {
  /** Must be unique per PayPal merchant account. */
  invoiceNumber: string;
  recipient: { givenName: string; surname: string; email: string };
  itemName: string;
  itemDescription: string;
  amountCents: Cents;
  currency: "USD";
  invoiceDate: ISODate;
  termDays: number;
  note: string;
  reference: string;
}

export interface SentInvoice {
  paypalInvoiceId: string;
  dueDate: ISODate;
  payerUrl?: string;
}

export interface PayoutItemInput {
  receiverEmail: string;
  amountCents: Cents;
  note: string;
  senderItemId: string;
}

export interface PayoutResult {
  batchId: string;
  status: string;
}

export interface WebhookHeaders {
  authAlgo: string | null;
  certUrl: string | null;
  transmissionId: string | null;
  transmissionSig: string | null;
  transmissionTime: string | null;
}

export interface PaypalWebhookEvent {
  id: string;
  event_type: string;
  resource_type?: string;
  summary?: string;
  resource: Record<string, unknown>;
}

/**
 * Everything Milestone Pay needs from PayPal. Two implementations: the real
 * REST client for the sandbox, and a mock that works offline.
 */
export interface PaypalGateway {
  readonly mode: "mock" | "sandbox";
  /** Creates the invoice in PayPal Invoicing and emails it to the client. */
  createAndSendInvoice(input: InvoiceInput): Promise<SentInvoice>;
  /** Sends PayPal's reminder email for an unpaid invoice (max 2 per day). */
  sendReminder(paypalInvoiceId: string, message: { subject: string; note: string }): Promise<void>;
  /** Records a payment made outside PayPal. Used by the demo "simulate payment" button. */
  recordPayment(paypalInvoiceId: string, payment: { amountCents: Cents; date: ISODate; note: string }): Promise<void>;
  /** Pays subcontractors through PayPal Payouts. */
  createPayout(input: { senderBatchId: string; emailSubject: string; emailMessage: string; items: PayoutItemInput[] }): Promise<PayoutResult>;
  /** Verifies a webhook's signature with PayPal. */
  verifyWebhook(headers: WebhookHeaders, event: PaypalWebhookEvent): Promise<boolean>;
}

export class PaypalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly debugId?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "PaypalError";
  }
}
