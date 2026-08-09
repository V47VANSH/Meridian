import { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import StatusBadge from "../../../components/StatusBadge";
import { invoices, complaints, bookings, announcements, useMockData, Announcement } from "../../../api/mockData";
import AnnouncementDetailModal from "../../../components/modals/AnnouncementDetailModal";

export default function ResidentDashboard() {
  useMockData();
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

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
            <p className="bp-eyebrow">C-02 / RECENT COMPLAINTS</p>
            <Link to="/resident/complaints" className="text-xs text-signal hover:text-signal-soft">
              View all
            </Link>
          </div>
          <ul className="space-y-3">
            {complaints.slice(0, 3).map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-100 truncate pr-3">{c.title}</span>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        </div>

        <div
          onClick={() => announcements[0] && setSelectedAnnouncement(announcements[0])}
          className="bp-card p-5 cursor-pointer hover:border-signal/50 transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4" onClick={(e) => e.stopPropagation()}>
              <p className="bp-eyebrow">A-01 / LATEST ANNOUNCEMENT</p>
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
