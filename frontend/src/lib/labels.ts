/**
 * Display vocabulary for the API's enum values.
 *
 * The backend's words are the only ones stored or transported; these maps
 * exist purely so a screen can render "Urgent" for `HIGH` or "Electrical" for
 * `ELECTRICAL`. Keeping every translation here is what stops the same mapping
 * being reinvented per page — the previous ad-hoc versions disagreed with each
 * other, so a complaint's category and urgency changed when the page reloaded.
 */

import type {
  ComplaintCategory,
  ComplaintStatus,
  ComplaintUrgency,
  GuestPassStatus,
  InvoiceStatus,
  SOSStatus,
  Audience,
} from "../api/types";

export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  STRUCTURAL: "Structural",
  SECURITY: "Security",
  CLEANING: "Cleaning",
  GENERAL: "General",
};

/** Categories a resident may pick, in the order the form lists them. */
export const COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  "PLUMBING",
  "ELECTRICAL",
  "STRUCTURAL",
  "SECURITY",
  "CLEANING",
  "GENERAL",
];

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const URGENCY_LABELS: Record<ComplaintUrgency, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "Urgent",
};

export const URGENCY_LEVELS: ComplaintUrgency[] = ["LOW", "MEDIUM", "HIGH"];

/** Most urgent first — the order the triage queue is sorted in. */
export const URGENCY_RANK: Record<ComplaintUrgency, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

export const GUEST_PASS_STATUS_LABELS: Record<GuestPassStatus, string> = {
  ACTIVE: "Active",
  USED: "Used",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
};

export const SOS_STATUS_LABELS: Record<SOSStatus, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
};

export const AUDIENCE_LABELS: Record<Audience, string> = {
  ALL: "Everyone",
  RESIDENTS: "Residents",
  NON_RESIDENT_OWNERS: "Non-resident owners",
  STAFF: "Staff",
};

/**
 * Render an enum value that arrived typed as a plain `string`.
 *
 * Response models declare status fields as `string`, so a lookup can miss if
 * the backend adds a value this build predates. Falling back to the raw value
 * with underscores removed keeps the screen readable instead of blank.
 */
export function labelFor(map: Record<string, string>, value: string): string {
  return map[value] ?? value.replace(/_/g, " ");
}
