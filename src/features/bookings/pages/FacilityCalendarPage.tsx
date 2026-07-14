import { useState } from "react";
import PageHeader from "../../../components/PageHeader";
import { facilities, timeSlots, bookings } from "../../../api/mockData";

const takenSet = new Set(bookings.map((b) => `${b.facility}|${b.date}|${b.slot}`));

export default function FacilityCalendarPage() {
  const [facility, setFacility] = useState(facilities[0].name);
  const [date, setDate] = useState("2026-07-14");
  const [confirmed, setConfirmed] = useState<string | null>(null);

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
            const taken = takenSet.has(key) || confirmed === key;
            return (
              <button
                key={slot}
                disabled={taken}
                onClick={() => setConfirmed(key)}
                className={`rounded-sm border px-3 py-4 text-center text-sm transition ${
                  taken
                    ? "border-blueprint-700 bg-blueprint-900 text-ink-500 cursor-not-allowed"
                    : "border-blueprint-600 hover:border-signal hover:text-signal"
                }`}
              >
                {slot}
                <span className="block mt-1 text-[11px] font-mono text-ink-500">
                  {taken ? "Booked" : "Available"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {confirmed && (
        <div className="bp-card mt-6 p-5 border-signal/30">
          <p className="text-sm text-signal font-medium">Booking confirmed</p>
          <p className="text-sm text-ink-300 mt-1">
            {facility} on {date}, slot {confirmed.split("|")[2]}.
          </p>
        </div>
      )}
    </div>
  );
}
