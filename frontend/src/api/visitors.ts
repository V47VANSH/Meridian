/**
 * Guest passes and the SOS alert flow.
 *
 * Both sides matter here: a resident raising an alert and the guard who has to
 * see it. `GET /v1/sos` is the guard's inbox — responders (guard and official)
 * receive every incident in the society, everyone else only their own.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  GuestPass,
  GuestPassCreate,
  GuestPassStatus,
  GuestPassVerify,
  SOSIncident,
  SOSStatus,
} from "./types";

export const visitorKeys = {
  passes: ["guest-passes"] as const,
  pass: (id: string) => ["guest-passes", id] as const,
  sos: (status?: string) => ["sos", status ?? "all"] as const,
  sosAll: ["sos"] as const,
};

export function listGuestPasses(status?: GuestPassStatus): Promise<GuestPass[]> {
  const suffix = status ? `?status=${status}` : "";
  return api.get<GuestPass[]>(`/v1/visitors/guest-passes${suffix}`);
}

export function useGuestPasses(status?: GuestPassStatus) {
  return useQuery({
    queryKey: [...visitorKeys.passes, status ?? "all"],
    queryFn: () => listGuestPasses(status),
  });
}

function useInvalidatePasses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: visitorKeys.passes });
}

export function useCreateGuestPass() {
  const invalidate = useInvalidatePasses();
  return useMutation({
    mutationFn: (payload: GuestPassCreate) =>
      api.post<GuestPass>("/v1/visitors/guest-passes", payload),
    onSuccess: invalidate,
  });
}

export function useRevokeGuestPass() {
  const invalidate = useInvalidatePasses();
  return useMutation({
    mutationFn: (passId: string) =>
      api.post<GuestPass>(`/v1/visitors/guest-passes/${passId}/revoke`),
    onSuccess: invalidate,
  });
}

/**
 * Verify a scanned pass. The token, not the pass id, is the credential.
 *
 * The call consumes the pass in the same transaction that reports the result,
 * so a captured QR image cannot be replayed at the gate. A pass that is simply
 * invalid comes back 200 with `valid: false` and a reason — only an unknown
 * token is a 404.
 */
export function useVerifyGuestPass() {
  const invalidate = useInvalidatePasses();
  return useMutation({
    mutationFn: (qrToken: string) =>
      api.post<GuestPassVerify>(
        `/v1/visitors/guest-passes/${encodeURIComponent(qrToken)}/verify`,
      ),
    onSuccess: invalidate,
  });
}

export function useSOSIncidents(status?: SOSStatus, options?: { refetchInterval?: number }) {
  const suffix = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: visitorKeys.sos(status),
    queryFn: () => api.get<SOSIncident[]>(`/v1/sos${suffix}`),
    refetchInterval: options?.refetchInterval,
  });
}

function useInvalidateSOS() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: visitorKeys.sosAll });
}

export function useRaiseSOS() {
  const invalidate = useInvalidateSOS();
  return useMutation({
    mutationFn: (payload: { flat_id?: string | null; location_note?: string }) =>
      api.post<SOSIncident>("/v1/sos", {
        flat_id: payload.flat_id ?? null,
        location_note: payload.location_note ?? "",
      }),
    onSuccess: invalidate,
  });
}

export function useAcknowledgeSOS() {
  const invalidate = useInvalidateSOS();
  return useMutation({
    mutationFn: (incidentId: string) =>
      api.post<SOSIncident>(`/v1/sos/${incidentId}/acknowledge`),
    onSuccess: invalidate,
  });
}

export function useResolveSOS() {
  const invalidate = useInvalidateSOS();
  return useMutation({
    mutationFn: (incidentId: string) => api.post<SOSIncident>(`/v1/sos/${incidentId}/resolve`),
    onSuccess: invalidate,
  });
}
