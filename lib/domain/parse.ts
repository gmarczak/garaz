/** Przebieg z klawiatury: „123 456”, „123456 km” → 123456; puste lub błędne → null. */
export function parseKm(input: string): number | null {
  const s = input.replace(/[\s  ]/g, "").replace(/km$/i, "");
  if (!/^\d{1,7}$/.test(s)) return null;
  return Number(s);
}

/** Litry: „45,32”, „45.3” → 45.32 (max 2 miejsca po przecinku, > 0, < 1000). */
export function parseLiters(input: string): number | null {
  const s = input.replace(/[\s  ]/g, "").replace(/l$/i, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const value = Number(s);
  return value > 0 ? value : null;
}
