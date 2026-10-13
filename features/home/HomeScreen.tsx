"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { btnSecondary, sectionTitle } from "@/components/ui/styles";
import { StatusDot, statusText, statusTone } from "@/features/terms/TermLine";
import { useSnapshot, useToday } from "@/lib/data/hooks";
import { carLabel } from "@/lib/domain/model";
import { missingBasics, TERM_LABELS, termTitle, upcomingTerms } from "@/lib/domain/terms";
import { formatKm } from "@/lib/format";

export function HomeScreen() {
  const { data: snapshot } = useSnapshot();
  const today = useToday(snapshot);
  if (!snapshot || !today) return null;

  const active = snapshot.cars.filter((c) => c.archivedAt === null);
  const archived = snapshot.cars.filter((c) => c.archivedAt !== null);
  const upcoming = upcomingTerms(snapshot.terms, snapshot.cars, today);
  const attention = upcoming.filter((u) => u.status.state !== "ok");
  const next = upcoming.find((u) => u.status.state === "ok");
  const multi = active.length > 1;
  const incomplete = active
    .map((car) => ({ car, missing: missingBasics(car.id, snapshot.terms) }))
    .filter((x) => x.missing.length > 0);
  const todo = attention.length + incomplete.length;

  if (active.length === 0) {
    return (
      <main className="flex flex-col gap-6 px-5 pt-10">
        <h1 className="font-serif text-[32px] font-semibold">Garaż</h1>
        <p className="text-lg">Dodaj auto, a przypomnę Ci o OC, przeglądzie, oleju i zmianie opon — zanim będzie za późno.</p>
        <Link href="/cars/new" className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-full bg-accent px-6 font-semibold text-accent-contrast">
          <Plus aria-hidden="true" size={20} /> Dodaj pierwsze auto
        </Link>
        {archived.length > 0 && <ArchivedList cars={archived} />}
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-8 px-5 pt-6">
      <h1 className="font-serif text-[32px] font-semibold">Garaż</h1>

      <section className="flex flex-col gap-2" aria-labelledby="attention">
        <h2 id="attention" className={sectionTitle}>
          {todo > 0 ? "Do zrobienia" : "Terminy"}
        </h2>
        {todo === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-4">
            Wszystko w porządku.
            {next && (
              <span className="block text-sm text-muted">
                Najbliżej: {termTitle(next.term)}
                {multi ? ` (${next.car.name})` : ""} — {statusText(next.term.dueOn, next.status, today)}
              </span>
            )}
          </p>
        ) : (
          <ul className="flex flex-col">
            {attention.map(({ term, car, status }) => (
              <li key={term.id}>
                <Link href={`/cars/${car.id}`} className="flex items-center gap-3 border-b border-border py-3.5">
                  <StatusDot status={status} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">
                      {termTitle(term)}
                      {multi && <span className="font-normal text-muted"> · {car.name}</span>}
                    </span>
                    <span className={`text-sm ${statusTone(status)}`}>{statusText(term.dueOn, status, today)}</span>
                  </span>
                  <ChevronRight aria-hidden="true" size={18} className="text-muted" />
                </Link>
              </li>
            ))}
            {incomplete.map(({ car, missing }) => (
              <li key={`missing-${car.id}`}>
                <Link href={`/cars/${car.id}`} className="flex items-center gap-3 border-b border-border py-3.5">
                  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px] border-control" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">
                      Uzupełnij {missing.map((k) => TERM_LABELS[k].replace("Przegląd techniczny", "przegląd").replace("Wymiana oleju", "olej")).join(", ")}
                      {multi && <span className="font-normal text-muted"> · {car.name}</span>}
                    </span>
                    <span className="text-sm text-muted">Bez daty nie przypomnę o terminie</span>
                  </span>
                  <ChevronRight aria-hidden="true" size={18} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="cars">
        <h2 id="cars" className={sectionTitle}>
          {multi ? "Auta" : "Auto"}
        </h2>
        {active.map((car) => {
          const carNext = upcoming.find((u) => u.car.id === car.id);
          return (
            <Link key={car.id} href={`/cars/${car.id}`} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-4">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[17px] font-semibold">{car.name}</span>
                {carLabel(car) && <span className="truncate text-sm text-muted">{carLabel(car)}</span>}
                <span className="text-sm text-muted">
                  {car.odometerKm !== null ? formatKm(car.odometerKm) : "Przebieg nieznany"}
                  {carNext && (
                    <>
                      {" · "}
                      <span className={statusTone(carNext.status)}>
                        {termTitle(carNext.term)}: {statusText(carNext.term.dueOn, carNext.status, today)}
                      </span>
                    </>
                  )}
                </span>
              </span>
              <ChevronRight aria-hidden="true" size={18} className="text-muted" />
            </Link>
          );
        })}
        <Link href="/cars/new" className={`${btnSecondary} gap-2 self-start`}>
          <Plus aria-hidden="true" size={18} /> Dodaj auto
        </Link>
      </section>

      {archived.length > 0 && <ArchivedList cars={archived} />}
    </main>
  );
}

function ArchivedList({ cars }: { cars: { id: string; name: string }[] }) {
  return (
    <details className="pb-6 text-sm">
      <summary className="min-h-11 cursor-pointer py-3 text-muted">Zarchiwizowane ({cars.length})</summary>
      <ul className="flex flex-col">
        {cars.map((c) => (
          <li key={c.id}>
            <Link href={`/cars/${c.id}`} className="flex min-h-11 items-center border-b border-border">
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
