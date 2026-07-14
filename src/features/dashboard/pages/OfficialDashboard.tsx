import { Link } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import StatusBadge from "../../../components/StatusBadge";
import { complaints, invoices, residents, bookings } from "../../../api/mockData";

export default function OfficialDashboard() {
  const openComplaints = complaints.filter((c) => c.status !== "RESOLVED");
  const overdue = invoices.filter((i) => i.status === "OVERDUE");
  const pendingDues = residents.filter((r) => r.duesStatus === "PENDING");

  return (
    <div>
      <PageHeader
        code="D-02 / OFFICIAL DASHBOARD"
        title="Centralized society records"
        description="Payments, complaints, bookings, and residents from one place."
      />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Open Complaints" value={String(openComplaints.length)} />
        <StatCard label="Overdue Invoices" value={String(overdue.length)} />
        <StatCard label="Residents w/ Pending Dues" value={String(pendingDues.length)} />
        <StatCard label="Bookings This Week" value={String(bookings.length)} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bp-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="bp-eyebrow">C-03 / COMPLAINT TRIAGE QUEUE</p>
            <Link to="/official/complaints/triage" className="text-xs text-signal hover:text-signal-soft">
              Open queue
            </Link>
          </div>
          <ul className="space-y-3">
            {complaints.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0 pr-3">
                  <p className="text-ink-100 truncate">{c.title}</p>
                  <p className="text-xs text-ink-500">{c.flatNo}</p>
                </div>
                <StatusBadge status={c.urgency} />
              </li>
            ))}
          </ul>
        </div>

        <div className="bp-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="bp-eyebrow">R-01 / RESIDENT DUES</p>
            <Link to="/official/residents" className="text-xs text-signal hover:text-signal-soft">
              View directory
            </Link>
          </div>
          <ul className="space-y-3">
            {residents.map((r) => (
              <li key={r.flatNo} className="flex items-center justify-between text-sm">
                <span className="text-ink-100">{r.flatNo} — {r.name}</span>
                <StatusBadge status={r.duesStatus} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
