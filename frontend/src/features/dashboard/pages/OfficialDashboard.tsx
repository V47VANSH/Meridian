import { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import StatusBadge from "../../../components/StatusBadge";
import { QueryState } from "../../../components/QueryState";
import ComplaintDetailModal from "../../../components/modals/ComplaintDetailModal";
import ResidentDetailModal from "../../../components/modals/ResidentDetailModal";
import { useOfficialDashboard } from "../../../api/dashboard";
import { useComplaints } from "../../../api/complaints";
import { useDirectory, type DirectoryEntry } from "../../../api/residents";
import { useFlatLabels } from "../../../api/directory";
import { COMPLAINT_CATEGORY_LABELS, labelFor } from "../../../lib/labels";
import { formatCurrency } from "../../../lib/format";

export default function OfficialDashboard() {
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState<DirectoryEntry | null>(null);

  // The counters come from the aggregate endpoint rather than from counting
  // fixture arrays, so 'Open Complaints' is the society's real figure.
  const dashboard = useOfficialDashboard();
  const complaints = useComplaints();
  const directory = useDirectory();
  const flatLabel = useFlatLabels();

  const stats = dashboard.data;
  const queue = (complaints.data ?? []).filter((c) => c.status !== "CLOSED").slice(0, 4);
  const withDues = directory.entries.filter((entry) => entry.duesStatus === "PENDING");

  return (
    <div>
      <PageHeader
        code="D-02 / OFFICIAL DASHBOARD"
        title="Centralized society records"
        description="Payments, complaints, bookings, and residents from one place."
      />

      <QueryState
        isLoading={dashboard.isPending}
        error={dashboard.error}
        onRetry={() => dashboard.refetch()}
        loadingLabel="Loading society figures…"
      >
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatCard label="Open Complaints" value={String(stats.open_complaints_count)} />
            <StatCard label="Overdue Invoices" value={String(stats.overdue_invoices_count)} />
            <StatCard
              label="Residents w/ Pending Dues"
              value={String(stats.pending_dues_residents_count)}
            />
          </div>
        )}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatCard label="Active Bookings" value={String(stats.active_bookings_count)} />
            <StatCard
              label="Active SOS Alerts"
              value={String(stats.active_sos_count)}
              hint={stats.active_sos_count > 0 ? "Needs a responder now" : "Nothing open"}
            />
            <StatCard label="Flats" value={String(stats.total_flats)} />
          </div>
        )}
      </QueryState>

      <div className="grid grid-cols-2 gap-6">
        <div className="bp-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="bp-eyebrow">COMPLAINT TRIAGE QUEUE</p>
            <Link
              to="/official/complaints/triage"
              className="text-xs text-signal hover:text-signal-soft"
            >
              Open queue
            </Link>
          </div>
          <QueryState
            isLoading={complaints.isPending}
            error={complaints.error}
            onRetry={() => complaints.refetch()}
            loadingLabel="Loading the queue…"
          >
            {queue.length === 0 ? (
              <p className="text-sm text-ink-500 italic">Nothing in the queue.</p>
            ) : (
              <div className="space-y-2 mt-3">
                {queue.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedComplaintId(c.id)}
                    className="p-3 border border-blueprint-700 bg-blueprint-900/50 rounded-xs flex justify-between items-center text-xs font-mono cursor-pointer hover:border-signal/50"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="font-semibold text-ink-100 truncate">{c.title}</p>
                      <p className="text-[10px] text-ink-500">
                        {flatLabel(c.flat_id)} ·{" "}
                        {labelFor(COMPLAINT_CATEGORY_LABELS, c.category)}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            )}
          </QueryState>
        </div>

        <div className="bp-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="bp-eyebrow">RESIDENT DUES</p>
            <Link to="/official/residents" className="text-xs text-signal hover:text-signal-soft">
              View directory
            </Link>
          </div>
          <QueryState
            isLoading={directory.isPending}
            error={directory.error}
            onRetry={directory.refetch}
            loadingLabel="Loading residents…"
          >
            {withDues.length === 0 ? (
              <p className="text-sm text-ink-500 italic">Every resident is up to date.</p>
            ) : (
              <ul className="space-y-3">
                {withDues.map((entry) => (
                  <li
                    key={`${entry.userId}:${entry.flatId}`}
                    onClick={() => setSelectedResident(entry)}
                    className="flex items-center justify-between text-sm hover:bg-blueprint-700/30 p-1.5 rounded-sm cursor-pointer transition"
                  >
                    <span className="text-ink-100 font-medium">
                      {entry.flatLabel} — {entry.name}
                    </span>
                    <span className="font-mono text-xs text-ink-300">
                      {formatCurrency(entry.outstanding)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </div>
      </div>

      {selectedComplaintId && (
        <ComplaintDetailModal
          complaintId={selectedComplaintId}
          onClose={() => setSelectedComplaintId(null)}
        />
      )}

      {selectedResident && (
        <ResidentDetailModal entry={selectedResident} onClose={() => setSelectedResident(null)} />
      )}
    </div>
  );
}
