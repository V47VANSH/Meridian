/**
 * Date and money formatting.
 *
 * The API sends naive ISO timestamps (no timezone suffix). `new Date()` reads
 * those as local time, which is what the society expects — a slot booked for
 * 18:00 is 18:00 on site. Parsing helpers live here so no screen re-derives
 * them with `String(x).slice(0, 10)`, which silently produced "" for a missing
 * value and an off-by-one date for anything with a timezone.
 */

const INVALID = "—";

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "12 Jul 2026" */
export function formatDate(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return INVALID;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "12 Jul 2026, 4:15 pm" */
export function formatDateTime(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return INVALID;
  return `${formatDate(value)}, ${date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

/** "4:15 pm" */
export function formatTime(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return INVALID;
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

/** `YYYY-MM-DD`, the format the API's date-only fields use. */
export function toDateInput(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Billing period `2026-07` as "July 2026". */
export function formatPeriod(period: string | null | undefined): string {
  if (!period) return INVALID;
  const date = parse(`${period}-01T00:00:00`);
  if (!date) return period;
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/** "₹4,200" — amounts are whole rupees throughout the API. */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return INVALID;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** True when a due date has passed. Used to explain an OVERDUE status. */
export function isPast(value: string | null | undefined): boolean {
  const date = parse(value);
  return date !== null && date.getTime() < Date.now();
}
