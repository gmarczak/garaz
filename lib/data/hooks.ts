"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabaseBrowser, type Supabase } from "@/lib/db/client";
import { localDate, type LocalDate } from "@/lib/domain/dates";
import { withFuel, type FuelDraft } from "./mutations";
import { fetchSnapshot, type Snapshot } from "./snapshot";

export const snapshotKey = ["snapshot"] as const;
export const fuelMutationKey = ["fuel-draft"] as const;

export function useSnapshot() {
  return useQuery({
    queryKey: snapshotKey,
    queryFn: () => fetchSnapshot(supabaseBrowser()),
    staleTime: 60_000,
  });
}

/** Dzisiejsza data użytkownika; odświeża się co minutę i po powrocie do aplikacji. */
export function useToday(snapshot: Snapshot | undefined): LocalDate | null {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  if (!snapshot) return null;
  return localDate(now, snapshot.settings.timezone);
}

/**
 * Tankowanie: pojawia się od razu, serwer potwierdza w tle.
 * Funkcja zapisu jest zarejestrowana w providers.tsx (setMutationDefaults), więc wpis
 * dodany bez sieci przetrwa zamknięcie aplikacji i wyśle się po powrocie internetu.
 */
export function useFuelMutation() {
  const qc = useQueryClient();
  return useMutation<void, Error, FuelDraft, { previous: Snapshot | undefined }>({
    mutationKey: fuelMutationKey,
    onMutate: async (draft) => {
      await qc.cancelQueries({ queryKey: snapshotKey });
      const previous = qc.getQueryData<Snapshot>(snapshotKey);
      if (previous) qc.setQueryData<Snapshot>(snapshotKey, withFuel(previous, draft));
      return { previous };
    },
    onError: (_error, _draft, context) => {
      if (context?.previous) qc.setQueryData(snapshotKey, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: snapshotKey }),
  });
}

/**
 * Pozostałe zapisy (auta, terminy, serwis, ustawienia): wymagają sieci,
 * po sukcesie odświeżają snapshot. Opcjonalna zmiana optymistyczna cache.
 */
export function useAction<TInput, TResult = void>(
  run: (supabase: Supabase, input: TInput) => Promise<TResult>,
  optimistic?: (snapshot: Snapshot, input: TInput) => Snapshot,
) {
  const qc = useQueryClient();
  return useMutation<TResult, Error, TInput, { previous: Snapshot | undefined }>({
    mutationFn: (input) => run(supabaseBrowser(), input),
    onMutate: async (input) => {
      const previous = qc.getQueryData<Snapshot>(snapshotKey);
      if (optimistic && previous) {
        await qc.cancelQueries({ queryKey: snapshotKey });
        qc.setQueryData<Snapshot>(snapshotKey, optimistic(previous, input));
      }
      return { previous };
    },
    onError: (_e, _i, context) => {
      if (optimistic && context?.previous) qc.setQueryData(snapshotKey, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: snapshotKey }),
  });
}
