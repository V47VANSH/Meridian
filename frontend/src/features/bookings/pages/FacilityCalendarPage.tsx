import { useState } from "react";
import PageHeader from "../../../components/PageHeader";
import { facilities, timeSlots, bookings, useMockData, notifyMockDataChanged } from "../../../api/mockData";
import { useAuthStore } from "../../../store/authStore";

export default function FacilityCalendarPage() {
  useMockData();
  const { user } = useAuthStore();
  const [facility, setFacility] = useState(facilities[0].name);
  const [date, setDate] = useState(() => {
    // Default to today or tomorrow so booking validation passes
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  const takenSet = new Set(bookings.map((b) => `${b.facility}|${b.date}|${b.slot}`));

  function handleBook(slot: string) {
    const key = `${facility}|${date}|${slot}`;
    if (takenSet.has(key)) return;

    const nextId = `BK-${500 + bookings.length + 1}`;
    bookings.unshift({
      id: nextId,
      facility,
      date,
      slot,
      bookedBy: user?.name || "Resident",
      flatNo: user?.flatNo || "B-304",
    });
    notifyMockDataChanged();
  }

  return (
    <div>
      <PageHeader
        code="B-01 / FACILITY CALENDAR"
        title="Book a Shared Facility"
        description="Pick a slot to avoid overcrowding — bookings update live for everyone viewing this grid."
      />

      <div className="flex gap-4 mb-6">
        <select value={facility} onChange={(e) => setFacility(e.target.value)} className="input-field w-48">
          {facilities.map((f) => (
            <option key={f.id} value={f.name}>{f.name}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field w-48" />
      </div>

      <div className="bp-card p-5">
        <div className="grid grid-cols-5 gap-3">
          {timeSlots.map((slot) => {
            const key = `${facility}|${date}|${slot}`;
            const taken = takenSet.has(key);
            const myBooking = taken && bookings.find((b) => `${b.facility}|${b.date}|${b.slot}` === key && b.flatNo === (user?.flatNo || "B-304"));
            return (
              <button
                key={slot}
                disabled={taken}
                onClick={() => handleBook(slot)}
                className={`rounded-sm border px-3 py-4 text-center text-sm transition ${
                  taken
                    ? myBooking
                      ? "border-signal/40 bg-signal/10 text-signal cursor-not-allowed"
                      : "border-blueprint-700 bg-blueprint-900 text-ink-500 cursor-not-allowed"
                    : "border-blueprint-600 hover:border-signal hover:text-signal"
                }`}
              >
                {slot}
                <span className="block mt-1 text-[11px] font-mono text-ink-500">
                  {taken ? (myBooking ? "Your booking" : "Booked") : "Available"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
