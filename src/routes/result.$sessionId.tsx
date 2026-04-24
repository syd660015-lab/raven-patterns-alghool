import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, Brain, ChartBar, ChevronLeft, Home, Printer, RotateCcw, Trophy, User } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { RAVEN_QUESTIONS, SET_LABELS, type RavenSet } from "@/data/raven-questions";
import { classifyIQ } from "@/data/raven-norms";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/result/$sessionId")({
  head: () => ({
    meta: [{ title: "نتيجة الاختبار — رافن CPM" }],
  }),
  component: ResultPage,
});

interface SessionData {
  id: string;
  subject_name: string;
  subject_age_years: number;
  subject_age_months: number;
  subject_gender: string | null;
  subject_grade: string | null;
  subject_school: string | null;
  notes: string | null;
  answers: Record<string, number>;
  raw_score: number;
  percentile: number | null;
  iq_estimate: number | null;
  classification: string | null;
  duration_seconds: number | null;
  completed_at: string | null;
}

function ResultPage() {
  const { sessionId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("test_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (error || !data) {
        setError("تعذّر تحميل النتيجة");
        return;
      }
      setData(data as unknown as SessionData);
    })();
  }, [user, sessionId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-hero-gradient" />
      </div>
    );
  }

  const iq = data.iq_estimate ?? 100;
  const cls = classifyIQ(iq);
  const minutes = Math.floor((data.duration_seconds ?? 0) / 60);
  const seconds = (data.duration_seconds ?? 0) % 60;

  // breakdown by set
  const setBreakdown: Record<RavenSet, { correct: number; total: number }> = {
    A: { correct: 0, total: 0 },
    Ab: { correct: 0, total: 0 },
    B: { correct: 0, total: 0 },
  };
  for (const q of RAVEN_QUESTIONS) {
    setBreakdown[q.set].total += 1;
    if (data.answers[q.id] === q.correct) setBreakdown[q.set].correct += 1;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 space-y-6 print:py-2">
        {/* Header / actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button asChild variant="ghost" size="sm">
            <Link to="/sessions">
              <ChevronLeft className="ms-1 h-4 w-4" />
              العودة للسجلات
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button onClick={() => window.print()} variant="outline" size="sm">
              <Printer className="ms-2 h-4 w-4" />
              طباعة التقرير
            </Button>
            <Button asChild size="sm" className="bg-hero-gradient text-primary-foreground">
              <Link to="/">
                <Home className="ms-2 h-4 w-4" />
                جلسة جديدة
              </Link>
            </Button>
          </div>
        </div>

        {/* Hero result */}
        <Card className="border-0 shadow-elegant overflow-hidden">
          <div className="bg-hero-gradient text-primary-foreground p-6 sm:p-8 relative">
            <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-gold/30 blur-3xl" />
            <div className="relative grid sm:grid-cols-[1fr_auto] items-center gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs mb-2">
                  <Trophy className="h-3.5 w-3.5" />
                  تقرير نتيجة الاختبار
                </div>
                <h1 className="text-3xl sm:text-4xl font-black mb-1">{data.subject_name}</h1>
                <p className="opacity-90">
                  العمر: {data.subject_age_years} سنة
                  {data.subject_age_months > 0 ? ` و ${data.subject_age_months} شهر` : ""}
                  {data.subject_gender ? ` · ${data.subject_gender}` : ""}
                </p>
              </div>
              <div className="flex flex-col items-center bg-white/15 backdrop-blur rounded-2xl px-6 py-4 shadow-elegant">
                <span className="text-xs uppercase opacity-80 tracking-wider">نسبة الذكاء</span>
                <span className="text-5xl sm:text-6xl font-black leading-none my-1">{iq}</span>
                <span className="text-sm font-medium">{cls.short}</span>
              </div>
            </div>
          </div>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-card-gradient">
            <Stat label="الدرجة الخام" value={`${data.raw_score} / 36`} icon={ChartBar} />
            <Stat label="الرتبة المئينية" value={`${data.percentile ?? "—"}%`} icon={Award} />
            <Stat label="التصنيف" value={cls.label} icon={Brain} compact />
            <Stat
              label="مدة التطبيق"
              value={`${minutes}:${String(seconds).padStart(2, "0")}`}
              icon={User}
            />
          </CardContent>
        </Card>

        {/* Classification explanation */}
        <Card className="border-border/60 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-gold" />
              تفسير التصنيف
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-paper-gradient border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-foreground text-lg">{cls.label}</span>
                <Badge variant="outline" className="font-mono">IQ {cls.min}–{cls.max}</Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                حصل المفحوص على درجة {data.raw_score} من 36، والتي تقابل رتبة مئينية تقديرية قدرها {data.percentile}%،
                أي أنه يتفوق على ما نسبته {data.percentile}% تقريباً من أقرانه في نفس العمر،
                وهو ما يقابل نسبة ذكاء تقديرية تساوي {iq} ضمن فئة <strong>{cls.label}</strong>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Breakdown by set */}
        <Card className="border-border/60 shadow-card">
          <CardHeader>
            <CardTitle>الأداء التفصيلي حسب المجموعات</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            {(Object.keys(setBreakdown) as RavenSet[]).map((s) => {
              const b = setBreakdown[s];
              const pct = (b.correct / b.total) * 100;
              return (
                <div key={s} className="rounded-xl border border-border p-4 bg-card">
                  <div className="text-sm text-muted-foreground mb-1">{SET_LABELS[s]}</div>
                  <div className="text-2xl font-black text-foreground">
                    {b.correct} <span className="text-base text-muted-foreground font-normal">/ {b.total}</span>
                  </div>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-hero-gradient transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Item-by-item answer sheet */}
        <Card className="border-border/60 shadow-card">
          <CardHeader>
            <CardTitle>ورقة الإجابات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
              {RAVEN_QUESTIONS.map((q) => {
                const ans = data.answers[q.id];
                const correct = ans === q.correct;
                const noAns = ans === undefined;
                return (
                  <div
                    key={q.id}
                    className={cn(
                      "rounded-md border p-1.5 text-center text-[10px] font-mono",
                      noAns && "bg-muted text-muted-foreground border-muted",
                      !noAns && correct && "bg-success/15 text-success border-success/30",
                      !noAns && !correct && "bg-destructive/10 text-destructive border-destructive/30"
                    )}
                    title={`${q.id}: إجابة ${ans ?? "—"}, الصحيح ${q.correct}`}
                  >
                    <div className="font-bold">{q.id}</div>
                    <div>{ans ?? "—"} / {q.correct}</div>
                  </div>
                );
              })}
            </div>
            <Separator className="my-4" />
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <LegendDot color="bg-success/30" label="إجابة صحيحة" />
              <LegendDot color="bg-destructive/20" label="إجابة خاطئة" />
              <LegendDot color="bg-muted" label="بدون إجابة" />
            </div>
          </CardContent>
        </Card>

        {data.notes && (
          <Card className="border-border/60 shadow-card">
            <CardHeader>
              <CardTitle>ملاحظات الأخصائي</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{data.notes}</p>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center gap-3 print:hidden">
          <Button asChild variant="outline">
            <Link to="/">
              <RotateCcw className="ms-2 h-4 w-4" />
              تطبيق جلسة جديدة
            </Link>
          </Button>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

function Stat({
  label, value, icon: Icon, compact,
}: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; compact?: boolean }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className={cn("font-black text-foreground", compact ? "text-base leading-tight" : "text-2xl")}>
        {value}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm", color)} />
      <span>{label}</span>
    </div>
  );
}
