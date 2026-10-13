// Typy schematu `garage` (wspólny projekt Supabase z Nawykami i Finansami). Odpowiadają migracjom w supabase/migrations.
// Docelowo generowane: `npm run db:types` (wymaga Supabase CLI i schematu udostępnionego w API).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Enums = {
  fuel_type: "petrol" | "diesel" | "lpg" | "hybrid" | "electric";
  term_kind: "insurance" | "inspection" | "oil" | "winter_tires" | "summer_tires" | "other";
};

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type SettingsRow = { user_id: string; timezone: string; notify_time: string; created_at: string };

export type CarRow = {
  id: string;
  user_id: string;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  fuel: Enums["fuel_type"];
  odometer_km: number | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
};

export type TermRow = {
  id: string;
  user_id: string;
  car_id: string;
  kind: Enums["term_kind"];
  title: string | null;
  due_on: string | null;
  due_km: number | null;
  interval_months: number | null;
  interval_km: number | null;
  anchor: "due" | "done";
  notify_days: number;
  last_done_on: string | null;
  active: boolean;
  created_at: string;
};

export type ServiceRow = {
  id: string;
  user_id: string;
  car_id: string;
  done_on: string;
  kinds: Enums["term_kind"][];
  title: string;
  odometer_km: number | null;
  cost_minor: number | null;
  note: string | null;
  created_at: string;
};

export type FuelLogRow = {
  id: string;
  user_id: string;
  car_id: string;
  filled_on: string;
  odometer_km: number;
  liters: number;
  amount_minor: number;
  full_tank: boolean;
  station: string | null;
  receipt_path: string | null;
  created_at: string;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  garage: {
    Tables: {
      settings: Table<SettingsRow, never>;
      cars: Table<CarRow, "name">;
      terms: Table<TermRow, "car_id" | "kind">;
      services: Table<ServiceRow, "car_id" | "done_on" | "title">;
      fuel_logs: Table<FuelLogRow, "car_id" | "filled_on" | "odometer_km" | "liters" | "amount_minor">;
    };
    Views: { [_ in never]: never };
    Functions: {
      bootstrap: { Args: never; Returns: undefined };
      can_access: { Args: { p_user_id: string }; Returns: boolean };
      complete_terms: {
        Args: {
          p_id: string;
          p_term_ids: string[];
          p_done_on: string;
          p_odometer_km?: number | null;
          p_cost_minor?: number | null;
          p_note?: string | null;
          p_title?: string | null;
        };
        Returns: ServiceRow;
      };
    };
    Enums: Enums;
    CompositeTypes: { [_ in never]: never };
  };
};
