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

// ──────────────────────────────────────────────────────────────────────────────
// Compare two versions visually (cell-by-cell diff)
// ──────────────────────────────────────────────────────────────────────────────

const BUILTIN_COMPARE_ID = "__builtin__";

function CompareDialog({
  tables, currentId,
}: {
  tables: NormTable[];
  currentId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [leftRows, setLeftRows] = useState<NormRow[] | null>(null);
  const [rightRows, setRightRows] = useState<NormRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  // Optional report header/footer fields (persist locally for convenience)
  const [specialistName, setSpecialistName] = useState<string>("");
  const [sessionDate, setSessionDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10),
  );
  const [caseFileNo, setCaseFileNo] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("norms.reportMeta");
    if (saved) {
      try {
        const o = JSON.parse(saved);
        if (typeof o.specialistName === "string") setSpecialistName(o.specialistName);
        if (typeof o.caseFileNo === "string") setCaseFileNo(o.caseFileNo);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "norms.reportMeta",
      JSON.stringify({ specialistName, caseFileNo }),
    );
  }, [specialistName, caseFileNo]);

  const reportMeta: ReportMeta = {
    specialistName: specialistName.trim(),
    sessionDate: sessionDate.trim(),
    caseFileNo: caseFileNo.trim(),
  };

  // Initialize sensible defaults when opened
  useEffect(() => {
    if (!open) return;
    const active = tables.find((t) => t.is_active);
    const initialLeft = currentId ?? active?.id ?? tables[0]?.id ?? "";
    setLeftId(initialLeft);
    const other = tables.find((t) => t.id !== initialLeft);
    setRightId(other?.id ?? BUILTIN_COMPARE_ID);
  }, [open, currentId, tables]);

  // Fetch rows whenever a side changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadSide(id: string): Promise<NormRow[]> {
      if (!id) return [];
      if (id === BUILTIN_COMPARE_ID) {
        return CPM_NORMS.map((r) => ({
          age_min: r.ageMin, age_max: r.ageMax,
          p5: r.p5, p10: r.p10, p25: r.p25, p50: r.p50, p75: r.p75, p90: r.p90, p95: r.p95,
        }));
      }
      const { data } = await supabase
        .from("norm_rows")
        .select("age_min, age_max, p5, p10, p25, p50, p75, p90, p95")
        .eq("table_id", id)
        .order("age_min", { ascending: true });
      return (data ?? []) as NormRow[];
    }
    (async () => {
      setBusy(true);
      const [l, r] = await Promise.all([loadSide(leftId), loadSide(rightId)]);
      if (cancelled) return;
      setLeftRows(l);
      setRightRows(r);
      setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [open, leftId, rightId]);

  const leftLabel = leftId === BUILTIN_COMPARE_ID
    ? "النسخة المدمجة (القياسية)"
    : tables.find((t) => t.id === leftId)?.name ?? "—";
  const rightLabel = rightId === BUILTIN_COMPARE_ID
    ? "النسخة المدمجة (القياسية)"
    : tables.find((t) => t.id === rightId)?.name ?? "—";

  // Build merged set of age groups (by age_min-age_max key)
  const mergedAgeKeys = useMemo(() => {
    const keys = new Set<string>();
    [...(leftRows ?? []), ...(rightRows ?? [])].forEach((r) =>
      keys.add(`${r.age_min}-${r.age_max}`)
    );
    return Array.from(keys).sort((a, b) => {
      const [a1] = a.split("-").map(Number);
      const [b1] = b.split("-").map(Number);
      return a1 - b1;
    });
  }, [leftRows, rightRows]);

  function rowFor(rows: NormRow[] | null, key: string): NormRow | undefined {
    if (!rows) return undefined;
    return rows.find((r) => `${r.age_min}-${r.age_max}` === key);
  }

  // Stats
  const stats = useMemo(() => {
    let changed = 0, added = 0, removed = 0, identical = 0;
    let totalDelta = 0, deltaCount = 0;
    for (const k of mergedAgeKeys) {
      const a = rowFor(leftRows, k);
      const b = rowFor(rightRows, k);
      if (a && !b) { removed++; continue; }
      if (!a && b) { added++; continue; }
      if (!a || !b) continue;
      let rowChanged = false;
      for (const p of PERCENTILE_KEYS) {
        if (a[p] !== b[p]) {
          rowChanged = true;
          totalDelta += Math.abs(b[p] - a[p]);
          deltaCount++;
        }
      }
      if (rowChanged) changed++; else identical++;
    }
    return {
      changed, added, removed, identical,
      avgAbsDelta: deltaCount ? (totalDelta / deltaCount).toFixed(2) : "0",
      cellChanges: deltaCount,
    };
  }, [mergedAgeKeys, leftRows, rightRows]);

  const sameSide = leftId && rightId && leftId === rightId;

  // Build select options including the built-in standard reference
  const options = useMemo(() => [
    ...tables.map((t) => ({ id: t.id, name: t.name, is_active: t.is_active, is_default: t.is_default })),
    { id: BUILTIN_COMPARE_ID, name: "النسخة المدمجة (القياسية)", is_active: false, is_default: true },
  ], [tables]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={tables.length === 0}>
          <ArrowLeftRight className="ms-2 h-4 w-4" />
          مقارنة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            مقارنة بصرية بين نسختين من المعايير
          </DialogTitle>
          <DialogDescription>
            اختر نسختين لعرض الفروقات في كل خلية. يفيدك ذلك قبل تفعيل نسخة جديدة أو التبديل بين نسختين.
          </DialogDescription>
        </DialogHeader>

        {/* Side selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">النسخة (أ) — المرجع</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={leftId}
              onChange={(e) => setLeftId(e.target.value)}
            >
              {options.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_active ? " ★" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">النسخة (ب) — المُقارَنة</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={rightId}
              onChange={(e) => setRightId(e.target.value)}
            >
              {options.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_active ? " ★" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Optional report header/footer fields */}
        <details className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
          <summary className="cursor-pointer select-none text-xs font-bold flex items-center gap-2">
            <ClipboardList className="h-3.5 w-3.5 text-primary" />
            بيانات التقرير (اختيارية) — تُضمَّن في رأس وتذييل CSV/PDF
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <div>
              <Label className="text-xs">اسم المُختص</Label>
              <Input
                value={specialistName}
                onChange={(e) => setSpecialistName(e.target.value)}
                placeholder="مثال: د. سارة الأحمد"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">تاريخ الجلسة</Label>
              <Input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">رقم ملف الحالة</Label>
              <Input
                value={caseFileNo}
                onChange={(e) => setCaseFileNo(e.target.value)}
                placeholder="مثال: CASE-2026-0142"
                className="h-9"
              />
            </div>
          </div>
        </details>

        {sameSide && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs">
            النسختان متطابقتان — اختر نسخة مختلفة في أحد الجانبين لعرض الفروقات.
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <SummaryCell label="صفوف متطابقة" value={stats.identical} tone="neutral" />
          <SummaryCell label="صفوف بها تغيير" value={stats.changed} tone="warn" />
          <SummaryCell label="مضافة في (ب)" value={stats.added} tone="add" />
          <SummaryCell label="محذوفة في (ب)" value={stats.removed} tone="remove" />
          <SummaryCell label="متوسط فرق الخلايا" value={stats.avgAbsDelta} tone="neutral" />
        </div>

        {/* Diff table */}
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {busy ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-secondary/60">
                    <tr>
                      <th className="px-2 py-2 text-start font-bold sticky start-0 bg-secondary/60 z-10">
                        الفئة العمرية
                      </th>
                      {PERCENTILE_KEYS.map((k) => (
                        <th key={k} className="px-2 py-2 font-bold text-center min-w-[88px]">
                          مئين {PERCENTILE_LABELS[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mergedAgeKeys.length === 0 && (
                      <tr>
                        <td colSpan={PERCENTILE_KEYS.length + 1} className="text-center py-8 text-muted-foreground">
                          لا توجد بيانات للعرض.
                        </td>
                      </tr>
                    )}
                    {mergedAgeKeys.map((key) => {
                      const a = rowFor(leftRows, key);
                      const b = rowFor(rightRows, key);
                      const status = a && !b ? "removed" : !a && b ? "added" : "compare";
                      return (
                        <tr
                          key={key}
                          className={cn(
                            "border-t border-border/60 align-top",
                            status === "added" && "bg-emerald-50/60 dark:bg-emerald-950/20",
                            status === "removed" && "bg-rose-50/60 dark:bg-rose-950/20",
                          )}
                        >
                          <td className="px-2 py-2 font-bold whitespace-nowrap sticky start-0 bg-inherit">
                            {key.replace("-", "–")} سنة
                            {status === "added" && (
                              <Badge variant="outline" className="ms-1 text-[10px] border-emerald-400 text-emerald-700">جديد</Badge>
                            )}
                            {status === "removed" && (
                              <Badge variant="outline" className="ms-1 text-[10px] border-rose-400 text-rose-700">محذوف</Badge>
                            )}
                          </td>
                          {PERCENTILE_KEYS.map((p) => {
                            const av = a?.[p];
                            const bv = b?.[p];
                            return (
                              <td key={p} className="px-1 py-1.5 text-center">
                                <DiffCell aValue={av} bValue={bv} />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="font-bold">دلالات الألوان:</span>
          <LegendDot className="bg-muted" label={`(أ) ${leftLabel}`} />
          <LegendDot className="bg-emerald-500" label="ارتفاع في (ب)" />
          <LegendDot className="bg-rose-500" label="انخفاض في (ب)" />
          <LegendDot className="bg-amber-400" label="بدون تغيير" />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={busy || mergedAgeKeys.length === 0 || !!sameSide}
              >
                <Download className="ms-2 h-4 w-4" />
                تصدير المقارنة
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">تنسيق التصدير</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  exportComparisonCsv({
                    leftLabel, rightLabel, mergedAgeKeys,
                    leftRows, rightRows, stats, meta: reportMeta,
                  })
                }
              >
                <FileSpreadsheet className="ms-2 h-4 w-4" />
                CSV (مع ملخص Δ)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  exportComparisonPdf({
                    leftLabel, rightLabel, mergedAgeKeys,
                    leftRows, rightRows, stats, meta: reportMeta,
                  })
                }
              >
                <FileJson className="ms-2 h-4 w-4" />
                PDF (تقرير مرئي للطباعة)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setOpen(false)}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Comparison Export Helpers ----------

interface ReportMeta {
  specialistName: string;
  sessionDate: string;
  caseFileNo: string;
}

interface ComparisonExportArgs {
  leftLabel: string;
  rightLabel: string;
  mergedAgeKeys: string[];
  leftRows: NormRow[] | null;
  rightRows: NormRow[] | null;
  stats: {
    changed: number; added: number; removed: number; identical: number;
    avgAbsDelta: string; cellChanges: number;
  };
  meta?: ReportMeta;
}

function formatDateAr(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ar", { year: "numeric", month: "long", day: "numeric" });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function findRow(rows: NormRow[] | null, key: string): NormRow | undefined {
  if (!rows) return undefined;
  return rows.find((r) => `${r.age_min}-${r.age_max}` === key);
}

function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 40) || "norms";
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function exportComparisonCsv(args: ComparisonExportArgs) {
  const { leftLabel, rightLabel, mergedAgeKeys, leftRows, rightRows, stats, meta } = args;
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

  const lines: string[] = [];
  // Header section
  lines.push(`تقرير مقارنة جداول المعايير`);
  if (meta?.specialistName) lines.push(`اسم المُختص,${esc(meta.specialistName)}`);
  if (meta?.sessionDate) lines.push(`تاريخ الجلسة,${esc(formatDateAr(meta.sessionDate))}`);
  if (meta?.caseFileNo) lines.push(`رقم ملف الحالة,${esc(meta.caseFileNo)}`);
  lines.push(`النسخة (أ),${esc(leftLabel)}`);
  lines.push(`النسخة (ب),${esc(rightLabel)}`);
  lines.push(`تاريخ التصدير,${esc(new Date().toLocaleString("ar"))}`);
  lines.push("");
  // Summary
  lines.push(`ملخص,القيمة`);
  lines.push(`صفوف متطابقة,${stats.identical}`);
  lines.push(`صفوف بها تغيير,${stats.changed}`);
  lines.push(`مضافة في (ب),${stats.added}`);
  lines.push(`محذوفة في (ب),${stats.removed}`);
  lines.push(`إجمالي خلايا متغيّرة,${stats.cellChanges}`);
  lines.push(`متوسط فرق الخلايا |Δ|,${stats.avgAbsDelta}`);
  lines.push("");

  // Per-cell delta table: age × percentile, with A→B and Δ
  const header = ["الفئة العمرية", "الحالة"];
  for (const p of PERCENTILE_KEYS) {
    header.push(`مئين ${PERCENTILE_LABELS[p]} (أ)`);
    header.push(`مئين ${PERCENTILE_LABELS[p]} (ب)`);
    header.push(`Δ ${PERCENTILE_LABELS[p]}`);
  }
  lines.push(header.join(","));

  // Per-percentile delta accumulators (for summary)
  const perPercentileSum: Record<string, number> = {};
  const perPercentileCount: Record<string, number> = {};
  for (const p of PERCENTILE_KEYS) { perPercentileSum[p] = 0; perPercentileCount[p] = 0; }

  for (const key of mergedAgeKeys) {
    const a = findRow(leftRows, key);
    const b = findRow(rightRows, key);
    const status = a && !b ? "محذوف" : !a && b ? "جديد" : a && b ? "مقارنة" : "—";
    const row: string[] = [`"${key.replace("-", "–")} سنة"`, status];
    for (const p of PERCENTILE_KEYS) {
      const av = a?.[p];
      const bv = b?.[p];
      row.push(av === undefined ? "" : String(av));
      row.push(bv === undefined ? "" : String(bv));
      if (av !== undefined && bv !== undefined) {
        const d = bv - av;
        row.push(d === 0 ? "0" : (d > 0 ? `+${d}` : `${d}`));
        if (d !== 0) {
          perPercentileSum[p] += Math.abs(d);
          perPercentileCount[p] += 1;
        }
      } else {
        row.push("");
      }
    }
    lines.push(row.join(","));
  }

  // Per-percentile delta summary block
  lines.push("");
  lines.push(`ملخص Δ لكل مئين,إجمالي |Δ|,عدد الخلايا المتغيرة,متوسط |Δ|`);
  for (const p of PERCENTILE_KEYS) {
    const sum = perPercentileSum[p];
    const cnt = perPercentileCount[p];
    const avg = cnt ? (sum / cnt).toFixed(2) : "0";
    lines.push(`مئين ${PERCENTILE_LABELS[p]},${sum},${cnt},${avg}`);
  }

  // Per-age delta summary block
  lines.push("");
  lines.push(`ملخص Δ لكل فئة عمرية,إجمالي |Δ|,عدد الخلايا المتغيرة,متوسط |Δ|`);
  for (const key of mergedAgeKeys) {
    const a = findRow(leftRows, key);
    const b = findRow(rightRows, key);
    let sum = 0, cnt = 0;
    if (a && b) {
      for (const p of PERCENTILE_KEYS) {
        if (a[p] !== b[p]) { sum += Math.abs(b[p] - a[p]); cnt++; }
      }
    }
    const avg = cnt ? (sum / cnt).toFixed(2) : "0";
    lines.push(`"${key.replace("-", "–")} سنة",${sum},${cnt},${avg}`);
  }

  // Footer
  lines.push("");
  lines.push(`— تذييل التقرير —`);
  if (meta?.specialistName) lines.push(`المُختص,${esc(meta.specialistName)}`);
  if (meta?.sessionDate) lines.push(`تاريخ الجلسة,${esc(formatDateAr(meta.sessionDate))}`);
  if (meta?.caseFileNo) lines.push(`رقم ملف الحالة,${esc(meta.caseFileNo)}`);
  lines.push(`تم التوليد بواسطة,${esc("نظام إدارة معايير اختبار رافن CPM")}`);

  // UTF-8 BOM for Excel Arabic compatibility
  const csv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const filePrefix = meta?.caseFileNo ? `${safeFileName(meta.caseFileNo)}_` : "";
  a.download = `${filePrefix}comparison_${safeFileName(leftLabel)}_vs_${safeFileName(rightLabel)}_${timestamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("تم تصدير ملف CSV");
}

function exportComparisonPdf(args: ComparisonExportArgs) {
  const { leftLabel, rightLabel, mergedAgeKeys, leftRows, rightRows, stats, meta } = args;

  // Per-percentile aggregates
  const perPercentile: Array<{ key: string; label: string; sum: number; count: number; avg: string }> = [];
  for (const p of PERCENTILE_KEYS) {
    let sum = 0, cnt = 0;
    for (const key of mergedAgeKeys) {
      const a = findRow(leftRows, key);
      const b = findRow(rightRows, key);
      if (a && b && a[p] !== b[p]) { sum += Math.abs(b[p] - a[p]); cnt++; }
    }
    perPercentile.push({
      key: p, label: PERCENTILE_LABELS[p],
      sum, count: cnt, avg: cnt ? (sum / cnt).toFixed(2) : "0",
    });
  }

  // Per-age aggregates
  const perAge = mergedAgeKeys.map((key) => {
    const a = findRow(leftRows, key);
    const b = findRow(rightRows, key);
    let sum = 0, cnt = 0;
    if (a && b) {
      for (const p of PERCENTILE_KEYS) {
        if (a[p] !== b[p]) { sum += Math.abs(b[p] - a[p]); cnt++; }
      }
    }
    return {
      key, sum, count: cnt,
      avg: cnt ? (sum / cnt).toFixed(2) : "0",
      status: a && !b ? "removed" : !a && b ? "added" : "compare",
    };
  });

  // Build diff cells
  const diffRows = mergedAgeKeys.map((key) => {
    const a = findRow(leftRows, key);
    const b = findRow(rightRows, key);
    const status = a && !b ? "removed" : !a && b ? "added" : "compare";
    const cells = PERCENTILE_KEYS.map((p) => {
      const av = a?.[p];
      const bv = b?.[p];
      let html = "—";
      let bg = "transparent";
      if (av !== undefined && bv !== undefined) {
        const d = bv - av;
        if (d === 0) {
          html = `<span style="color:#666">${av}</span>`;
        } else {
          bg = d > 0 ? "#d1fae5" : "#fee2e2";
          const color = d > 0 ? "#065f46" : "#991b1b";
          const sign = d > 0 ? "+" : "";
          html = `<span style="color:${color};"><s style="opacity:.6">${av}</s> → <b>${bv}</b><br/><small>${sign}${d}</small></span>`;
        }
      } else if (av === undefined && bv !== undefined) {
        bg = "#d1fae5";
        html = `<span style="color:#065f46"><b>${bv}</b><br/><small>جديد</small></span>`;
      } else if (av !== undefined && bv === undefined) {
        bg = "#fee2e2";
        html = `<span style="color:#991b1b"><s>${av}</s><br/><small>محذوف</small></span>`;
      }
      return `<td style="background:${bg};text-align:center;padding:6px;border:1px solid #e5e7eb;font-size:11px;">${html}</td>`;
    }).join("");
    const rowBg = status === "added" ? "background:#ecfdf5;" : status === "removed" ? "background:#fef2f2;" : "";
    const badge = status === "added"
      ? ' <span style="font-size:9px;border:1px solid #10b981;color:#065f46;padding:1px 4px;border-radius:4px;">جديد</span>'
      : status === "removed"
        ? ' <span style="font-size:9px;border:1px solid #ef4444;color:#991b1b;padding:1px 4px;border-radius:4px;">محذوف</span>'
        : "";
    return `<tr style="${rowBg}"><td style="padding:6px;border:1px solid #e5e7eb;font-weight:bold;white-space:nowrap;font-size:11px;">${key.replace("-", "–")} سنة${badge}</td>${cells}</tr>`;
  }).join("");

  const percentileHeaders = PERCENTILE_KEYS
    .map((p) => `<th style="padding:6px;border:1px solid #e5e7eb;background:#f3f4f6;font-size:11px;">مئين ${PERCENTILE_LABELS[p]}</th>`)
    .join("");

  const summaryCards = [
    { label: "متطابقة", value: stats.identical, color: "#6b7280" },
    { label: "بها تغيير", value: stats.changed, color: "#d97706" },
    { label: "مضافة (ب)", value: stats.added, color: "#059669" },
    { label: "محذوفة (ب)", value: stats.removed, color: "#dc2626" },
    { label: "متوسط |Δ|", value: stats.avgAbsDelta, color: "#2563eb" },
  ].map((c) => `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;text-align:center;min-width:90px;">
      <div style="font-size:10px;color:#6b7280;">${c.label}</div>
      <div style="font-size:18px;font-weight:900;color:${c.color};font-family:monospace;">${c.value}</div>
    </div>`).join("");

  const perPercentileRows = perPercentile.map((p) => `
    <tr>
      <td style="padding:6px;border:1px solid #e5e7eb;font-weight:bold;">مئين ${p.label}</td>
      <td style="padding:6px;border:1px solid #e5e7eb;text-align:center;font-family:monospace;">${p.sum}</td>
      <td style="padding:6px;border:1px solid #e5e7eb;text-align:center;font-family:monospace;">${p.count}</td>
      <td style="padding:6px;border:1px solid #e5e7eb;text-align:center;font-family:monospace;">${p.avg}</td>
    </tr>`).join("");

  const perAgeRows = perAge.map((r) => `
    <tr>
      <td style="padding:6px;border:1px solid #e5e7eb;font-weight:bold;">${r.key.replace("-", "–")} سنة</td>
      <td style="padding:6px;border:1px solid #e5e7eb;text-align:center;font-family:monospace;">${r.sum}</td>
      <td style="padding:6px;border:1px solid #e5e7eb;text-align:center;font-family:monospace;">${r.count}</td>
      <td style="padding:6px;border:1px solid #e5e7eb;text-align:center;font-family:monospace;">${r.avg}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>تقرير مقارنة المعايير - ${leftLabel} vs ${rightLabel}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: -apple-system, "Segoe UI", Tahoma, Arial, sans-serif; color:#111827; margin:0; padding:16px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 18px 0 8px; padding-bottom:4px; border-bottom:2px solid #e5e7eb; }
  table { border-collapse: collapse; width: 100%; }
  .meta { font-size: 12px; color:#4b5563; margin-bottom: 12px; }
  .meta-grid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:6px 16px; padding:8px 12px; border:1px solid #e5e7eb; border-radius:8px; background:#f9fafb; margin-bottom:12px; font-size:12px; }
  .meta-grid .lbl { color:#6b7280; font-size:10px; }
  .meta-grid .val { color:#111827; font-weight:bold; }
  .case-pill { display:inline-block; background:#1e3a8a; color:#fff; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:bold; margin-inline-start:8px; vertical-align:middle; }
  .summary { display:flex; gap:8px; flex-wrap:wrap; margin: 12px 0; }
  .footer { margin-top: 18px; padding-top:10px; border-top:1px solid #e5e7eb; font-size: 10px; color:#6b7280; }
  .footer .sig-row { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; margin-bottom:8px; }
  .footer .sig-box { flex:1; }
  .footer .sig-line { border-top:1px solid #9ca3af; margin-top:32px; padding-top:4px; text-align:center; font-size:10px; color:#374151; }
  .footer .gen-note { text-align:center; font-style:italic; }
  @media print { .no-print { display:none; } }
  .actions { position:fixed; top:8px; left:8px; }
  .actions button { padding:8px 14px; border-radius:6px; border:1px solid #2563eb; background:#2563eb; color:#fff; font-weight:bold; cursor:pointer; }
</style>
</head>
<body>
  <div class="actions no-print">
    <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
  </div>
  <h1>تقرير مقارنة جداول المعايير</h1>
  <div class="meta">
    <div><b>النسخة (أ):</b> ${leftLabel}</div>
    <div><b>النسخة (ب):</b> ${rightLabel}</div>
    <div><b>تاريخ التصدير:</b> ${new Date().toLocaleString("ar")}</div>
  </div>

  <div class="summary">${summaryCards}</div>

  <h2>الفروقات التفصيلية</h2>
  <table>
    <thead>
      <tr>
        <th style="padding:6px;border:1px solid #e5e7eb;background:#f3f4f6;font-size:11px;">الفئة العمرية</th>
        ${percentileHeaders}
      </tr>
    </thead>
    <tbody>${diffRows || `<tr><td colspan="${PERCENTILE_KEYS.length + 1}" style="padding:16px;text-align:center;color:#6b7280;">لا توجد بيانات</td></tr>`}</tbody>
  </table>

  <h2>ملخص Δ لكل مئين</h2>
  <table>
    <thead>
      <tr>
        <th style="padding:6px;border:1px solid #e5e7eb;background:#f3f4f6;">المئين</th>
        <th style="padding:6px;border:1px solid #e5e7eb;background:#f3f4f6;">إجمالي |Δ|</th>
        <th style="padding:6px;border:1px solid #e5e7eb;background:#f3f4f6;">عدد الخلايا</th>
        <th style="padding:6px;border:1px solid #e5e7eb;background:#f3f4f6;">متوسط |Δ|</th>
      </tr>
    </thead>
    <tbody>${perPercentileRows}</tbody>
  </table>

  <h2>ملخص Δ لكل فئة عمرية</h2>
  <table>
    <thead>
      <tr>
        <th style="padding:6px;border:1px solid #e5e7eb;background:#f3f4f6;">الفئة العمرية</th>
        <th style="padding:6px;border:1px solid #e5e7eb;background:#f3f4f6;">إجمالي |Δ|</th>
        <th style="padding:6px;border:1px solid #e5e7eb;background:#f3f4f6;">عدد الخلايا</th>
        <th style="padding:6px;border:1px solid #e5e7eb;background:#f3f4f6;">متوسط |Δ|</th>
      </tr>
    </thead>
    <tbody>${perAgeRows}</tbody>
  </table>

  <div class="footer">تم إنشاء هذا التقرير تلقائياً من نظام إدارة معايير اختبار رافن CPM</div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    URL.revokeObjectURL(url);
    toast.error("تعذّر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.");
    return;
  }
  toast.success("تم فتح التقرير — استخدم زر الطباعة لحفظه PDF");
  // Revoke later to ensure window has loaded
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function DiffCell({ aValue, bValue }: { aValue?: number; bValue?: number }) {
  if (aValue === undefined && bValue === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (aValue === undefined) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-muted-foreground line-through text-[10px]">—</span>
        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{bValue}</span>
      </div>
    );
  }
  if (bValue === undefined) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-mono text-muted-foreground line-through">{aValue}</span>
        <span className="text-rose-700 dark:text-rose-400 text-[10px]">محذوف</span>
      </div>
    );
  }
  const delta = bValue - aValue;
  if (delta === 0) {
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        <span className="font-mono">{aValue}</span>
        <Minus className="h-3 w-3 opacity-50" />
      </div>
    );
  }
  const up = delta > 0;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-md px-1.5 py-1",
        up
          ? "bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
          : "bg-rose-100/70 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300"
      )}
    >
      <div className="flex items-center gap-1 font-mono text-[11px]">
        <span className="opacity-60 line-through">{aValue}</span>
        <span>→</span>
        <span className="font-bold">{bValue}</span>
      </div>
      <div className="flex items-center gap-0.5 text-[10px] font-bold">
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {up ? "+" : ""}{delta}
      </div>
    </div>
  );
}

function SummaryCell({
  label, value, tone,
}: {
  label: string;
  value: string | number;
  tone: "neutral" | "warn" | "add" | "remove";
}) {
  const toneClass = {
    neutral: "bg-secondary/60 text-foreground",
    warn: "bg-amber-100/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300/60",
    add: "bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border-emerald-300/60",
    remove: "bg-rose-100/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300 border-rose-300/60",
  }[tone];
  return (
    <div className={cn("rounded-lg border border-border px-2 py-1.5 text-center", toneClass)}>
      <div className="text-[10px] opacity-80">{label}</div>
      <div className="font-mono font-black text-base leading-tight">{value}</div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-2.5 w-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}
