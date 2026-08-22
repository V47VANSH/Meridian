/**
 * The resident directory: people, the flats they occupy and what they owe.
 *
 * There is no single "resident" record in the API. A resident is a user, their
 * flat comes from that flat's occupants list, and their dues come from the
 * invoices raised against it. This module does that join once so the directory
 * and the profile view agree.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "./client";
import { directoryKeys, useFlats } from "./directory";
import { useInvoices } from "./maintenance";
import type { Flat, Message, Relation, User } from "./types";

export interface DirectoryEntry {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  relation: Relation;
  flatId: string;
  flatLabel: string;
  /** Total unpaid across every invoice raised against their flat. */
  outstanding: number;
  duesStatus: "CLEAR" | "PENDING";
}

/**
 * One row per occupant of each flat.
 *
 * A flat with several occupants produces several rows, and a vacant flat none
 * — which is why the row key is the user id and flat id together rather than
 * the flat label, as it was when the fixture assumed one resident per flat.
 */
export function useDirectory() {
  const flats = useFlats();
  const invoices = useInvoices();

  const entries = useMemo<DirectoryEntry[]>(() => {
    const outstandingByFlat = new Map<string, number>();
    for (const invoice of invoices.data ?? []) {
      if (invoice.status === "PAID") continue;
      outstandingByFlat.set(
        invoice.flat_id,
        (outstandingByFlat.get(invoice.flat_id) ?? 0) + invoice.amount,
      );
    }

    return (flats.data ?? []).flatMap((flat: Flat) =>
      (flat.occupants ?? []).map((occupant) => {
        const outstanding = outstandingByFlat.get(flat.id) ?? 0;
        return {
          userId: occupant.user_id,
          name: occupant.full_name,
          email: occupant.email,
          phone: occupant.phone,
          role: occupant.role,
          relation: occupant.relation as Relation,
          flatId: flat.id,
          flatLabel: flat.label,
          outstanding,
          duesStatus: outstanding > 0 ? ("PENDING" as const) : ("CLEAR" as const),
        };
      }),
    );
  }, [flats.data, invoices.data]);

  return {
    entries,
    isPending: flats.isPending || invoices.isPending,
    error: flats.error ?? invoices.error,
    refetch: () => {
      void flats.refetch();
      void invoices.refetch();
    },
  };
}

export interface CreateResidentInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: string;
  flatId: string;
  relation: Relation;
}

/**
 * Create the account and link it to its flat.
 *
 * Two calls, because the API models them separately: a user exists in the
 * society, and a flat ownership links them to a flat. Doing only the first —
 * as the previous screen did — left the new resident belonging to no flat, so
 * they had no invoices, could raise no guest pass and appeared nowhere in the
 * directory.
 */
export function useCreateResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateResidentInput) => {
      const user = await api.post<User>("/v1/users", {
        email: input.email,
        password: input.password,
        full_name: input.fullName,
        phone: input.phone,
        role: input.role,
      });

      await api.post<Message>(`/v1/flats/${input.flatId}/occupants`, {
        user_id: user.id,
        relation: input.relation,
      });

      return user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: directoryKeys.flats });
      queryClient.invalidateQueries({ queryKey: directoryKeys.users });
    },
  });
}
