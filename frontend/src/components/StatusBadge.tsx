import {
  COMPLAINT_STATUS_LABELS,
  GUEST_PASS_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  SOS_STATUS_LABELS,
  URGENCY_LABELS,
} from "../lib/labels";

/**
 * Tone per status value.
 *
 * Values are unique across the API's enums, so one table covers complaints,
 * invoices, guest passes, SOS incidents and payments without the caller having
 * to say which kind it is passing.
 */
const TONE: Record<string, string> = {
  // Settled / positive
  PAID: "badge-resolved",
  RESOLVED: "badge-resolved",
  DONE: "badge-resolved",
  ACKNOWLEDGED: "badge-resolved",
  CAPTURED: "badge-resolved",
  CLEAR: "badge-resolved",
  // In flight
  ACTIVE: "badge-progress",
  IN_PROGRESS: "badge-progress",
  MEDIUM: "badge-progress",
  CREATED: "badge-progress",
  // Waiting
  PENDING: "badge-pending",
  OPEN: "badge-pending",
  USED: "badge-pending",
  EXPIRED: "badge-pending",
  CLOSED: "badge-pending",
  LOW: "badge-pending",
  // Attention
  OVERDUE: "badge-urgent",
  HIGH: "badge-urgent",
  URGENT: "badge-urgent",
  REVOKED: "badge-urgent",
  FAILED: "badge-urgent",
};

/** Display wording, so HIGH urgency reads as "Urgent" rather than "HIGH". */
const WORDING: Record<string, string> = {
  ...COMPLAINT_STATUS_LABELS,
  ...INVOICE_STATUS_LABELS,
  ...GUEST_PASS_STATUS_LABELS,
  ...SOS_STATUS_LABELS,
  ...URGENCY_LABELS,
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${TONE[status] ?? "badge-pending"}`}>
      {WORDING[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}
