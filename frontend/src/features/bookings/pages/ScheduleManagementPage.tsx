import { useState, useEffect } from "react";
import PageHeader from "../../../components/PageHeader";
import { facilities, bookings, useMockData, Booking, syncBookingsFromBackend } from "../../../api/mockData";
import { api } from "../../../api/client";
import BookingDetailModal from "../../../components/modals/BookingDetailModal";

export default function ScheduleManagementPage() {
  useMockData();
  const [searchFlat, setSearchFlat] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    // Fetch all bookings (officials get mine=false scope)
    api.get("/v1/bookings?mine=false")
      .then((res: any) => {
        const items = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(items)) syncBookingsFromBackend(items);
      })
      .catch(() => undefined);
  }, []);

  const filteredBookings = bookings.filter((b) => {
    return !searchFlat || b.flatNo.toLowerCase().includes(searchFlat.trim().toLowerCase());
  });

  return (
    <div>
      <PageHeader
        code="B-03 / SCHEDULE MANAGEMENT"
        title="Facility Booking Schedule"
        description="Shared schedule across all facilities — prevents double bookings (Story 3.3)."
      />

      {/* Flat Search Filter */}
      <div className="mb-5 flex gap-4 items-center justify-between text-xs font-mono">
        <div className="relative w-80 flex items-center gap-2">
          <span className="text-ink-500 whitespace-nowrap">Filter Flat:</span>
          <input
            value={searchFlat}
            onChange={(e) => setSearchFlat(e.target.value)}
            placeholder="e.g. B-304"
            className="input-field text-xs py-1 px-2 border-blueprint-750 focus:border-signal"
          />
        </div>
        <span className="text-ink-500">Reservations scheduled: {filteredBookings.length}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {facilities.map((f) => {
          const rows = filteredBookings.filter((b) => b.facility === f.name);
          return (
            <div key={f.id} className="bp-card p-5">
              <p className="bp-eyebrow mb-3">{f.name}</p>
              {rows.length === 0 ? (
                <p className="text-sm text-ink-500">No bookings scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((b) => (
                    <li
                      key={b.id}
                      onClick={() => setSelectedBooking(b)}
                      className="flex justify-between items-center text-sm hover:bg-blueprint-700/30 p-1 rounded-sm cursor-pointer transition"
                    >
                      <span className="text-ink-300 font-medium">{b.date} · {b.slot}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-ink-500 text-xs font-mono">{b.flatNo}</span>
                        <span className="text-[10px] text-signal font-mono uppercase tracking-wider font-medium opacity-0 hover:opacity-100 transition-opacity">
                          [Details]
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Booking Detail Modal Overlay */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
}
