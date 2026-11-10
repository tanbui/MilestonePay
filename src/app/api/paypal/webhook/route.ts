import { handleWebhookEvent } from "@/lib/agent/workflows";
import { getPaypal, type PaypalWebhookEvent } from "@/lib/paypal";

/**
 * PayPal webhook receiver. Register this URL for your sandbox app and
 * subscribe to the invoice and payout events listed on the Settings page.
 * Every event is verified with PayPal before it's applied.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  let event: PaypalWebhookEvent;
  try {
    event = JSON.parse(raw) as PaypalWebhookEvent;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!event?.event_type) return Response.json({ error: "Not a PayPal webhook event" }, { status: 400 });

  const paypal = getPaypal();
  const verified = await paypal
    .verifyWebhook(
      {
        authAlgo: request.headers.get("paypal-auth-algo"),
        certUrl: request.headers.get("paypal-cert-url"),
        transmissionId: request.headers.get("paypal-transmission-id"),
        transmissionSig: request.headers.get("paypal-transmission-sig"),
        transmissionTime: request.headers.get("paypal-transmission-time"),
      },
      event,
    )
    .catch((error) => {
      console.error("Webhook verification failed", error);
      return false;
    });
  if (!verified) return Response.json({ error: "Signature verification failed" }, { status: 401 });

  try {
    const result = await handleWebhookEvent(event);
    return Response.json({ received: true, ...result });
  } catch (error) {
    console.error("Webhook handling failed", error);
    // A 500 makes PayPal retry later.
    return Response.json({ error: "Handler failed" }, { status: 500 });
  }
}
