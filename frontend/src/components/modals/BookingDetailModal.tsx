import { useQuery } from "@tanstack/react-query";
import StatusBadge from "../StatusBadge";
import { ErrorBanner, LoadingState } from "../QueryState";
import { api } from "../../api/client";
import { bookingKeys, useCancelBooking } from "../../api/bookings";
import { useUserNames } from "../../api/directory";
import { formatDate, formatDateTime } from "../../lib/format";
import type { Booking } from "../../api/types";

interface BookingDetailModalProps {
  bookingId: string;
  onClose: () => void;
}

export default function BookingDetailModal({ bookingId, onClose }: BookingDetailModalProps) {
  const {
    data: booking,
    isPending,
    error,
  } = useQuery({
    queryKey: [...bookingKeys.all, "detail", bookingId],
    queryFn: () => api.get<Booking>(`/v1/bookings/${bookingId}`),
  });

  const userName = useUserNames();
  const cancelBooking = useCancelBooking();

  const isCancelled = booking?.status === "CANCELLED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-blueprint-950/80 backdrop-blur-xs" />

      <div className="relative w-full max-w-md bg-blueprint-900 border border-blueprint-700 p-6 rounded-sm shadow-2xl bp-canvas z-10">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-blueprint-500" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-blueprint-500" />

        <div className="flex justify-between items-start border-b border-blueprint-700 pb-3 mb-4">
          <div>
            <p className="bp-eyebrow font-mono text-[10px] tracking-wider text-signal">
              RESERVATION INFO
            </p>
            <h3 className="font-display font-semibold text-base text-ink-100 mt-1">
              {booking?.facility_name ?? "Facility"} Slot
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-500 hover:text-signal font-mono text-sm leading-none p-1"
          >
            [×] Close
          </button>
        </div>

        {isPending && <LoadingState label="Loading reservation…" />}
        {error && <ErrorBanner error={error} />}

        {booking && (
          <>
            <div className="border border-blueprint-700 p-3 rounded-xs bg-blueprint-950/40 font-mono text-xs mb-4 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-ink-500">Booking:</span>
                <span className="text-ink-100">{booking.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Booked by:</span>
                <span className="text-ink-100 font-semibold">{userName(booking.booked_by)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Date:</span>
                <span className="text-ink-100 font-semibold">{formatDate(booking.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Time Slot:</span>
                <span className="text-ink-100 font-semibold">
                  {booking.start_time}–{booking.end_time}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ink-500">Status:</span>
                <StatusBadge status={booking.status} />
              </div>
              {booking.cancelled_at && (
                <div className="flex justify-between">
                  <span className="text-ink-500">Cancelled:</span>
                  <span className="text-ink-100">{formatDateTime(booking.cancelled_at)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-blueprint-700 pt-4">
              <ErrorBanner error={cancelBooking.error} />
              {isCancelled ? (
                <p className="text-xs font-mono text-ink-500 text-center py-2">
                  This reservation is already cancelled and its slot is free again.
                </p>
              ) : (
                <>
                  {/* Cancelling releases the slot server-side. The old version
                      removed the row locally and posted a fabricated
                      announcement, so the slot stayed unbookable. */}
                  <button
                    onClick={() =>
                      cancelBooking.mutate(booking.id, { onSuccess: onClose })
                    }
                    disabled={cancelBooking.isPending}
                    className="w-full btn-primary py-1.5 text-xs bg-red-600 hover:bg-red-500 text-ink-100 border-0 disabled:opacity-50"
                  >
                    {cancelBooking.isPending
                      ? "Cancelling…"
                      : "Cancel Reservation & Release Slot"}
                  </button>
                  <p className="mt-2 text-[10px] font-mono text-ink-500 text-center">
                    The resident is notified through their bookings list.
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
