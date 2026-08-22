import { useEffect, useState } from "react";
import PageHeader from "../../../components/PageHeader";
import EmptyState from "../../../components/EmptyState";
import { ErrorBanner, QueryState } from "../../../components/QueryState";
import { useCreateBooking, useFacilities, useSlots } from "../../../api/bookings";
import { toDateInput } from "../../../lib/format";

/** Tomorrow, as `YYYY-MM-DD` — the day the calendar opens on. */
function defaultDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toDateInput(date.toISOString());
}

export default function FacilityCalendarPage() {
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [booked, setBooked] = useState<string | null>(null);

  const facilities = useFacilities();
  const slots = useSlots(facilityId, date);
  const createBooking = useCreateBooking();

  // Select the first facility as soon as the list arrives, so the grid is not
  // blank on load.
  useEffect(() => {
    if (!facilityId && facilities.data && facilities.data.length > 0) {
      setFacilityId(facilities.data[0].id);
    }
  }, [facilities.data, facilityId]);

  const selectedFacility = facilities.data?.find((f) => f.id === facilityId);
  const rows = slots.data ?? [];

  function handleBook(slotId: string, label: string) {
    setBooked(null);
    createBooking.mutate(slotId, { onSuccess: () => setBooked(label) });
  }

  return (
    <div>
      <PageHeader
        code="B-01 / FACILITY CALENDAR"
        title="Book a Shared Facility"
        description="Pick a slot to avoid overcrowding — availability is read live from the society's schedule."
      />

      <div className="flex gap-4 mb-6">
        <select
          value={facilityId ?? ""}
          onChange={(e) => {
            setFacilityId(e.target.value);
            setBooked(null);
          }}
          className="input-field w-48"
        >
          {facilities.isPending && <option value="">Loading…</option>}
          {(facilities.data ?? []).map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setBooked(null);
          }}
          className="input-field w-48"
        />
      </div>

      {selectedFacility?.rules && (
        <p className="mb-4 text-xs font-mono text-ink-500">{selectedFacility.rules}</p>
      )}

      <div className="mb-4 space-y-3">
        <ErrorBanner error={createBooking.error} />
        {booked && (
          <div className="rounded-sm border border-signal/40 bg-signal/10 px-4 py-2 text-sm font-mono text-signal">
            ✓ Booked {booked}
          </div>
        )}
      </div>

      <QueryState
        isLoading={facilities.isPending || slots.isPending}
        error={facilities.error ?? slots.error}
        onRetry={() => slots.refetch()}
        loadingLabel="Loading the calendar…"
      >
        <div className="bp-card p-5">
          {rows.length === 0 ? (
            <EmptyState
              title={`No slots published for ${selectedFacility?.name ?? "this facility"} on ${date}`}
              hint="A society official publishes the schedule from Booking Schedule."
            />
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {rows.map((slot) => {
                const label = `${slot.start_time}–${slot.end_time}`;
                // A slot is unavailable either because it is already booked or
                // because an official has blocked it off.
                const blocked = !slot.is_bookable;
                const taken = !slot.is_available;
                const disabled = blocked || taken || createBooking.isPending;

                return (
                  <button
                    key={slot.id}
                    disabled={disabled}
                    onClick={() => handleBook(slot.id, label)}
                    className={`rounded-sm border px-3 py-4 text-center text-sm transition ${
                      disabled
                        ? "border-blueprint-700 bg-blueprint-900 text-ink-500 cursor-not-allowed"
                        : "border-blueprint-600 hover:border-signal hover:text-signal"
                    }`}
                  >
                    {label}
                    <span className="block mt-1 text-[11px] font-mono text-ink-500">
                      {blocked ? "Blocked" : taken ? "Booked" : "Available"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </QueryState>
    </div>
  );
}
