import { supabase } from "@/integrations/supabase/client";
import { CPM_NORMS, type AgeNormRow } from "./raven-norms";

export interface ActiveNormTable {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  rows: AgeNormRow[];
}

/**
 * Load the currently active norm table for the signed-in specialist.
 * Falls back to the built-in published norms if none is found.
 */
export async function loadActiveNormTable(): Promise<ActiveNormTable> {
  const { data: tables } = await supabase
    .from("norm_tables")
    .select("id, name, description, is_default")
    .eq("is_active", true)
    .limit(1);

  if (!tables || tables.length === 0) {
    return {
      id: "builtin",
      name: "النسخة المدمجة",
      description: "المعايير الافتراضية المنشورة لمصفوفات رافن CPM",
      is_default: true,
      rows: CPM_NORMS,
    };
  }

  const t = tables[0];
  const { data: rows } = await supabase
    .from("norm_rows")
    .select("age_min, age_max, p5, p10, p25, p50, p75, p90, p95")
    .eq("table_id", t.id)
    .order("age_min", { ascending: true });

  return {
    id: t.id,
    name: t.name,
    description: t.description,
    is_default: t.is_default,
    rows:
      rows && rows.length > 0
        ? rows.map((r) => ({
            ageMin: r.age_min,
            ageMax: r.age_max,
            p5: r.p5,
            p10: r.p10,
            p25: r.p25,
            p50: r.p50,
            p75: r.p75,
            p90: r.p90,
            p95: r.p95,
          }))
        : CPM_NORMS,
  };
}
