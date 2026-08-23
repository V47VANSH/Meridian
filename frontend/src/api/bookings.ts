/**
 * Facilities, their published slots, and bookings.
 *
 * A resident can only book a slot an official has published, so the two halves
 * are here together: without the official's schedule screen there is nothing
 * on the calendar for a resident to click.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Booking, Facility, Slot, SlotCreate } from "./types";

export const bookingKeys = {
  all: ["bookings"] as const,
  facilities: ["facilities"] as const,
  slots: (facilityId: string, date?: string) =>
    ["facilities", facilityId, "slots", date ?? "all"] as const,
  list: (mine: boolean) => ["bookings", "list", mine ? "mine" : "society"] as const,
};

export function listFacilities(): Promise<Facility[]> {
  return api.get<Facility[]>("/v1/facilities");
}

export function listSlots(facilityId: string, date?: string): Promise<Slot[]> {
  const suffix = date ? `?date=${date}` : "";
  return api.get<Slot[]>(`/v1/facilities/${facilityId}/slots${suffix}`);
}

export function useFacilities() {
  return useQuery({
    queryKey: bookingKeys.facilities,
    queryFn: listFacilities,
    staleTime: 5 * 60_000,
  });
}

export function useSlots(facilityId: string | null, date?: string) {
  return useQuery({
    queryKey: bookingKeys.slots(facilityId ?? "", date),
    queryFn: () => listSlots(facilityId as string, date),
    enabled: Boolean(facilityId),
  });
}

/**
 * Bookings for the caller, or the whole society when `mine` is false.
 *
 * The wider view is an official-only capability — the backend narrows the
 * query back to the caller for any other role regardless of the flag.
 */
export function useBookings(mine = true) {
  return useQuery({
    queryKey: bookingKeys.list(mine),
    queryFn: () => api.get<Booking[]>(`/v1/bookings?mine=${mine}`),
  });
}

function useInvalidateBookings() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    // Availability on the calendar changes with every booking and cancellation.
    queryClient.invalidateQueries({ queryKey: ["facilities"] });
  };
}

export function useCreateBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (slotId: string) => api.post<Booking>("/v1/bookings", { slot_id: slotId }),
    onSuccess: invalidate,
  });
}

export function useCancelBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (bookingId: string) =>
      api.post<Booking>(`/v1/bookings/${bookingId}/cancel`),
    onSuccess: invalidate,
  });
}

export function useCreateSlot() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: ({ facilityId, ...payload }: SlotCreate & { facilityId: string }) =>
      api.post<Slot>(`/v1/facilities/${facilityId}/slots`, payload),
    onSuccess: invalidate,
  });
}

/** Block or unblock a published slot without deleting it. */
export function useUpdateSlot() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: ({
      facilityId,
      slotId,
      isBookable,
    }: {
      facilityId: string;
      slotId: string;
      isBookable: boolean;
    }) =>
      api.patch<Slot>(`/v1/facilities/${facilityId}/slots/${slotId}`, {
        is_bookable: isBookable,
      }),
    onSuccess: invalidate,
  });
}
