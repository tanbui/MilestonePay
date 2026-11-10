import { addDays } from "@/lib/domain/dates";
import { toPaypalValue } from "@/lib/domain/money";
import type { AppConfig } from "@/lib/env";
import {
  PaypalError,
  type InvoiceInput,
  type PaypalGateway,
  type PaypalWebhookEvent,
  type PayoutResult,
  type SentInvoice,
  type WebhookHeaders,
} from "./types";

/** PayPal's built-in net terms; anything else uses an explicit due date. */
const NET_TERMS = new Set([10, 15, 30, 45, 60, 90]);

type PaypalConfig = AppConfig["paypal"];

const tokenCache: { value?: string; expiresAt?: number } = {};

async function accessToken(config: PaypalConfig): Promise<string> {
  if (tokenCache.value && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) return tokenCache.value;
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const res = await fetch(`${config.apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new PaypalError(`PayPal auth failed (${res.status}). Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.`, res.status);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.value = json.access_token;
  tokenCache.expiresAt = Date.now() + (json.expires_in - 120) * 1000;
  return json.access_token;
}

async function call<T>(
  config: PaypalConfig,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const token = await accessToken(config);
  const res = await fetch(`${config.apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const details = json.details as { issue?: string; description?: string }[] | undefined;
    const reason = details?.[0]?.description ?? details?.[0]?.issue ?? (json.message as string) ?? res.statusText;
    throw new PaypalError(`PayPal ${method} ${path} failed: ${reason}`, res.status, json.debug_id as string, json.details);
  }
  return json as T;
}

interface PaypalLink {
  href: string;
  rel: string;
  method?: string;
}

export function invoiceBody(input: InvoiceInput) {
  const due = addDays(input.invoiceDate, input.termDays);
  const paymentTerm = NET_TERMS.has(input.termDays)
    ? { term_type: `NET_${input.termDays}` }
    : { term_type: "DUE_ON_DATE_SPECIFIED", due_date: due };
  return {
    body: {
      detail: {
        invoice_number: input.invoiceNumber,
        reference: input.reference,
        invoice_date: input.invoiceDate,
        currency_code: input.currency,
        note: input.note,
        payment_term: paymentTerm,
      },
      primary_recipients: [
        {
          billing_info: {
            name: { given_name: input.recipient.givenName, surname: input.recipient.surname },
            email_address: input.recipient.email,
          },
        },
      ],
      items: [
        {
          name: input.itemName.slice(0, 200),
          description: input.itemDescription.slice(0, 1000),
          quantity: "1",
          unit_amount: { currency_code: input.currency, value: toPaypalValue(input.amountCents) },
          unit_of_measure: "AMOUNT",
        },
      ],
      configuration: { allow_tip: false },
    },
    dueDate: due,
  };
}

export function createSandboxGateway(config: PaypalConfig): PaypalGateway {
  return {
    mode: "sandbox",

    async createAndSendInvoice(input): Promise<SentInvoice> {
      const { body, dueDate } = invoiceBody(input);
      const created = await call<{ id: string; detail?: { metadata?: { recipient_view_url?: string } } }>(
        config,
        "POST",
        "/v2/invoicing/invoices",
        body,
        { Prefer: "return=representation" },
      );
      const sent = await call<{ links?: PaypalLink[] }>(config, "POST", `/v2/invoicing/invoices/${created.id}/send`, {
        send_to_invoicer: true,
        send_to_recipient: true,
      });
      const payerUrl =
        sent.links?.find((l) => l.rel === "payer-view")?.href ?? created.detail?.metadata?.recipient_view_url;
      return { paypalInvoiceId: created.id, dueDate, payerUrl };
    },

    async sendReminder(paypalInvoiceId, message) {
      await call(config, "POST", `/v2/invoicing/invoices/${paypalInvoiceId}/remind`, {
        subject: message.subject.slice(0, 4000),
        note: message.note.slice(0, 4000),
        send_to_invoicer: false,
        send_to_recipient: true,
      });
    },

    async recordPayment(paypalInvoiceId, payment) {
      await call(config, "POST", `/v2/invoicing/invoices/${paypalInvoiceId}/payments`, {
        method: "BANK_TRANSFER",
        payment_date: payment.date,
        amount: { currency_code: "USD", value: toPaypalValue(payment.amountCents) },
        note: payment.note,
      });
    },

    async createPayout(input): Promise<PayoutResult> {
      const res = await call<{ batch_header: { payout_batch_id: string; batch_status: string } }>(
        config,
        "POST",
        "/v1/payments/payouts",
        {
          sender_batch_header: {
            sender_batch_id: input.senderBatchId,
            email_subject: input.emailSubject,
            email_message: input.emailMessage,
          },
          items: input.items.map((item) => ({
            recipient_type: "EMAIL",
            receiver: item.receiverEmail,
            amount: { value: toPaypalValue(item.amountCents), currency: "USD" },
            note: item.note,
            sender_item_id: item.senderItemId,
          })),
        },
      );
      return { batchId: res.batch_header.payout_batch_id, status: res.batch_header.batch_status };
    },

    async verifyWebhook(headers: WebhookHeaders, event: PaypalWebhookEvent) {
      if (config.skipWebhookVerify) return true;
      if (!config.webhookId) return false;
      if (!headers.authAlgo || !headers.certUrl || !headers.transmissionId || !headers.transmissionSig || !headers.transmissionTime) {
        return false;
      }
      const res = await call<{ verification_status: string }>(config, "POST", "/v1/notifications/verify-webhook-signature", {
        auth_algo: headers.authAlgo,
        cert_url: headers.certUrl,
        transmission_id: headers.transmissionId,
        transmission_sig: headers.transmissionSig,
        transmission_time: headers.transmissionTime,
        webhook_id: config.webhookId,
        webhook_event: event,
      });
      return res.verification_status === "SUCCESS";
    },
  };
}
