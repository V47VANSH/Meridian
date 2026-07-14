import { useState } from "react";
import { Booking, bookings, residents, announcements, notifyMockDataChanged } from "../../api/mockData";
import StatusBadge from "../StatusBadge";

interface BookingDetailModalProps {
  booking: Booking;
  onClose: () => void;
}

export default function BookingDetailModal({ booking, onClose }: BookingDetailModalProps) {
  const [reason, setReason] = useState("");
  const resident = residents.find((r) => r.flatNo === booking.flatNo);

  const handleCancelBooking = () => {
    const idx = bookings.findIndex((b) => b.id === booking.id);
    if (idx !== -1) {
      // Remove reservation
      bookings.splice(idx, 1);

      // Post notification to announcement feed
      announcements.unshift({
        id: `ANN-${Math.floor(40 + Math.random() * 20)}`,
        title: `CANCELLED: ${booking.facility} Reservation`,
        body: `Notice for Flat ${booking.flatNo}: Your reservation for the ${booking.facility} on ${booking.date} (${booking.slot}) has been cancelled by the society office. Reason: "${reason || "Scheduling conflict/maintenance"}".`,
        postedBy: "Society Management",
        postedAt: new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
      });

      notifyMockDataChanged();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-blueprint-950/80 backdrop-blur-xs"></div>

      {/* Modal Box */}
      <div className="relative w-full max-w-md bg-blueprint-900 border border-blueprint-700 p-6 rounded-sm shadow-2xl bp-canvas z-10">
        {/* Drafting corner ticks */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-blueprint-500"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-blueprint-500"></div>

        {/* Header */}
        <div className="flex justify-between items-start border-b border-blueprint-700 pb-3 mb-4">
          <div>
            <p className="bp-eyebrow font-mono text-[10px] tracking-wider text-signal">{booking.id} / RESERVATION INFO</p>
            <h3 className="font-display font-semibold text-base text-ink-100 mt-1">{booking.facility} Slot</h3>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-signal font-mono text-sm leading-none p-1">
            [×] Close
          </button>
        </div>

        {/* Booking Details */}
        <div className="border border-blueprint-700 p-3 rounded-xs bg-blueprint-950/40 font-mono text-xs mb-4 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-ink-500">Date:</span>
            <span className="text-ink-100 font-semibold">{booking.date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Time Slot:</span>
            <span className="text-ink-100 font-semibold">{booking.slot}</span>
          </div>
        </div>

        {/* Resident profile details */}
        <div className="mb-5 border border-blueprint-700/60 p-3.5 rounded-xs bg-blueprint-950/20 text-xs font-body">
          <p className="font-mono text-[9px] uppercase tracking-wider text-ink-500 mb-2 font-bold">Resident Profile</p>
          {resident ? (
            <div className="space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-ink-500">Name:</span>
                <span className="text-ink-100">{resident.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Flat Code:</span>
                <span className="text-ink-100">{resident.flatNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Contact:</span>
                <span className="text-ink-100">{resident.contact}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Type:</span>
                <span className="text-ink-100">{resident.type}</span>
              </div>
              <div className="flex justify-between items-center pt-0.5">
                <span className="text-ink-500">Dues Status:</span>
                <StatusBadge status={resident.duesStatus} />
              </div>
            </div>
          ) : (
            <p className="text-ink-500 font-mono italic">No associated resident found for flat {booking.flatNo}.</p>
          )}
        </div>

        {/* Cancel Booking Form */}
        <div className="border-t border-blueprint-700 pt-4 bg-blueprint-950/40 -mx-6 -mb-6 p-6 rounded-b-sm">
          <p className="bp-eyebrow text-[10px] mb-2.5">Cancel Reservation</p>
          <div className="space-y-3">
            <div>
              <label className="label-field text-[10px]">Reason of Cancellation</label>
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field py-1 text-xs"
                placeholder="e.g. Facility closed for repair work"
              />
            </div>
            <button
              onClick={handleCancelBooking}
              disabled={!reason}
              className="w-full btn-primary py-1.5 text-xs bg-red-600 hover:bg-emerald-500 text-ink-100 border-0 disabled:opacity-50 disabled:pointer-events-none"
            >
              Cancel Reservation & Notify Resident
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
