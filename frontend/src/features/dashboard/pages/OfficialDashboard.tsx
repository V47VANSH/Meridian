import { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import StatusBadge from "../../../components/StatusBadge";
import { complaints, invoices, residents, bookings, useMockData, Resident } from "../../../api/mockData";
import ComplaintDetailModal from "../../../components/modals/ComplaintDetailModal";
import ResidentDetailModal from "../../../components/modals/ResidentDetailModal";

export default function OfficialDashboard() {
  useMockData();
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);

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
              <li
                key={c.id}
                onClick={() => setSelectedComplaintId(c.id)}
                className="flex items-center justify-between text-sm hover:bg-blueprint-700/30 p-1.5 rounded-sm cursor-pointer transition"
              >
                <div className="min-w-0 pr-3">
                  <p className="text-ink-100 truncate font-medium">{c.title}</p>
                  <p className="text-xs text-ink-500 font-mono mt-0.5">{c.flatNo}</p>
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
              <li
                key={r.flatNo}
                onClick={() => setSelectedResident(r)}
                className="flex items-center justify-between text-sm hover:bg-blueprint-700/30 p-1.5 rounded-sm cursor-pointer transition"
              >
                <span className="text-ink-100 font-medium">{r.flatNo} — {r.name}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.duesStatus} />
                  <span className="text-[10px] text-signal font-mono uppercase tracking-wider font-medium opacity-0 hover:opacity-100 transition-opacity">
                    [Profile]
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Complaint Detail Modal overlay */}
      {selectedComplaintId && (
        <ComplaintDetailModal
          complaintId={selectedComplaintId}
          onClose={() => setSelectedComplaintId(null)}
        />
      )}

      {/* Resident Detail Modal overlay */}
      {selectedResident && (
        <ResidentDetailModal
          resident={selectedResident}
          onClose={() => setSelectedResident(null)}
        />
      )}
    </div>
  );
}
