import { useMemo, useState } from "react";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { QueryState } from "../../../components/QueryState";
import ComplaintDetailModal from "../../../components/modals/ComplaintDetailModal";
import { useComplaints } from "../../../api/complaints";
import { useFlatLabels } from "../../../api/directory";
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  URGENCY_LABELS,
  URGENCY_LEVELS,
  URGENCY_RANK,
  labelFor,
} from "../../../lib/labels";
import { formatDate } from "../../../lib/format";
import type { ComplaintStatus, ComplaintUrgency } from "../../../api/types";

const STATUS_FILTERS: (ComplaintStatus | "ALL")[] = [
  "ALL",
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

export default function ComplaintTriagePage() {
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "ALL">("ALL");
  const [urgencyFilter, setUrgencyFilter] = useState<ComplaintUrgency | "ALL">("ALL");

  const complaints = useComplaints(statusFilter === "ALL" ? undefined : { status: statusFilter });
  const flatLabel = useFlatLabels();

  // Urgency has no server-side filter, so it is applied here. The backend
  // already returns the queue most-urgent-first; re-sorting keeps that order
  // stable once the client filter removes rows.
  const sorted = useMemo(() => {
    const rows = (complaints.data ?? []).filter(
      (c) => urgencyFilter === "ALL" || c.urgency === urgencyFilter,
    );
    return rows.sort(
      (a, b) =>
        (URGENCY_RANK[a.urgency as ComplaintUrgency] ?? 3) -
        (URGENCY_RANK[b.urgency as ComplaintUrgency] ?? 3),
    );
  }, [complaints.data, urgencyFilter]);

  return (
    <div>
      <PageHeader
        code="C-03 / TRIAGE QUEUE"
        title="Complaint Triage"
        description="Centralized queue, sorted by urgency so critical issues surface first (Story 2.2 / 2.3)."
      />

      <div className="flex flex-wrap gap-4 mb-5 items-center justify-between text-xs font-mono">
        <div className="flex gap-4">
          <div>
            <label className="block text-[10px] uppercase text-ink-500 mb-1">Status Filter</label>
            <div className="inline-flex rounded-sm border border-blueprint-700 bg-blueprint-950/40 p-0.5">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-xs px-2.5 py-1 transition ${
                    statusFilter === status
                      ? "bg-blueprint-700 text-signal font-semibold"
                      : "text-ink-300 hover:text-ink-100"
                  }`}
                >
                  {status === "ALL" ? "ALL" : COMPLAINT_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase text-ink-500 mb-1">Urgency Filter</label>
            <div className="inline-flex rounded-sm border border-blueprint-700 bg-blueprint-950/40 p-0.5">
              {(["ALL", ...URGENCY_LEVELS] as (ComplaintUrgency | "ALL")[]).map((urgency) => (
                <button
                  key={urgency}
                  onClick={() => setUrgencyFilter(urgency)}
                  className={`rounded-xs px-2.5 py-1 transition ${
                    urgencyFilter === urgency
                      ? "bg-blueprint-700 text-signal font-semibold"
                      : "text-ink-300 hover:text-ink-100"
                  }`}
                >
                  {urgency === "ALL" ? "ALL" : URGENCY_LABELS[urgency]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <span className="text-ink-500">Tickets listed: {sorted.length}</span>
      </div>

      <QueryState
        isLoading={complaints.isPending}
        error={complaints.error}
        onRetry={() => complaints.refetch()}
        loadingLabel="Loading the triage queue…"
      >
        {sorted.length === 0 ? (
          <EmptyState
            title="No complaints matching the selected filters"
            hint="Clear a filter to widen the queue."
          />
        ) : (
          <div className="bp-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blueprint-700 text-left text-ink-500 font-mono text-[11px] uppercase tracking-wide">
                  <th className="px-5 py-3">Complaint</th>
                  <th className="px-5 py-3">Flat</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Raised</th>
                  <th className="px-5 py-3">Urgency</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedComplaintId(c.id)}
                    className="border-b border-blueprint-700 last:border-0 hover:bg-blueprint-800/40 transition cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <p className="text-ink-100 font-medium">{c.title}</p>
                      <p className="text-xs font-mono text-ink-500">{c.id}</p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">{flatLabel(c.flat_id)}</td>
                    <td className="px-5 py-3 text-ink-300">
                      {labelFor(COMPLAINT_CATEGORY_LABELS, c.category)}
                    </td>
                    <td className="px-5 py-3 text-ink-300 font-mono text-xs">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={c.urgency} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button className="btn-secondary py-1 px-2.5 text-xs">Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>

      {selectedComplaintId && (
        <ComplaintDetailModal
          complaintId={selectedComplaintId}
          onClose={() => setSelectedComplaintId(null)}
        />
      )}
    </div>
  );
}
