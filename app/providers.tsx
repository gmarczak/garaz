"use client";

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { fuelMutationKey, snapshotKey } from "@/lib/data/hooks";
import { isNetworkError, saveFuel, type FuelDraft } from "@/lib/data/mutations";
import { supabaseBrowser } from "@/lib/db/client";

const CACHE_VERSION = "garaz-1";

function makeClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 1000 * 60 * 60 * 24 * 7, retry: 1, networkMode: "offlineFirst" },
      mutations: { networkMode: "online", retry: 3 },
    },
  });
  // Tankowanie: przy słabym zasięgu (przeglądarka myśli, że jest online) ponawiaj do skutku, zamiast porzucać wpis.
  client.setMutationDefaults(fuelMutationKey, {
    mutationFn: (draft: FuelDraft) => saveFuel(supabaseBrowser(), draft),
    retry: (count, error) => isNetworkError(error) || count < 3,
    retryDelay: (attempt) => Math.min(30_000, 1000 * 2 ** attempt),
    onSettled: () => client.invalidateQueries({ queryKey: snapshotKey }),
  });
  return client;
}

/** Po ponownym otwarciu aplikacji: wyślij tankowania, które nie zdążyły się zapisać (zapis jest idempotentny). */
async function resumeFuel(client: QueryClient) {
  await client.resumePausedMutations();
  const stuck = client
    .getMutationCache()
    .getAll()
    .filter((m) => m.options.mutationKey?.[0] === fuelMutationKey[0] && m.state.status === "pending" && !m.state.isPaused);
  for (const m of stuck) {
    const draft = m.state.variables as FuelDraft;
    client.getMutationCache().remove(m);
    void client.getMutationCache().build(client, { mutationKey: fuelMutationKey }).execute(draft);
  }
  await client.invalidateQueries({ queryKey: snapshotKey });
}

const persister =
  typeof window === "undefined"
    ? undefined
    : createAsyncStoragePersister({
        storage: {
          getItem: async (key) => (await get<string>(key)) ?? null,
          setItem: (key, value) => set(key, value),
          removeItem: (key) => del(key),
        },
        key: "garaz-cache",
        throttleTime: 500,
      });

const noop = () => () => {};

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient);
  // Serwer i pierwsze malowanie klienta renderują to samo (pusto) — bez błędu hydracji.
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  useEffect(() => {
    onlineManager.setOnline(navigator.onLine);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }
  }, []);

  if (!mounted || !persister) return null;
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        buster: CACHE_VERSION,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        // Zachowujemy tylko tankowania — inne zapisy wymagają sieci i nie mają czym się wznowić
        dehydrateOptions: {
          shouldDehydrateMutation: (m) => m.options.mutationKey?.[0] === fuelMutationKey[0] && m.state.status === "pending",
        },
      }}
      onSuccess={() => void resumeFuel(client)}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
