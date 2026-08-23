import PageHeader from "../../../components/PageHeader";
import EmptyState from "../../../components/EmptyState";
import StatusBadge from "../../../components/StatusBadge";
import { ErrorBanner, QueryState } from "../../../components/QueryState";
import { useBookings, useCancelBooking } from "../../../api/bookings";
import { formatDate } from "../../../lib/format";

export default function MyBookingsPage() {
  // `mine` is the default, so this is the caller's own bookings — not the
  // society-wide list the page used to render from a shared array.
  const bookings = useBookings(true);
  const cancelBooking = useCancelBooking();

  const rows = bookings.data ?? [];

  return (
    <div>
      <PageHeader code="B-02 / MY BOOKINGS" title="My Facility Bookings" />

      <div className="mb-4">
        <ErrorBanner error={cancelBooking.error} />
      </div>

      <QueryState
        isLoading={bookings.isPending}
        error={bookings.error}
        onRetry={() => bookings.refetch()}
        loadingLabel="Loading your bookings…"
      >
        {rows.length === 0 ? (
          <EmptyState title="No bookings yet" hint="Book a slot from the Facility Calendar." />
        ) : (
          <div className="bp-card divide-y divide-blueprint-700">
            {rows.map((booking) => {
              const isCancelled = booking.status === "CANCELLED";
              return (
                <div key={booking.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm text-ink-100">{booking.facility_name ?? "Facility"}</p>
                    <p className="text-xs font-mono text-ink-500">{booking.id}</p>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="text-right text-sm text-ink-300">
                      <p>{formatDate(booking.date)}</p>
                      <p className="text-xs text-ink-500">
                        {booking.start_time}–{booking.end_time}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} />
                    {/* Cancelling an already-cancelled booking is a 409, so the
                        control is only offered while it can succeed. */}
                    {!isCancelled && (
                      <button
                        onClick={() => cancelBooking.mutate(booking.id)}
                        disabled={cancelBooking.isPending}
                        className="btn-secondary py-1 px-2.5 text-xs border-red-500/30 text-red-400 hover:border-red-400 hover:text-red-300"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </QueryState>
    </div>
  );
}
