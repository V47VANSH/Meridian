/**
 * Per-role dashboard aggregates.
 *
 * Each of these is one request that replaces the four or five a screen would
 * otherwise fan out, and the server does the joining — so the counts on the
 * dashboard cannot drift from the lists they summarise.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { NonResidentDashboard, OfficialDashboard, ResidentDashboard } from "./types";

export const dashboardKeys = {
  resident: ["dashboard", "resident"] as const,
  official: ["dashboard", "official"] as const,
  nonResident: ["dashboard", "non-resident"] as const,
};

export function useResidentDashboard() {
  return useQuery({
    queryKey: dashboardKeys.resident,
    queryFn: () => api.get<ResidentDashboard>("/v1/dashboard/resident"),
  });
}

export function useOfficialDashboard() {
  return useQuery({
    queryKey: dashboardKeys.official,
    queryFn: () => api.get<OfficialDashboard>("/v1/dashboard/official"),
  });
}

export function useNonResidentDashboard() {
  return useQuery({
    queryKey: dashboardKeys.nonResident,
    queryFn: () => api.get<NonResidentDashboard>("/v1/dashboard/non-resident"),
  });
}
