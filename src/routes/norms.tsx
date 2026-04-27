import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight, Check, ClipboardList, Copy, Download, FileJson, FileSpreadsheet,
  History, Loader2, Lock, Minus, Plus, Save, Star, Trash2, TrendingDown, TrendingUp, Upload,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { CPM_NORMS } from "@/data/raven-norms";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/norms")({
  head: () => ({
    meta: [{ title: "إعداد جداول المعايير — رافن CPM" }],
  }),
  component: NormsPage,
});

interface NormTable {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface NormRow {
  id?: string;
  age_min: number;
  age_max: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
}

const PERCENTILE_KEYS: Array<keyof Pick<NormRow, "p5" | "p10" | "p25" | "p50" | "p75" | "p90" | "p95">> = [
  "p5", "p10", "p25", "p50", "p75", "p90", "p95",
];

const PERCENTILE_LABELS: Record<string, string> = {
  p5: "5%", p10: "10%", p25: "25%", p50: "50%", p75: "75%", p90: "90%", p95: "95%",
};

function toInt(v: unknown, field: string): number {
  if (v === null || v === undefined || v === "") throw new Error(`قيمة فارغة للحقل ${field}`);
  const n = typeof v === "number" ? v : parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n)) throw new Error(`قيمة غير رقمية للحقل ${field}: ${String(v)}`);
  return n;
}

function coerceRow(obj: Record<string, unknown>): NormRow {
  return {
    age_min: toInt(obj.age_min, "age_min"),
    age_max: toInt(obj.age_max, "age_max"),
    p5: toInt(obj.p5, "p5"),
    p10: toInt(obj.p10, "p10"),
    p25: toInt(obj.p25, "p25"),
    p50: toInt(obj.p50, "p50"),
    p75: toInt(obj.p75, "p75"),
    p90: toInt(obj.p90, "p90"),
    p95: toInt(obj.p95, "p95"),
  };
}

function validateRows(parsed: NormRow[]) {
  for (const r of parsed) {
    if (r.age_min > r.age_max) throw new Error(`age_min أكبر من age_max عند العمر ${r.age_min}`);
    const ps = [r.p5, r.p10, r.p25, r.p50, r.p75, r.p90, r.p95];
    for (const v of ps) {
      if (v < 0 || v > 36) throw new Error(`قيمة مئين خارج النطاق (0–36) عند العمر ${r.age_min}`);
    }
  }
}

function NormsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [tables, setTables] = useState<NormTable[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rows, setRows] = useState<NormRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  async function refreshTables(preferActive = false, preferId?: string) {
    const { data, error } = await supabase
      .from("norm_tables")
      .select("*")
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("تعذّر تحميل النسخ: " + error.message);
      return [];
    }
    setTables((data ?? []) as NormTable[]);
    if (preferId && data?.find((t) => t.id === preferId)) {
      setSelectedId(preferId);
    } else if (preferActive && data?.length) {
      setSelectedId(data.find((t) => t.is_active)?.id ?? data[0].id);
    } else if (!selectedId && data?.length) {
      setSelectedId(data.find((t) => t.is_active)?.id ?? data[0].id);
    }
    return (data ?? []) as NormTable[];
  }

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingData(true);
      await refreshTables(true);
      setLoadingData(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      const { data, error } = await supabase
        .from("norm_rows")
        .select("*")
        .eq("table_id", selectedId)
        .order("age_min", { ascending: true });
      if (error) {
        toast.error("تعذّر تحميل صفوف الجدول");
        return;
      }
      setRows((data ?? []) as NormRow[]);
      setDirty(false);
    })();
  }, [selectedId]);

  const selected = useMemo(
    () => tables.find((t) => t.id === selectedId) ?? null,
    [tables, selectedId]
  );
  const isReadOnly = selected?.is_default === true;

  function updateCell(idx: number, key: keyof NormRow, value: number) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
    setDirty(true);
  }

  async function saveChanges() {
    if (!selected || isReadOnly) return;
    setSaving(true);
    // delete existing rows + reinsert (atomic enough for a small table; preserves history through versioning)
    const { error: delErr } = await supabase.from("norm_rows").delete().eq("table_id", selected.id);
    if (delErr) {
      toast.error("تعذّر الحفظ: " + delErr.message);
      setSaving(false);
      return;
    }
    const insertRows = rows.map((r) => ({
      table_id: selected.id,
      age_min: r.age_min,
      age_max: r.age_max,
      p5: r.p5, p10: r.p10, p25: r.p25, p50: r.p50, p75: r.p75, p90: r.p90, p95: r.p95,
    }));
    const { error: insErr } = await supabase.from("norm_rows").insert(insertRows);
    if (insErr) {
      toast.error("تعذّر الحفظ: " + insErr.message);
      setSaving(false);
      return;
    }
    await supabase.from("norm_tables").update({ updated_at: new Date().toISOString() }).eq("id", selected.id);
    toast.success("تم حفظ التعديلات");
    setDirty(false);
    setSaving(false);
    await refreshTables();
  }

  async function activateTable(id: string) {
    const { error } = await supabase.from("norm_tables").update({ is_active: true }).eq("id", id);
    if (error) {
      toast.error("تعذّر التفعيل: " + error.message);
      return;
    }
    toast.success("تم تفعيل النسخة — ستُستخدم في الاختبارات الجديدة");
    await refreshTables();
  }

  async function deleteTable(id: string) {
    const { error } = await supabase.from("norm_tables").delete().eq("id", id);
    if (error) {
      toast.error("تعذّر الحذف: " + error.message);
      return;
    }
    toast.success("تم حذف النسخة");
    if (selectedId === id) setSelectedId(null);
    await refreshTables(true);
  }

  async function createNewVersion(name: string, description: string, copyFromId: string | null) {
    if (!user) return;
    const { data: created, error } = await supabase
      .from("norm_tables")
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        is_active: false,
        is_default: false,
      })
      .select()
      .single();
    if (error || !created) {
      toast.error("تعذّر إنشاء النسخة: " + (error?.message ?? ""));
      return;
    }
    let sourceRows: NormRow[] = [];
    if (copyFromId) {
      const { data } = await supabase
        .from("norm_rows")
        .select("*")
        .eq("table_id", copyFromId)
        .order("age_min", { ascending: true });
      sourceRows = (data ?? []) as NormRow[];
    } else {
      sourceRows = CPM_NORMS.map((r) => ({
        age_min: r.ageMin, age_max: r.ageMax,
        p5: r.p5, p10: r.p10, p25: r.p25, p50: r.p50, p75: r.p75, p90: r.p90, p95: r.p95,
      }));
    }
    if (sourceRows.length > 0) {
      await supabase.from("norm_rows").insert(
        sourceRows.map((r) => ({
          table_id: created.id,
          age_min: r.age_min, age_max: r.age_max,
          p5: r.p5, p10: r.p10, p25: r.p25, p50: r.p50, p75: r.p75, p90: r.p90, p95: r.p95,
        }))
      );
    }
    toast.success("تم إنشاء نسخة جديدة");
    await refreshTables(false, created.id);
  }

  function exportRows(format: "csv" | "json") {
    if (!selected) return;
    const safeName = selected.name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "norms";
    const stamp = new Date().toISOString().slice(0, 10);
    let blob: Blob;
    let filename: string;

    if (format === "csv") {
      const header = ["age_min", "age_max", "p5", "p10", "p25", "p50", "p75", "p90", "p95"];
      const lines = [header.join(",")];
      for (const r of rows) {
        lines.push([r.age_min, r.age_max, r.p5, r.p10, r.p25, r.p50, r.p75, r.p90, r.p95].join(","));
      }
      blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      filename = `raven-cpm-norms-${safeName}-${stamp}.csv`;
    } else {
      const payload = {
        format: "raven-cpm-norms",
        version: 1,
        exportedAt: new Date().toISOString(),
        table: { name: selected.name, description: selected.description, is_default: selected.is_default },
        rows: rows.map((r) => ({
          age_min: r.age_min, age_max: r.age_max,
          p5: r.p5, p10: r.p10, p25: r.p25, p50: r.p50, p75: r.p75, p90: r.p90, p95: r.p95,
        })),
      };
      blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      filename = `raven-cpm-norms-${safeName}-${stamp}.json`;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`تم تصدير ${rows.length} صفوف بصيغة ${format.toUpperCase()}`);
  }

  async function importFromFile(file: File) {
    if (!user) return;
    try {
      const text = await file.text();
      const lower = file.name.toLowerCase();
      let parsed: NormRow[] = [];

      if (lower.endsWith(".json")) {
        const obj = JSON.parse(text);
        const arr = Array.isArray(obj) ? obj : obj.rows;
        if (!Array.isArray(arr)) throw new Error("ملف JSON لا يحتوي على مصفوفة rows");
        parsed = arr.map(coerceRow);
      } else {
        const sep = text.includes("\t") && !text.includes(",") ? "\t" : ",";
        const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) throw new Error("ملف CSV فارغ أو لا يحتوي على بيانات");
        const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
        const required = ["age_min", "age_max", "p5", "p10", "p25", "p50", "p75", "p90", "p95"];
        for (const r of required) {
          if (!headers.includes(r)) throw new Error(`عمود مفقود في CSV: ${r}`);
        }
        const idx: Record<string, number> = {};
        headers.forEach((h, i) => (idx[h] = i));
        parsed = lines.slice(1).map((line) => {
          const cells = line.split(sep);
          const obj: Record<string, unknown> = {};
          for (const k of required) obj[k] = cells[idx[k]];
          return coerceRow(obj);
        });
      }

      if (parsed.length === 0) throw new Error("لم يتم العثور على صفوف صالحة في الملف");
      validateRows(parsed);

      const today = new Date().toLocaleDateString("ar-EG");
      const newName = `استيراد من ${file.name} — ${today}`;
      const description = `استيراد ${parsed.length} صفوف من ${lower.endsWith(".json") ? "JSON" : "CSV"} (${file.name})`;

      const { data: created, error } = await supabase
        .from("norm_tables")
        .insert({
          user_id: user.id,
          name: newName,
          description,
          is_active: false,
          is_default: false,
        })
        .select()
        .single();
      if (error || !created) throw new Error(error?.message ?? "تعذّر إنشاء النسخة");

      const insertRows = parsed.map((r) => ({
        table_id: created.id,
        age_min: r.age_min, age_max: r.age_max,
        p5: r.p5, p10: r.p10, p25: r.p25, p50: r.p50, p75: r.p75, p90: r.p90, p95: r.p95,
      }));
      const { error: insErr } = await supabase.from("norm_rows").insert(insertRows);
      if (insErr) throw new Error(insErr.message);

      toast.success(`تم الاستيراد كنسخة تاريخية جديدة (${parsed.length} صفوف)`);
      await refreshTables(false, created.id);
    } catch (err) {
      toast.error("فشل الاستيراد: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 mx-auto w-full max-w-6xl px-3 sm:px-6 py-6 space-y-5">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              إعداد جداول المعايير
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              راجع وحدّث جداول المئينات حسب العمر. النسخة <Badge variant="outline" className="mx-1">النشطة</Badge> هي التي ستُحتسب بها الاختبارات الجديدة.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ImportButton onImport={importFromFile} />
            <CompareDialog tables={tables} currentId={selectedId} />
            <NewVersionDialog
              tables={tables}
              currentId={selectedId}
              onCreate={createNewVersion}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Versions list */}
          <Card className="border-border/60 shadow-card lg:col-span-1 h-fit">
            <CardContent className="py-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-bold">النسخ ({tables.length})</h2>
              </div>
              {tables.map((t) => {
                const isSelected = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (dirty && !confirm("توجد تعديلات غير محفوظة، هل تريد التبديل والتخلي عنها؟")) return;
                      setSelectedId(t.id);
                    }}
                    className={cn(
                      "w-full text-start rounded-xl border-2 p-3 transition-smooth",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-secondary"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-sm truncate">{t.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {t.is_active && (
                          <Badge className="bg-hero-gradient text-primary-foreground border-0 gap-1">
                            <Star className="h-3 w-3" />
                            نشطة
                          </Badge>
                        )}
                        {t.is_default && (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" />
                            افتراضية
                          </Badge>
                        )}
                      </div>
                    </div>
                    {t.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{t.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      آخر تحديث: {new Date(t.updated_at).toLocaleString("ar-EG")}
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Editor */}
          <div className="lg:col-span-2 space-y-4">
            {selected ? (
              <>
                <Card className="border-border/60 shadow-card">
                  <CardContent className="py-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg truncate">{selected.name}</h3>
                        {selected.description && (
                          <p className="text-xs text-muted-foreground">{selected.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Download className="ms-2 h-4 w-4" />
                              تصدير
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel>تنزيل النسخة</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => exportRows("csv")}>
                              <FileSpreadsheet className="ms-2 h-4 w-4" />
                              ملف CSV (Excel)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportRows("json")}>
                              <FileJson className="ms-2 h-4 w-4" />
                              ملف JSON
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {!selected.is_active && (
                          <Button size="sm" variant="outline" onClick={() => activateTable(selected.id)}>
                            <Check className="ms-2 h-4 w-4" />
                            تفعيل
                          </Button>
                        )}
                        {!selected.is_default && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                                <Trash2 className="ms-2 h-4 w-4" />
                                حذف
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد حذف النسخة</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف هذه النسخة وصفوفها نهائياً. لن يؤثر هذا على الاختبارات السابقة المحفوظة.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteTable(selected.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                    {isReadOnly && (
                      <div className="rounded-lg bg-secondary/60 border border-border p-3 text-xs flex items-center gap-2">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        النسخة الافتراضية للقراءة فقط — لإجراء تعديلات أنشئ نسخة جديدة منها (ستُحفظ تلقائياً كنسخة تاريخية مستقلة).
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/60 shadow-card overflow-hidden">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/60">
                          <tr>
                            <th className="px-3 py-2 text-start font-bold">الفئة العمرية (سنوات)</th>
                            {PERCENTILE_KEYS.map((k) => (
                              <th key={k} className="px-2 py-2 font-bold text-center min-w-[68px]">
                                مئين {PERCENTILE_LABELS[k]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, idx) => (
                            <tr key={idx} className={cn("border-t border-border/60", idx % 2 === 0 && "bg-card")}>
                              <td className="px-3 py-2 font-bold whitespace-nowrap">
                                {r.age_min === r.age_max ? `${r.age_min}` : `${r.age_min}–${r.age_max}`}
                              </td>
                              {PERCENTILE_KEYS.map((k) => (
                                <td key={k} className="px-1 py-1.5 text-center">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={36}
                                    value={r[k]}
                                    disabled={isReadOnly}
                                    onChange={(e) => updateCell(idx, k, parseInt(e.target.value || "0", 10))}
                                    className="h-9 text-center font-mono w-16 mx-auto"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center justify-end gap-2">
                  {dirty && !isReadOnly && (
                    <Badge variant="outline" className="text-amber-600 border-amber-400">
                      تعديلات غير محفوظة
                    </Badge>
                  )}
                  <Button
                    onClick={saveChanges}
                    disabled={!dirty || saving || isReadOnly}
                    className="bg-hero-gradient text-primary-foreground"
                  >
                    {saving ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Save className="ms-2 h-4 w-4" />}
                    حفظ التعديلات
                  </Button>
                </div>
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  اختر نسخة من القائمة لعرضها وتعديلها.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function NewVersionDialog({
  tables, currentId, onCreate,
}: {
  tables: NormTable[];
  currentId: string | null;
  onCreate: (name: string, description: string, copyFromId: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [copyFromId, setCopyFromId] = useState<string>(currentId ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const today = new Date().toLocaleDateString("ar-EG");
      setName(`نسخة بتاريخ ${today}`);
      setDescription("");
      setCopyFromId(currentId ?? tables.find((t) => t.is_active)?.id ?? tables[0]?.id ?? "");
    }
  }, [open, currentId, tables]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gold-gradient text-gold-foreground shadow-gold">
          <Plus className="ms-2 h-4 w-4" />
          نسخة جديدة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>إنشاء نسخة جديدة من جدول المعايير</DialogTitle>
          <DialogDescription>
            ستُحفظ كنسخة مستقلة بتاريخها الخاص؛ النسخة الأصلية تبقى دون تغيير.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>اسم النسخة</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تعديل 2026" />
          </div>
          <div>
            <Label>الوصف (اختياري)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مصدر التعديل أو ملاحظات..."
              rows={2}
            />
          </div>
          <div>
            <Label>نسخ القيم من</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={copyFromId}
              onChange={(e) => setCopyFromId(e.target.value)}
            >
              <option value="">— البدء بالقيم القياسية المنشورة —</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              await onCreate(name.trim(), description.trim(), copyFromId || null);
              setBusy(false);
              setOpen(false);
            }}
            className="bg-hero-gradient text-primary-foreground"
          >
            {busy ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Copy className="ms-2 h-4 w-4" />}
            إنشاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportButton({ onImport }: { onImport: (file: File) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        id="norms-import-input"
        type="file"
        accept=".csv,.json,.tsv,text/csv,application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          await onImport(file);
          setBusy(false);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
      <Button
        variant="outline"
        onClick={() => document.getElementById("norms-import-input")?.click()}
        disabled={busy}
        title="استيراد قيم من ملف CSV أو JSON كنسخة تاريخية جديدة"
      >
        {busy ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Upload className="ms-2 h-4 w-4" />}
        استيراد
      </Button>
    </>
  );
}
