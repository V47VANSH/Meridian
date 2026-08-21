import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import StatusBadge from "../../../components/StatusBadge";
import { complaints, invoices, residents, bookings, useMockData, Resident, syncComplaintsFromBackend, syncAnnouncementsFromBackend } from "../../../api/mockData";
import { api } from "../../../api/client";
import ComplaintDetailModal from "../../../components/modals/ComplaintDetailModal";
import ResidentDetailModal from "../../../components/modals/ResidentDetailModal";

export default function OfficialDashboard() {
  useMockData();
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);

  useEffect(() => {
    api.get("/v1/complaints")
      .then((res: any) => {
        // apiFetch returns parsed JSON directly — not wrapped in { data }
        const items = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(items)) syncComplaintsFromBackend(items);
      })
      .catch(() => undefined);

    api.get("/v1/announcements")
      .then((res: any) => {
        const items = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(items)) syncAnnouncementsFromBackend(items);
      })
      .catch(() => undefined);
  }, []);



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
            <p className="bp-eyebrow">COMPLAINT TRIAGE QUEUE</p>
            <Link to="/official/complaints/triage" className="text-xs text-signal hover:text-signal-soft">
              Open queue
            </Link>
          </div>
          <div className="space-y-2 mt-3">
            {complaints.slice(0, 3).map((c) => (
              <div key={c.id} onClick={() => setSelectedComplaintId(c.id)} className="p-3 border border-blueprint-700 bg-blueprint-900/50 rounded-xs flex justify-between items-center text-xs font-mono cursor-pointer hover:border-signal/50">
                <div>
                  <p className="font-semibold text-ink-100">{c.title}</p>
                  <p className="text-[10px] text-ink-500">{c.flatNo} · {c.category}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="bp-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="bp-eyebrow">RESIDENT DUES</p>
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
