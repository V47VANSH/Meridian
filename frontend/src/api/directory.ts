/**
 * Flats and users of the caller's society, plus the lookups screens need to
 * turn the ids on a record into something a person can read.
 *
 * Complaints, bookings, invoices, guest passes and SOS alerts all reference a
 * `flat_id` and a user id, never a label or a name. Without these lookups a
 * screen has nothing to show, which is why the pages previously fell back to
 * printing a hardcoded "B-304" for every row.
 *
 * `GET /v1/users` is restricted to society officials, so `useUserNames` is only
 * enabled for them; resident screens never need it, because the only person
 * they see on their own records is themselves.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "./client";
import type { Flat, User } from "./types";
import { useAuthStore } from "../store/authStore";

export const directoryKeys = {
  flats: ["flats"] as const,
  myFlats: ["flats", "mine"] as const,
  users: ["users"] as const,
};

export function listFlats(): Promise<Flat[]> {
  return api.get<Flat[]>("/v1/flats");
}

export function listMyFlats(): Promise<Flat[]> {
  return api.get<Flat[]>("/v1/flats?mine=true");
}

export function listUsers(): Promise<User[]> {
  return api.get<User[]>("/v1/users");
}

export function useFlats() {
  return useQuery({ queryKey: directoryKeys.flats, queryFn: listFlats, staleTime: 5 * 60_000 });
}

/** The flats the signed-in user occupies. Empty for a guard or staff member. */
export function useMyFlats() {
  return useQuery({ queryKey: directoryKeys.myFlats, queryFn: listMyFlats, staleTime: 5 * 60_000 });
}

export function useUsers() {
  const role = useAuthStore((s) => s.user?.role);
  return useQuery({
    queryKey: directoryKeys.users,
    queryFn: listUsers,
    staleTime: 5 * 60_000,
    enabled: role === "SOCIETY_OFFICIAL",
  });
}

/**
 * `flat_id` -> "B-304".
 *
 * Returns a function rather than the map so callers stay readable, and so a
 * null id (a complaint raised without a flat) has one defined answer.
 */
export function useFlatLabels(): (flatId: string | null | undefined) => string {
  const { data } = useFlats();
  return useMemo(() => {
    const byId = new Map((data ?? []).map((flat) => [flat.id, flat.label]));
    return (flatId) => (flatId ? byId.get(flatId) ?? "Unknown flat" : "—");
  }, [data]);
}

/** `user_id` -> "Arjun Rao", resolving the signed-in user without the lookup. */
export function useUserNames(): (userId: string | null | undefined) => string {
  const { data } = useUsers();
  const me = useAuthStore((s) => s.user);
  return useMemo(() => {
    const byId = new Map((data ?? []).map((user) => [user.id, user.full_name]));
    return (userId) => {
      if (!userId) return "—";
      if (me && userId === me.id) return me.name;
      return byId.get(userId) ?? "Unknown";
    };
  }, [data, me]);
}
