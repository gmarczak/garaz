import { addMonths, diffDays, type LocalDate } from "./dates";
import type { Car, Term, TermKind } from "./model";

export const TERM_LABELS: Record<TermKind, string> = {
  insurance: "OC",
  inspection: "Przegląd techniczny",
  oil: "Wymiana oleju",
  winter_tires: "Opony zimowe",
  summer_tires: "Opony letnie",
  other: "Inny termin",
};

export function termTitle(term: Pick<Term, "kind" | "title">): string {
  return term.kind === "other" ? (term.title ?? TERM_LABELS.other) : TERM_LABELS[term.kind];
}

/** Ustawienia domyślne nowego terminu danego rodzaju. */
export const TERM_DEFAULTS: Record<TermKind, Pick<Term, "intervalMonths" | "intervalKm" | "anchor" | "notifyDays">> = {
  insurance: { intervalMonths: 12, intervalKm: null, anchor: "due", notifyDays: 30 },
  inspection: { intervalMonths: 12, intervalKm: null, anchor: "done", notifyDays: 14 },
  oil: { intervalMonths: 12, intervalKm: 15000, anchor: "done", notifyDays: 14 },
  winter_tires: { intervalMonths: 12, intervalKm: null, anchor: "due", notifyDays: 14 },
  summer_tires: { intervalMonths: 12, intervalKm: null, anchor: "due", notifyDays: 14 },
  other: { intervalMonths: null, intervalKm: null, anchor: "done", notifyDays: 7 },
};

/** Najbliższy termin sezonowej zmiany opon: zimowe 1 listopada, letnie 1 kwietnia. */
export function nextSeasonDate(kind: "winter_tires" | "summer_tires", today: LocalDate): LocalDate {
  const year = Number(today.slice(0, 4));
  const md = kind === "winter_tires" ? "11-01" : "04-01";
  const thisYear = `${year}-${md}`;
  return thisYear >= today ? thisYear : `${year + 1}-${md}`;
}


export type TermState = "overdue" | "soon" | "ok";

export type TermStatus = {
  state: TermState;
  /** dni do terminu (ujemne = po terminie) */
  daysLeft: number | null;
  /** km do terminu (ujemne = przekroczony) */
  kmLeft: number | null;
};

/** Status terminu na dziś: po terminie, niedługo (w oknie przypomnienia) albo spokojnie. */
export function termStatus(term: Term, today: LocalDate, odometerKm: number | null): TermStatus {
  const daysLeft = term.dueOn ? diffDays(today, term.dueOn) : null;
  const kmLeft = term.dueKm !== null && odometerKm !== null ? term.dueKm - odometerKm : null;
  const overdue = (daysLeft !== null && daysLeft < 0) || (kmLeft !== null && kmLeft < 0);
  const soon = (daysLeft !== null && daysLeft <= term.notifyDays) || (kmLeft !== null && kmLeft <= 1000);
  return { state: overdue ? "overdue" : soon ? "soon" : "ok", daysLeft, kmLeft };
}

export type UpcomingTerm = { term: Term; car: Car; status: TermStatus };

/** Aktywne terminy wszystkich aut: najpierw po terminie, potem najbliższe. */
export function upcomingTerms(terms: readonly Term[], cars: readonly Car[], today: LocalDate): UpcomingTerm[] {
  const byId = new Map(cars.filter((c) => c.archivedAt === null).map((c) => [c.id, c]));
  const order: Record<TermState, number> = { overdue: 0, soon: 1, ok: 2 };
  return terms
    .filter((t) => t.active && byId.has(t.carId))
    .map((term) => {
      const car = byId.get(term.carId)!;
      return { term, car, status: termStatus(term, today, car.odometerKm) };
    })
    .sort(
      (a, b) =>
        order[a.status.state] - order[b.status.state] ||
        (a.status.daysLeft ?? Number.MAX_SAFE_INTEGER) - (b.status.daysLeft ?? Number.MAX_SAFE_INTEGER) ||
        (a.status.kmLeft ?? Number.MAX_SAFE_INTEGER) - (b.status.kmLeft ?? Number.MAX_SAFE_INTEGER),
    );
}

/** Jak przesunie się termin po wykonaniu (ta sama reguła co garage.complete_terms w bazie). */
export function nextAfterDone(term: Term, doneOn: LocalDate, odometerKm: number | null): Pick<Term, "dueOn" | "dueKm" | "active" | "lastDoneOn"> {
  const nextOn =
    term.intervalMonths === null
      ? term.dueOn
      : term.anchor === "due" && term.dueOn !== null
        ? addMonths(term.dueOn, term.intervalMonths)
        : addMonths(doneOn, term.intervalMonths);
  const nextKm = term.intervalKm !== null && odometerKm !== null ? odometerKm + term.intervalKm : term.dueKm;
  const active = term.intervalMonths !== null || (term.intervalKm !== null && odometerKm !== null);
  // Wymiar bez interwału po wykonaniu traci sens (stara data/przebieg zostałyby „po terminie” na zawsze)
  const dueOn = active && term.intervalMonths === null ? null : nextOn;
  const dueKm = active && term.intervalKm === null ? null : nextKm;
  return { dueOn, dueKm, active, lastDoneOn: doneOn };
}

/** Opis „za 12 dni”, „dziś”, „3 dni po terminie”, „za 800 km”. */
export function describeStatus(status: TermStatus): string {
  const parts: string[] = [];
  if (status.daysLeft !== null) {
    const d = status.daysLeft;
    parts.push(d === 0 ? "dziś" : d === 1 ? "jutro" : d > 0 ? `za ${d} dni` : d === -1 ? "wczoraj minął" : `${-d} dni po terminie`);
  }
  if (status.kmLeft !== null) {
    const k = status.kmLeft;
    parts.push(k >= 0 ? `za ${k.toLocaleString("pl-PL")} km` : `${(-k).toLocaleString("pl-PL")} km po terminie`);
  }
  return parts.join(" · ");
}

/** Podstawowe terminy każdego auta — gdy ich brak, aplikacja prosi o uzupełnienie. */
export const BASIC_KINDS: TermKind[] = ["insurance", "inspection", "oil"];

/** Których podstawowych terminów auto jeszcze nie ma (wśród aktywnych). */
export function missingBasics(carId: string, terms: readonly Term[]): TermKind[] {
  const have = new Set(terms.filter((t) => t.carId === carId && t.active).map((t) => t.kind));
  return BASIC_KINDS.filter((k) => !have.has(k));
}
