import { useEffect, useMemo, useState, type FormEvent } from "react";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { ErrorBanner, QueryState } from "../../../components/QueryState";
import BookingDetailModal from "../../../components/modals/BookingDetailModal";
import {
  useBookings,
  useCreateSlot,
  useFacilities,
  useSlots,
  useUpdateSlot,
} from "../../../api/bookings";
import { useUserNames } from "../../../api/directory";
import { formatDate, toDateInput } from "../../../lib/format";

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toDateInput(date.toISOString());
}

export default function ScheduleManagementPage() {
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [date, setDate] = useState(tomorrow);
  const [search, setSearch] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const facilities = useFacilities();
  const slots = useSlots(facilityId, date);
  // Officials may widen the view past their own bookings; the backend narrows
  // it back for any other role.
  const bookings = useBookings(false);
  const userName = useUserNames();

  const createSlot = useCreateSlot();
  const updateSlot = useUpdateSlot();

  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:00");

  useEffect(() => {
    if (!facilityId && facilities.data && facilities.data.length > 0) {
      setFacilityId(facilities.data[0].id);
    }
  }, [facilities.data, facilityId]);

  /**
   * Bookings grouped under the facility they belong to.
   *
   * The previous version iterated a fixture list of five facility names and
   * matched bookings by name, so the society's real facilities were invisible
   * unless their names happened to coincide, and three cards were permanently
   * empty.
   */
  const byFacility = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = (bookings.data ?? []).filter(
      (b) => !term || userName(b.booked_by).toLowerCase().includes(term),
    );
    const groups = new Map<string, typeof rows>();
    for (const facility of facilities.data ?? []) groups.set(facility.name, []);
    for (const booking of rows) {
      const key = booking.facility_name ?? "Facility";
      groups.set(key, [...(groups.get(key) ?? []), booking]);
    }
    return [...groups.entries()];
  }, [bookings.data, facilities.data, search, userName]);

  const visibleCount = byFacility.reduce((total, [, rows]) => total + rows.length, 0);

  async function handlePublish(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) return;
    await createSlot.mutateAsync({
      facilityId,
      date,
      start_time: startTime,
      end_time: endTime,
      is_bookable: true,
    });
  }

  return (
    <div>
      <PageHeader
        code="B-03 / SCHEDULE MANAGEMENT"
        title="Facility Booking Schedule"
        description="Publish bookable slots and review reservations across every facility (Story 3.3)."
      />

      {/* Publishing was missing entirely: residents were told to wait for an
          official to publish slots, and no screen could do it. */}
      <div className="bp-card p-5 mb-6">
        <p className="bp-eyebrow mb-4">PUBLISH A SLOT</p>
        <form onSubmit={handlePublish} className="grid grid-cols-5 gap-4 items-end">
          <div>
            <label className="label-field">Facility</label>
            <select
              className="input-field"
              value={facilityId ?? ""}
              onChange={(e) => setFacilityId(e.target.value)}
            >
              {(facilities.data ?? []).map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Date</label>
            <input
              type="date"
              className="input-field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field">Start</label>
            <input
              type="time"
              className="input-field"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field">End</label>
            <input
              type="time"
              className="input-field"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary text-xs" disabled={createSlot.isPending}>
            {createSlot.isPending ? "Publishing…" : "Publish Slot"}
          </button>
        </form>

        <div className="mt-4 space-y-3">
          <ErrorBanner error={createSlot.error ?? updateSlot.error} />

          <div>
            <p className="bp-eyebrow mb-2">SLOTS ON {date}</p>
            {slots.isPending ? (
              <p className="text-xs font-mono text-ink-500">Loading slots…</p>
            ) : (slots.data ?? []).length === 0 ? (
              <p className="text-xs font-mono text-ink-500">Nothing published for this day yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(slots.data ?? []).map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center gap-2 rounded-sm border border-blueprint-700 px-3 py-1.5 text-xs font-mono"
                  >
                    <span className="text-ink-100">
                      {slot.start_time}–{slot.end_time}
                    </span>
                    <span className="text-ink-500">
                      {!slot.is_available ? "booked" : slot.is_bookable ? "open" : "blocked"}
                    </span>
                    {/* A booked slot cannot be freed by blocking it; the
                        booking has to be cancelled instead. */}
                    {slot.is_available && (
                      <button
                        className="text-signal hover:underline"
                        disabled={updateSlot.isPending}
                        onClick={() =>
                          updateSlot.mutate({
                            facilityId: facilityId as string,
                            slotId: slot.id,
                            isBookable: !slot.is_bookable,
                          })
                        }
                      >
                        {slot.is_bookable ? "block" : "unblock"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-5 flex gap-4 items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 w-80">
          <span className="text-ink-500 whitespace-nowrap">Filter resident:</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. Arjun"
            className="input-field text-xs py-1 px-2"
          />
        </div>
        <span className="text-ink-500">Reservations scheduled: {visibleCount}</span>
      </div>

      <QueryState
        isLoading={bookings.isPending}
        error={bookings.error}
        onRetry={() => bookings.refetch()}
        loadingLabel="Loading reservations…"
      >
        {byFacility.length === 0 ? (
          <EmptyState title="No facilities registered yet" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {byFacility.map(([name, rows]) => (
              <div key={name} className="bp-card p-5">
                <p className="bp-eyebrow mb-3">{name}</p>
                {rows.length === 0 ? (
                  <p className="text-sm text-ink-500">No bookings scheduled.</p>
                ) : (
                  <ul className="space-y-2">
                    {rows.map((booking) => (
                      <li
                        key={booking.id}
                        onClick={() => setSelectedBookingId(booking.id)}
                        className="flex justify-between items-center text-sm hover:bg-blueprint-700/30 p-1 rounded-sm cursor-pointer transition"
                      >
                        <span className="text-ink-300 font-medium">
                          {formatDate(booking.date)} · {booking.start_time}–{booking.end_time}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-ink-500 text-xs font-mono">
                            {userName(booking.booked_by)}
                          </span>
                          <StatusBadge status={booking.status} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </QueryState>

      {selectedBookingId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
        />
      )}
    </div>
  );
}
