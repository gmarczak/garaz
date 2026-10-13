import { describe, expect, it } from "vitest";
import { addMonths } from "./dates";
import type { Car, Term } from "./model";
import { describeStatus, missingBasics, nextAfterDone, nextSeasonDate, termStatus, upcomingTerms } from "./terms";

const car: Car = { id: "c", name: "Corolla", make: "Toyota", model: "Corolla", year: 2016, plate: null, fuel: "petrol", odometerKm: 150000, sortOrder: 0, archivedAt: null };
const term = (over: Partial<Term>): Term => ({
  id: "t", carId: "c", kind: "insurance", title: null, dueOn: "2026-11-20", dueKm: null, intervalMonths: 12, intervalKm: null,
  anchor: "due", notifyDays: 30, lastDoneOn: null, active: true, ...over,
});

describe("daty", () => {
  it("miesiące jak w Postgresie", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-05", 12)).toBe("2027-11-05");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
});

describe("terminy", () => {
  it("status po dacie i po przebiegu", () => {
    expect(termStatus(term({}), "2026-10-13", 150000)).toEqual({ state: "ok", daysLeft: 38, kmLeft: null });
    expect(termStatus(term({}), "2026-10-25", 150000).state).toBe("soon");
    expect(termStatus(term({}), "2026-11-21", 150000).state).toBe("overdue");
    expect(termStatus(term({ kind: "oil", dueOn: null, dueKm: 150500, notifyDays: 14 }), "2026-10-13", 150000)).toEqual({ state: "soon", daysLeft: null, kmLeft: 500 });
    expect(termStatus(term({ kind: "oil", dueOn: "2027-06-01", dueKm: 149000 }), "2026-10-13", 150000).state).toBe("overdue");
  });

  it("opis", () => {
    expect(describeStatus({ state: "soon", daysLeft: 12, kmLeft: null })).toBe("za 12 dni");
    expect(describeStatus({ state: "overdue", daysLeft: -3, kmLeft: -1200 })).toBe("3 dni po terminie · 1200 km po terminie".replace("1200", (1200).toLocaleString("pl-PL")));
    expect(describeStatus({ state: "soon", daysLeft: 0, kmLeft: null })).toBe("dziś");
  });

  it("kolejność: po terminie, potem najbliższe; bez zarchiwizowanych aut", () => {
    const list = upcomingTerms(
      [term({ id: "a", dueOn: "2027-03-01" }), term({ id: "b", dueOn: "2026-10-01" }), term({ id: "c", dueOn: "2026-10-20" }), term({ id: "d", carId: "old" })],
      [car, { ...car, id: "old", archivedAt: "2026-01-01T00:00:00Z" }],
      "2026-10-13",
    );
    expect(list.map((x) => x.term.id)).toEqual(["b", "c", "a"]);
  });

  it("przesunięcie po wykonaniu jak w bazie", () => {
    expect(nextAfterDone(term({}), "2026-11-10", null)).toEqual({ dueOn: "2027-11-20", dueKm: null, active: true, lastDoneOn: "2026-11-10" });
    expect(nextAfterDone(term({ kind: "inspection", anchor: "done", dueOn: "2026-11-05" }), "2026-10-28", 151200).dueOn).toBe("2027-10-28");
    expect(nextAfterDone(term({ kind: "oil", anchor: "done", intervalKm: 15000 }), "2026-10-28", 151200)).toMatchObject({ dueOn: "2027-10-28", dueKm: 166200 });
    expect(nextAfterDone(term({ kind: "other", title: "Wycieraczki", intervalMonths: null }), "2026-10-28", null).active).toBe(false);
  });

  it("wymiar bez interwału znika po wykonaniu", () => {
    // rozrząd: data i przebieg, powtarzany tylko co km → stara data nie wisi „po terminie”
    expect(nextAfterDone(term({ kind: "other", title: "Rozrząd", dueOn: "2026-01-01", dueKm: 150000, intervalMonths: null, intervalKm: 90000 }), "2026-10-28", 149000)).toEqual({
      dueOn: null, dueKm: 239000, active: true, lastDoneOn: "2026-10-28",
    });
    // olej co rok bez interwału km: stary limit km znika
    expect(nextAfterDone(term({ kind: "oil", anchor: "done", dueKm: 160000, intervalKm: null }), "2026-10-28", 151200)).toMatchObject({ dueOn: "2027-10-28", dueKm: null });
  });

  it("sezon opon", () => {
    expect(nextSeasonDate("winter_tires", "2026-10-13")).toBe("2026-11-01");
    expect(nextSeasonDate("winter_tires", "2026-11-02")).toBe("2027-11-01");
    expect(nextSeasonDate("summer_tires", "2026-10-13")).toBe("2027-04-01");
  });
});

describe("missingBasics", () => {
  const base = { title: null, dueOn: "2026-12-01", dueKm: null, intervalMonths: 12, intervalKm: null, anchor: "due" as const, notifyDays: 30, lastDoneOn: null, active: true };
  it("wskazuje brakujące OC, przegląd i olej", () => {
    expect(missingBasics("a", [])).toEqual(["insurance", "inspection", "oil"]);
    expect(missingBasics("a", [{ ...base, id: "1", carId: "a", kind: "insurance" }])).toEqual(["inspection", "oil"]);
  });
  it("nie liczy innych aut ani nieaktywnych terminów", () => {
    const terms = [
      { ...base, id: "1", carId: "b", kind: "insurance" as const },
      { ...base, id: "2", carId: "a", kind: "inspection" as const, active: false },
    ];
    expect(missingBasics("a", terms)).toEqual(["insurance", "inspection", "oil"]);
  });
});
