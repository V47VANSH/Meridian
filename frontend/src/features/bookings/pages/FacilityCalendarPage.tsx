import { useState, useEffect } from "react";
import PageHeader from "../../../components/PageHeader";
import { bookings, notifyMockDataChanged } from "../../../api/mockData";
import { useAuthStore } from "../../../store/authStore";
import { api } from "../../../api/client";

interface BackendFacility {
  id: string;
  name: string;
}

interface BackendSlot {
  id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  is_bookable: boolean;
  date: string;
}

export default function FacilityCalendarPage() {
  const { user } = useAuthStore();
  const [facilities, setFacilities] = useState<BackendFacility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [slots, setSlots] = useState<BackendSlot[]>([]);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  // Fetch all facilities on mount
  useEffect(() => {
    api.get("/v1/facilities")
      .then((res: any) => {
        const items: BackendFacility[] = Array.isArray(res) ? res : (res?.data ?? []);
        setFacilities(items);
        if (items.length > 0) setSelectedFacilityId(items[0].id);
      })
      .catch(() => undefined);
  }, []);

  // Fetch slots whenever facility or date changes
  useEffect(() => {
    if (!selectedFacilityId) return;
    setLoadingSlots(true);
    setStatusMsg("");
    api.get(`/v1/facilities/${selectedFacilityId}/slots?date=${date}`)
      .then((res: any) => {
        const items: BackendSlot[] = Array.isArray(res) ? res : (res?.data ?? []);
        setSlots(items);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedFacilityId, date]);

  const handleBook = async (slot: BackendSlot) => {
    if (!slot.is_available) return;
    setBookingId(slot.id);
    setStatusMsg("");
    try {
      const res: any = await api.post("/v1/bookings", { slot_id: slot.id });
      // Add to local bookings store so MyBookingsPage & ScheduleManagement update
      const facility = facilities.find((f) => f.id === selectedFacilityId);
      bookings.unshift({
        id: res.id ?? `BK-${Date.now()}`,
        facility: facility?.name ?? "Facility",
        date: slot.date,
        slot: `${slot.start_time}–${slot.end_time}`,
        bookedBy: user?.name ?? "Resident",
        flatNo: user?.flatNo ?? "B-304",
      });
      notifyMockDataChanged();
      setStatusMsg(`✓ Booked ${slot.start_time}–${slot.end_time}`);
      // Refresh slots to show updated availability
      const refreshed: any = await api.get(`/v1/facilities/${selectedFacilityId}/slots?date=${date}`);
      const refreshedItems: BackendSlot[] = Array.isArray(refreshed) ? refreshed : (refreshed?.data ?? []);
      setSlots(refreshedItems);
    } catch (err: any) {
      setStatusMsg(err?.message ?? "Booking failed. Slot may already be taken.");
    } finally {
      setBookingId(null);
    }
  };

  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId);

  return (
    <div>
      <PageHeader
        code="B-01 / FACILITY CALENDAR"
        title="Book a Shared Facility"
        description="Pick a slot to avoid overcrowding — bookings update live for everyone viewing this grid."
      />

      <div className="flex gap-4 mb-6">
        <select
          value={selectedFacilityId}
          onChange={(e) => setSelectedFacilityId(e.target.value)}
          className="input-field w-48"
        >
          {facilities.length === 0 && <option value="">Loading…</option>}
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field w-48" />
      </div>

      {statusMsg && (
        <div className={`mb-4 text-sm px-4 py-2 rounded-sm border font-mono ${
          statusMsg.startsWith("✓")
            ? "border-signal/40 bg-signal/10 text-signal"
            : "border-red-500/40 bg-red-500/10 text-red-400"
        }`}>
          {statusMsg}
        </div>
      )}

      <div className="bp-card p-5">
        {loadingSlots ? (
          <p className="text-center text-ink-500 font-mono py-8">Loading slots…</p>
        ) : slots.length === 0 ? (
          <p className="text-center text-ink-500 font-mono py-8">
            No slots published for {selectedFacility?.name ?? "this facility"} on {date}.<br />
            <span className="text-xs">The society official needs to publish slots first.</span>
          </p>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {slots.map((slot) => {
              const taken = !slot.is_available;
              const isBooking = bookingId === slot.id;
              return (
                <button
                  key={slot.id}
                  disabled={taken || isBooking}
                  onClick={() => handleBook(slot)}
                  className={`rounded-sm border px-3 py-4 text-center text-sm transition ${
                    taken
                      ? "border-blueprint-700 bg-blueprint-900 text-ink-500 cursor-not-allowed"
                      : isBooking
                      ? "border-signal/40 bg-signal/10 text-signal cursor-wait"
                      : "border-blueprint-600 hover:border-signal hover:text-signal"
                  }`}
                >
                  {slot.start_time}–{slot.end_time}
                  <span className="block mt-1 text-[11px] font-mono text-ink-500">
                    {isBooking ? "Booking…" : taken ? "Booked" : "Available"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
