import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Eye, FileText, Play, Plus, Trash2, User, Calendar, Brain, Search } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { classifyIQ } from "@/data/raven-norms";

export const Route = createFileRoute("/sessions")({
  head: () => ({
    meta: [{ title: "السجلات السابقة — رافن CPM" }],
  }),
  component: SessionsPage,
});

interface Row {
  id: string;
  subject_name: string;
  subject_age_years: number;
  subject_age_months: number;
  subject_gender: string | null;
  subject_grade: string | null;
  raw_score: number;
  iq_estimate: number | null;
  classification: string | null;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
}

function SessionsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  async function loadRows() {
    if (!user) return;
    const { data, error } = await supabase
      .from("test_sessions")
      .select("id, subject_name, subject_age_years, subject_age_months, subject_gender, subject_grade, raw_score, iq_estimate, classification, completed, created_at, completed_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("تعذّر تحميل السجلات");
      return;
    }
    setRows(data as Row[]);
  }

  useEffect(() => { void loadRows(); }, [user]);

  async function deleteSession(id: string) {
    const { error } = await supabase.from("test_sessions").delete().eq("id", id);
    if (error) {
      toast.error("تعذّر الحذف: " + error.message);
      return;
    }
    toast.success("تم الحذف");
    void loadRows();
  }

  const filtered = (rows ?? []).filter((r) =>
    r.subject_name.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ChevronLeft className="ms-1 h-4 w-4" />
                الرئيسية
              </Link>
            </Button>
            <h1 className="text-2xl sm:text-3xl font-black mt-2">السجلات السابقة</h1>
            <p className="text-muted-foreground mt-1">
              جميع جلسات الاختبار التي أجريتها — مكتملة وغير مكتملة
            </p>
          </div>
          <Button asChild className="bg-hero-gradient text-primary-foreground">
            <Link to="/">
              <Plus className="ms-2 h-4 w-4" />
              جلسة جديدة
            </Link>
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث باسم المفحوص..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-10"
          />
        </div>

        {rows === null && (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-pulse rounded-2xl bg-hero-gradient" />
          </div>
        )}

        {rows !== null && filtered.length === 0 && (
          <Card className="border-dashed border-border/80 shadow-none">
            <CardContent className="text-center py-16">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
                <FileText className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-bold mb-1">لا توجد جلسات بعد</h2>
              <p className="text-muted-foreground mb-4">ابدأ أول جلسة اختبار من الصفحة الرئيسية</p>
              <Button asChild className="bg-hero-gradient text-primary-foreground">
                <Link to="/"><Plus className="ms-2 h-4 w-4" />جلسة جديدة</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3">
          {filtered.map((r) => {
            const cls = r.iq_estimate ? classifyIQ(r.iq_estimate) : null;
            const date = new Date(r.completed_at ?? r.created_at).toLocaleDateString("ar-EG", {
              year: "numeric", month: "long", day: "numeric",
            });
            return (
              <Card key={r.id} className="border-border/60 shadow-card hover:shadow-paper transition-smooth">
                <CardContent className="p-4 sm:p-5 grid sm:grid-cols-[1fr_auto] gap-4 items-center">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-foreground">{r.subject_name}</h3>
                      {r.completed ? (
                        <Badge className="bg-success text-success-foreground border-0">مكتمل</Badge>
                      ) : (
                        <Badge variant="outline">قيد التطبيق</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {r.subject_age_years} سنة{r.subject_age_months > 0 ? ` و ${r.subject_age_months} شهر` : ""}
                        {r.subject_gender ? ` · ${r.subject_gender}` : ""}
                      </span>
                      {r.subject_grade && <span>{r.subject_grade}</span>}
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {date}
                      </span>
                    </div>
                    {r.completed && cls && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Badge variant="secondary" className="font-mono">
                          <Brain className="ms-1 h-3 w-3" />
                          IQ {r.iq_estimate}
                        </Badge>
                        <Badge variant="outline">{cls.label}</Badge>
                        <Badge variant="outline" className="font-mono">{r.raw_score}/36</Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-row sm:flex-col gap-2 sm:items-stretch">
                    {r.completed ? (
                      <Button asChild size="sm" className="bg-hero-gradient text-primary-foreground">
                        <Link to="/result/$sessionId" params={{ sessionId: r.id }}>
                          <Eye className="ms-2 h-4 w-4" />
                          عرض النتيجة
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" className="bg-gold-gradient text-gold-foreground">
                        <Link to="/test/$sessionId" params={{ sessionId: r.id }}>
                          <Play className="ms-2 h-4 w-4" />
                          متابعة
                        </Link>
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف الجلسة؟</AlertDialogTitle>
                          <AlertDialogDescription>
                            سيتم حذف بيانات {r.subject_name} ونتائج اختباره نهائياً. لا يمكن التراجع.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteSession(r.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            حذف نهائي
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
