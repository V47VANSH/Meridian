import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import StatusBadge from "../../../components/StatusBadge";
import { invoices, complaints, bookings, announcements, useMockData, Announcement, syncComplaintsFromBackend, syncAnnouncementsFromBackend, syncBookingsFromBackend, syncInvoicesFromBackend } from "../../../api/mockData";
import { useAuthStore } from "../../../store/authStore";
import { api } from "../../../api/client";
import AnnouncementDetailModal from "../../../components/modals/AnnouncementDetailModal";

export default function ResidentDashboard() {
  useMockData();
  const { user } = useAuthStore();
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    // Fetch complaints
    api.get("/v1/complaints")
      .then((res: any) => {
        const items = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(items)) syncComplaintsFromBackend(items, user);
      })
      .catch(() => undefined);

    // Fetch announcements
    api.get("/v1/announcements")
      .then((res: any) => {
        const items = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(items)) syncAnnouncementsFromBackend(items);
      })
      .catch(() => undefined);

    // Fetch bookings
    api.get("/v1/bookings")
      .then((res: any) => {
        const items = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(items)) syncBookingsFromBackend(items, user);
      })
      .catch(() => undefined);

    // Fetch invoices
    api.get("/v1/maintenance/invoices")
      .then((res: any) => {
        const items = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(items)) syncInvoicesFromBackend(items, user);
      })
      .catch(() => undefined);
  }, [user]);


  const pendingInvoice = invoices.find((i) => i.status !== "PAID");
  const openComplaints = complaints.filter((c) => c.status !== "RESOLVED");
  const upcomingBooking = bookings[0];

  return (
    <div>
      <PageHeader
        code="D-01 / RESIDENT DASHBOARD"
        title="Your society, at a glance"
        description="Payments, complaints, and bookings in one view."
      />

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Maintenance Due"
          value={pendingInvoice ? `₹${pendingInvoice.amount}` : "All clear"}
          hint={pendingInvoice ? `Due ${pendingInvoice.dueDate}` : "No dues pending"}
        />
        <StatCard label="Open Complaints" value={String(openComplaints.length)} hint="Across all categories" />
        <StatCard
          label="Next Booking"
          value={upcomingBooking ? upcomingBooking.facility : "None"}
          hint={upcomingBooking ? `${upcomingBooking.date} · ${upcomingBooking.slot}` : "No upcoming bookings"}
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
          <div className="space-y-2">
            {complaints.slice(0, 3).map((c) => (
              <div key={c.id} className="p-3 border border-blueprint-700 bg-blueprint-900/50 rounded-xs flex justify-between items-center text-xs font-mono">
                <div>
                  <p className="font-semibold text-ink-100">{c.title}</p>
                  <p className="text-[10px] text-ink-500">{c.id} · {c.category}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        </div>

        <div
          onClick={() => announcements[0] && setSelectedAnnouncement(announcements[0])}
          className="bp-card p-5 cursor-pointer hover:border-signal/50 transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4" onClick={(e) => e.stopPropagation()}>
              <p className="bp-eyebrow">LATEST ANNOUNCEMENT</p>
              <Link to="/resident/announcements" className="text-xs text-signal hover:text-signal-soft">
                View all
              </Link>
            </div>
            {announcements[0] ? (
              <>
                <p className="text-sm font-medium text-ink-100 mb-1">{announcements[0].title}</p>
                <p className="text-sm text-ink-300 leading-relaxed line-clamp-3">{announcements[0].body}</p>
              </>
            ) : (
              <p className="text-sm text-ink-500 italic">No announcements posted.</p>
            )}
          </div>
          {announcements[0] && (
            <div className="mt-3 flex justify-between items-center text-xs font-mono text-ink-500">
              <span>{announcements[0].postedAt}</span>
              <span className="text-[10px] text-signal font-medium uppercase tracking-wider">[View & Comment]</span>
            </div>
          )}
        </div>
      </div>

      <div className="bp-dimline" />

      <div className="grid grid-cols-4 gap-4 mt-6">
        <Link to="/resident/complaints/raise" className="btn-secondary py-3">Raise Complaint</Link>
        <Link to="/resident/bookings/calendar" className="btn-secondary py-3">Book Facility</Link>
        <Link to="/resident/visitors/guest-pass" className="btn-secondary py-3">Guest Pass</Link>
        <Link to="/resident/sos" className="btn-secondary py-3 border-red-500/40 text-red-400 hover:border-red-400 hover:text-red-300">
          Emergency SOS
        </Link>
      </div>

      {/* Announcement Detail Popup overlay */}
      {selectedAnnouncement && (
        <AnnouncementDetailModal
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
        />
      )}
    </div>
  );
}
