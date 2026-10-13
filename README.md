# Garaż

PWA do pilnowania terminów auta: OC, przegląd, olej, opony, inne — plus historia serwisu i tankowania ze spalaniem.
Siostrzana aplikacja [Nawyków](https://github.com/gmarczak/habit-tracker) i Finansów: to samo konto i ta sama baza Supabase, osobny schemat `garage`.

## Funkcje

- **Kilka aut**, archiwum dla sprzedanych.
- **Terminy** z datą i/lub przebiegiem. Po „Zrobione” termin przesuwa się sam: OC i opony od poprzedniego terminu, przegląd i olej od dnia wykonania. Przy przeglądzie od razu zaznaczona jest wymiana oleju.
- **Historia serwisu**: każde „Zrobione” i ręczne wpisy (naprawy), z kosztem i przebiegiem.
- **Tankowania** działają offline (kolejka zapisów w IndexedDB). Spalanie liczone metodą „do pełna”, koszt 30 dni i koszt 1 km.
- Przebieg auta aktualizuje się z tankowań i serwisu (trigger w bazie).

W planie: powiadomienia push o terminach, zdjęcie paragonu odczytywane przez AI (Edge Function z kluczem w sekretach Supabase).

## Stack

Next.js 16 (App Router), TypeScript, Tailwind v4, TanStack Query (cache w IndexedDB), Supabase (Postgres + RLS + RPC), Vercel, Vitest.

## Uruchomienie

```bash
cp .env.example .env.local   # URL i klucz publishable projektu Supabase
npm install
npm run dev
```

Schemat `garage` musi być wystawiony w Supabase: Integrations → Data API → Exposed schemas.

## Testy

- `npm run check` — typy, lint, testy jednostkowe (domena: terminy, spalanie, daty, kwoty).
- `supabase/tests/behavior.sql` — migracje od zera + RLS, ograniczenia i RPC `complete_terms` (w CI na Postgresie 17).
