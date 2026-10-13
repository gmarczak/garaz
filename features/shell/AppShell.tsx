"use client";

import { Car, Fuel, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { FuelForm } from "@/features/fuel/FuelForm";
import { useSnapshot, useToday } from "@/lib/data/hooks";

type OpenFuel = (carId?: string) => void;
const FuelContext = createContext<OpenFuel>(() => {});
export const useOpenFuel = () => useContext(FuelContext);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: snapshot, isPending, error, refetch } = useSnapshot();
  const today = useToday(snapshot);
  const [fueling, setFueling] = useState<{ carId?: string } | null>(null);
  const open: OpenFuel = useCallback((carId) => setFueling({ carId }), []);

  if (isPending && !snapshot) {
    return <div className="mx-auto min-h-dvh max-w-lg px-5 pt-10 text-muted">Wczytuję…</div>;
  }
  if (!snapshot || !today) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-start gap-4 px-5 pt-10">
        <h1 className="font-serif text-2xl font-semibold">Nie udało się wczytać danych</h1>
        <p className="text-muted">{error?.message ?? "Sprawdź połączenie z internetem."}</p>
        <button type="button" onClick={() => void refetch()} className="h-12 rounded-full bg-accent px-6 font-semibold text-accent-contrast">
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  const hasCars = snapshot.cars.some((c) => c.archivedAt === null);
  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/cars") : pathname.startsWith(href));
  const navLink = (href: string, label: string, Icon: typeof Car) => (
    <Link
      href={href}
      aria-current={isActive(href) ? "page" : undefined}
      className={`flex min-w-20 flex-col items-center gap-1 text-xs ${isActive(href) ? "font-bold text-text" : "font-medium text-muted"}`}
    >
      <Icon aria-hidden="true" size={22} strokeWidth={2} />
      {label}
    </Link>
  );

  return (
    <FuelContext.Provider value={open}>
      <div className="mx-auto min-h-dvh max-w-lg pb-[calc(5.5rem+env(safe-area-inset-bottom))]">{children}</div>

      <nav aria-label="Główna nawigacja" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2">
          {navLink("/", "Garaż", Car)}
          <button
            type="button"
            aria-label="Dodaj tankowanie"
            disabled={!hasCars}
            onClick={() => open()}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-accent-contrast disabled:opacity-40"
          >
            <Fuel aria-hidden="true" size={24} strokeWidth={2.2} />
          </button>
          {navLink("/settings", "Ustawienia", Settings)}
        </div>
      </nav>

      <Modal open={fueling !== null} onClose={() => setFueling(null)} title="Tankowanie">
        {fueling && <FuelForm snapshot={snapshot} today={today} carId={fueling.carId} onDone={() => setFueling(null)} />}
      </Modal>
    </FuelContext.Provider>
  );
}
