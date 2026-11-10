import type { Cents } from "./types";

const whole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const exact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/** "$14,000", or "$14,000.00" with `exactCents`. */
export function formatMoney(cents: Cents, exactCents = false): string {
  return (exactCents ? exact : whole).format(cents / 100);
}

/** PayPal amount string, e.g. "14000.00". */
export function toPaypalValue(cents: Cents): string {
  return (cents / 100).toFixed(2);
}

export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

/** Share of an amount, rounded to the cent. */
export function percentOf(cents: Cents, percent: number): Cents {
  return Math.round((cents * percent) / 100);
}
