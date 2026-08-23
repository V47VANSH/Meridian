/**
 * Razorpay Checkout, loaded on demand.
 *
 * The backend will not settle an invoice without an HMAC over
 * `<order_id>|<payment_id>` signed with the secret key. Only the gateway can
 * produce that, which is the point: nothing the browser makes up can mark an
 * invoice paid. So a real payment has to go through the gateway's own widget,
 * and this module is the bridge to it.
 *
 * The checkout script is fetched from Razorpay's CDN the first time it is
 * needed rather than shipped in the bundle, so a deployment with no gateway
 * configured never loads it at all.
 */

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Placeholder the backend falls back to when no gateway key is configured. */
const PLACEHOLDER_KEY_PREFIX = "rzp_test_dummy";

export interface CheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  signature: string;
  method: string;
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): { open: () => void };
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/** True when the deployment has real gateway credentials behind it. */
export function isGatewayConfigured(keyId: string | undefined | null): boolean {
  return Boolean(keyId) && !keyId!.startsWith(PLACEHOLDER_KEY_PREFIX);
}

let loader: Promise<boolean> | null = null;

function loadCheckoutScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (loader) return loader;

  loader = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      // Retry on the next attempt rather than caching the failure — the CDN
      // may simply have been unreachable for a moment.
      loader = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return loader;
}

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

/**
 * Open checkout for an order and resolve with what the gateway signed.
 *
 * Rejects with a `CheckoutError` if the widget cannot be loaded or the payer
 * dismisses it, so the caller can tell "not paid" from "paid but not yet
 * confirmed" — the invoice must not be treated as settled in either case.
 */
export async function openCheckout(options: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string };
}): Promise<CheckoutResult> {
  const loaded = await loadCheckoutScript();
  if (!loaded || !window.Razorpay) {
    throw new CheckoutError(
      "Could not load the payment gateway. Check your connection and try again.",
    );
  }

  return new Promise<CheckoutResult>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: options.keyId,
      // Razorpay quotes amounts in paise; the API works in whole rupees.
      amount: Math.round(options.amount * 100),
      currency: options.currency,
      name: options.name,
      description: options.description,
      order_id: options.orderId,
      prefill: options.prefill,
      handler: (response: Record<string, string>) =>
        resolve({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          signature: response.razorpay_signature,
          method: response.method ?? "card",
        }),
      modal: {
        ondismiss: () =>
          reject(new CheckoutError("Payment was cancelled. The invoice is still unpaid.")),
      },
    });
    checkout.open();
  });
}
