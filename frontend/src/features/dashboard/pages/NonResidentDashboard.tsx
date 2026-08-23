import { Link } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import { QueryState } from "../../../components/QueryState";
import { useNonResidentDashboard } from "../../../api/dashboard";
import { formatCurrency, formatDate } from "../../../lib/format";

export default function NonResidentDashboard() {
  const dashboard = useNonResidentDashboard();

  const pendingInvoice = dashboard.data?.pending_invoice ?? null;
  const openComplaints = dashboard.data?.open_complaints ?? [];
  const latest = dashboard.data?.latest_announcements?.[0] ?? null;

  return (
    <div>
      <PageHeader
        code="D-03 / NON-RESIDENT DASHBOARD"
        title="Manage your property remotely"
        description="Track dues, complaint status, and society updates from anywhere."
      />

      <QueryState
        isLoading={dashboard.isPending}
        error={dashboard.error}
        onRetry={() => dashboard.refetch()}
        loadingLabel="Loading your property summary…"
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
          <StatCard label="Open Complaints" value={String(openComplaints.length)} />
          {/* The previous version read announcements[0].title unconditionally,
              which throws on an empty feed. */}
          <StatCard
            label="Latest Announcement"
            value={latest ? latest.title : "None"}
            hint={latest ? formatDate(latest.created_at) : "Nothing posted yet"}
          />
        </div>
      </QueryState>

      <div className="grid grid-cols-3 gap-4">
        <Link to="/non-resident/property-status" className="btn-secondary py-3">
          Property Status
        </Link>
        <Link to="/non-resident/guest-pass" className="btn-secondary py-3">
          Guest Pass
        </Link>
        <Link to="/non-resident/announcements" className="btn-secondary py-3">
          Announcements
        </Link>
      </div>
    </div>
  );
}
