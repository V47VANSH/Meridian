const MAP: Record<string, string> = {
  PAID: "badge-resolved",
  RESOLVED: "badge-resolved",
  DONE: "badge-resolved",
  ACKNOWLEDGED: "badge-resolved",
  ACTIVE: "badge-progress",
  IN_PROGRESS: "badge-progress",
  PENDING: "badge-pending",
  OPEN: "badge-pending",
  USED: "badge-pending",
  EXPIRED: "badge-pending",
  OVERDUE: "badge-urgent",
  URGENT: "badge-urgent",
  MEDIUM: "badge-progress",
  LOW: "badge-pending",
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${MAP[status] ?? "badge-pending"}`}>{status.replace("_", " ")}</span>;
}
