import { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { QueryState } from "../../../components/QueryState";
import AnnouncementDetailModal from "../../../components/modals/AnnouncementDetailModal";
import { useResidentDashboard } from "../../../api/dashboard";
import { COMPLAINT_CATEGORY_LABELS, labelFor } from "../../../lib/labels";
import { formatCurrency, formatDate, formatDateTime } from "../../../lib/format";
import type { Announcement } from "../../../api/types";

export default function ResidentDashboard() {
  const [selected, setSelected] = useState<Announcement | null>(null);

  // One aggregate rather than four separate calls merged into a shared array.
  // The counts here are computed server-side from the same rows the detail
  // screens list, so the two cannot disagree.
  const dashboard = useResidentDashboard();

  const pendingInvoice = dashboard.data?.pending_invoice ?? null;
  const openComplaints = dashboard.data?.open_complaints ?? [];
  const upcoming = dashboard.data?.upcoming_bookings ?? [];
  const announcements = dashboard.data?.latest_announcements ?? [];
  const latest = announcements[0];

  return (
    <div>
      <PageHeader
        code="D-01 / RESIDENT DASHBOARD"
        title="Your society, at a glance"
        description="Payments, complaints, and bookings in one view."
      />

      <QueryState
        isLoading={dashboard.isPending}
        error={dashboard.error}
        onRetry={() => dashboard.refetch()}
        loadingLabel="Loading your dashboard…"
      >
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Maintenance Due"
            value={pendingInvoice ? formatCurrency(pendingInvoice.amount) : "All clear"}
            hint={
              pendingInvoice
                ? `Due ${formatDate(pendingInvoice.due_date)} · ${pendingInvoice.status}`
                : "No dues pending"
            }
          />
          <StatCard
            label="Open Complaints"
            value={String(openComplaints.length)}
            hint="Across all categories"
          />
          <StatCard
            label="Next Booking"
            value={upcoming[0]?.facility_name ?? "None"}
            hint={
              upcoming[0]
                ? `${formatDate(upcoming[0].date)} · ${upcoming[0].start_time}–${upcoming[0].end_time}`
                : "No upcoming bookings"
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bp-card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="bp-eyebrow">RECENT COMPLAINTS</p>
              <Link to="/resident/complaints" className="text-xs text-signal hover:text-signal-soft">
                View all
              </Link>
            </div>
            {openComplaints.length === 0 ? (
              <p className="text-sm text-ink-500 italic">No open complaints.</p>
            ) : (
              <div className="space-y-2">
                {openComplaints.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    className="p-3 border border-blueprint-700 bg-blueprint-900/50 rounded-xs flex justify-between items-center text-xs font-mono"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="font-semibold text-ink-100 truncate">{c.title}</p>
                      <p className="text-[10px] text-ink-500">
                        {labelFor(COMPLAINT_CATEGORY_LABELS, c.category)} ·{" "}
                        {formatDate(c.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bp-card p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="bp-eyebrow">LATEST ANNOUNCEMENT</p>
                <Link
                  to="/resident/announcements"
                  className="text-xs text-signal hover:text-signal-soft"
                >
                  View all
                </Link>
              </div>
              {latest ? (
                <div onClick={() => setSelected(latest)} className="cursor-pointer">
                  <p className="text-sm font-medium text-ink-100 mb-1">{latest.title}</p>
                  <p className="text-sm text-ink-300 leading-relaxed line-clamp-3">{latest.body}</p>
                </div>
              ) : (
                <p className="text-sm text-ink-500 italic">No announcements posted.</p>
              )}
            </div>
            {latest && (
              <div className="mt-3 flex justify-between items-center text-xs font-mono text-ink-500">
                <span>{formatDateTime(latest.created_at)}</span>
                <button
                  onClick={() => setSelected(latest)}
                  className="text-[10px] text-signal font-medium uppercase tracking-wider"
                >
                  [View]
                </button>
              </div>
            )}
          </div>
        </div>

        {upcoming.length > 0 && (
          <div className="mb-8">
            <p className="bp-eyebrow mb-3">UPCOMING BOOKINGS</p>
            <div className="bp-card divide-y divide-blueprint-700">
              {upcoming.slice(0, 3).map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between px-5 py-3 text-sm"
                >
                  <span className="text-ink-100">{booking.facility_name}</span>
                  <span className="font-mono text-xs text-ink-300">
                    {formatDate(booking.date)} · {booking.start_time}–{booking.end_time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!pendingInvoice && openComplaints.length === 0 && upcoming.length === 0 && !latest && (
          <EmptyState
            title="Nothing needs your attention"
            hint="Dues, complaints and bookings will appear here as they come in."
          />
        )}
      </QueryState>

      <div className="bp-dimline" />

      <div className="grid grid-cols-4 gap-4 mt-6">
        <Link to="/resident/complaints/raise" className="btn-secondary py-3">
          Raise Complaint
        </Link>
        <Link to="/resident/bookings/calendar" className="btn-secondary py-3">
          Book Facility
        </Link>
        <Link to="/resident/visitors/guest-pass" className="btn-secondary py-3">
          Guest Pass
        </Link>
        <Link
          to="/resident/sos"
          className="btn-secondary py-3 border-red-500/40 text-red-400 hover:border-red-400 hover:text-red-300"
        >
          Emergency SOS
        </Link>
      </div>

      {selected && (
        <AnnouncementDetailModal announcement={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
