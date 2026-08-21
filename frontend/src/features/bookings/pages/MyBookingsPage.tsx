import { useEffect } from "react";
import PageHeader from "../../../components/PageHeader";
import EmptyState from "../../../components/EmptyState";
import { bookings, useMockData, notifyMockDataChanged, syncBookingsFromBackend } from "../../../api/mockData";
import { useAuthStore } from "../../../store/authStore";
import { api } from "../../../api/client";

export default function MyBookingsPage() {
  useMockData();
  const { user } = useAuthStore();

  useEffect(() => {
    api.get("/v1/bookings")
      .then((res: any) => {
        const items = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(items)) syncBookingsFromBackend(items, user);
      })
      .catch(() => undefined);
  }, [user]);

  const handleCancel = async (id: string) => {
    try {
      // Try backend cancel first
      await api.post(`/v1/bookings/${id}/cancel`);
    } catch {
      // Backend might not have this booking (legacy mock entry); continue with local removal
    }
    // Always remove from local store
    const idx = bookings.findIndex((b) => b.id === id);
    if (idx !== -1) {
      bookings.splice(idx, 1);
      notifyMockDataChanged();
    }
  };

  return (
    <div>
      <PageHeader code="B-02 / MY BOOKINGS" title="My Facility Bookings" />
      {bookings.length === 0 ? (
        <EmptyState title="No bookings yet" hint="Book a slot from the Facility Calendar." />
      ) : (
        <div className="bp-card divide-y divide-blueprint-700">
          {bookings.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm text-ink-100">{b.facility}</p>
                <p className="text-xs font-mono text-ink-500">{b.id}</p>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right text-sm text-ink-300">
                  <p>{b.date}</p>
                  <p className="text-xs text-ink-500">{b.slot}</p>
                </div>
                <button
                  onClick={() => handleCancel(b.id)}
                  className="btn-secondary py-1 px-2.5 text-xs border-red-500/30 text-red-400 hover:border-red-400 hover:text-red-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
