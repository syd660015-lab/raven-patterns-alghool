import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Clock, Eye, EyeOff, ListChecks, Pause, Pencil, Send, X } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { RAVEN_QUESTIONS, SET_LABELS } from "@/data/raven-questions";
import { classifyIQ, estimatePercentile, percentileToIQ } from "@/data/raven-norms";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/test/$sessionId")({
  head: () => ({
    meta: [{ title: "تطبيق الاختبار — رافن CPM" }],
  }),
  component: TestPage,
});

function TestPage() {
  const { sessionId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [sessionInfo, setSessionInfo] = useState<{
    subject_name: string;
    subject_age_years: number;
    subject_age_months: number;
    answers: Record<string, number>;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [elapsed, setElapsed] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const [showCorrect, setShowCorrect] = useState(true);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("test_sessions")
        .select("subject_name, subject_age_years, subject_age_months, answers, completed")
        .eq("id", sessionId)
        .single();
      if (error || !data) {
        toast.error("تعذّر تحميل الجلسة");
        navigate({ to: "/" });
        return;
      }
      if (data.completed) {
        navigate({ to: "/result/$sessionId", params: { sessionId } });
        return;
      }
      const ans = (data.answers as Record<string, number>) || {};
      setSessionInfo({
        subject_name: data.subject_name,
        subject_age_years: data.subject_age_years,
        subject_age_months: data.subject_age_months,
        answers: ans,
      });
      setAnswers(ans);
      // jump to first unanswered
      const firstUnanswered = RAVEN_QUESTIONS.findIndex((q) => ans[q.id] === undefined);
      setCurrent(firstUnanswered === -1 ? 0 : firstUnanswered);
      setLoaded(true);
    })();
  }, [user, sessionId, navigate]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const total = RAVEN_QUESTIONS.length;
  const answered = Object.keys(answers).length;
  const q = RAVEN_QUESTIONS[current];
  const progressPct = (answered / total) * 100;

  async function persistAnswers(next: Record<string, number>) {
    await supabase
      .from("test_sessions")
      .update({ answers: next })
      .eq("id", sessionId);
  }

  function selectOption(opt: number) {
    const next = { ...answers, [q.id]: opt };
    setAnswers(next);
    void persistAnswers(next);
    // auto-advance after a short delay
    setTimeout(() => {
      if (current < total - 1) setCurrent((c) => c + 1);
    }, 250);
  }

  async function finish() {
    if (!sessionInfo) return;
    const raw = RAVEN_QUESTIONS.reduce(
      (acc, ques) => acc + (answers[ques.id] === ques.correct ? 1 : 0),
      0
    );
    const percentile = estimatePercentile(raw, sessionInfo.subject_age_years);
    const iq = percentileToIQ(percentile);
    const cls = classifyIQ(iq);

    const { error } = await supabase
      .from("test_sessions")
      .update({
        answers,
        raw_score: raw,
        percentile,
        iq_estimate: iq,
        classification: cls.label,
        duration_seconds: elapsed,
        completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    if (error) {
      toast.error("تعذّر حفظ النتيجة: " + error.message);
      return;
    }
    navigate({ to: "/result/$sessionId", params: { sessionId } });
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  if (!loaded || !sessionInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-hero-gradient" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 mx-auto w-full max-w-5xl px-3 sm:px-6 py-6 space-y-5">
        {/* Status bar */}
        <Card className="border-border/60 shadow-card">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-sm">
                  <span className="text-muted-foreground">المفحوص: </span>
                  <span className="font-bold text-foreground">{sessionInfo.subject_name}</span>
                  <span className="text-muted-foreground"> · {sessionInfo.subject_age_years} سنة {sessionInfo.subject_age_months > 0 ? `و ${sessionInfo.subject_age_months} شهر` : ""}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="gap-1.5 font-mono">
                  <Clock className="h-3.5 w-3.5" />
                  {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                </Badge>
                <Badge className="bg-hero-gradient text-primary-foreground border-0">
                  {answered} / {total}
                </Badge>
              </div>
            </div>
            <Progress value={progressPct} className="h-2" />
          </CardContent>
        </Card>

        {/* Question card */}
        <Card className="border-border/60 shadow-paper bg-paper-gradient overflow-hidden">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="outline" className="text-sm font-bold">
                {SET_LABELS[q.set]} — السؤال {q.index} من 12
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">{q.id}</Badge>
            </div>

            <div className="rounded-2xl bg-white p-2 sm:p-4 shadow-card mx-auto max-w-2xl">
              <img
                src={q.image}
                alt={`مصفوفة رافن ${q.id}`}
                className="w-full h-auto select-none pointer-events-none"
                draggable={false}
              />
            </div>

            <div className="mt-6 grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 max-w-2xl mx-auto">
              {[1, 2, 3, 4, 5, 6].map((opt) => {
                const selected = answers[q.id] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => selectOption(opt)}
                    className={cn(
                      "aspect-square rounded-xl border-2 font-black text-2xl transition-smooth",
                      "hover:scale-105 active:scale-95",
                      selected
                        ? "bg-hero-gradient text-primary-foreground border-transparent shadow-elegant"
                        : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-secondary"
                    )}
                  >
                    {selected ? <Check className="h-7 w-7 mx-auto" /> : opt}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
          >
            <ChevronRight className="ms-2 h-4 w-4" />
            السابق
          </Button>

          <div className="hidden sm:flex flex-wrap gap-1 max-w-md justify-center">
            {RAVEN_QUESTIONS.map((qq, i) => {
              const ans = answers[qq.id] !== undefined;
              const isCurrent = i === current;
              return (
                <button
                  key={qq.id}
                  onClick={() => setCurrent(i)}
                  className={cn(
                    "h-7 w-7 rounded-md text-[10px] font-bold transition-smooth",
                    isCurrent && "ring-2 ring-primary ring-offset-1",
                    ans
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-secondary"
                  )}
                  title={qq.id}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {current < total - 1 ? (
            <Button
              size="lg"
              onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
              className="bg-hero-gradient text-primary-foreground"
            >
              التالي
              <ChevronLeft className="me-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => setReviewMode(true)}
              className="bg-gold-gradient text-gold-foreground shadow-gold hover:opacity-95"
            >
              <ListChecks className="ms-2 h-4 w-4" />
              مراجعة قبل الإنهاء
            </Button>
          )}
        </div>

        {/* Pause */}
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast.success("تم حفظ التقدّم — يمكنك المتابعة لاحقاً");
              navigate({ to: "/sessions" });
            }}
          >
            <Pause className="ms-2 h-4 w-4" />
            إيقاف مؤقت والعودة لاحقاً
          </Button>
        </div>
      </main>
    </div>
  );
}

function FinishDialog({ onConfirm, answered, total }: { onConfirm: () => void; answered: number; total: number }) {
  const allAnswered = answered === total;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="lg" className="bg-gold-gradient text-gold-foreground shadow-gold hover:opacity-95">
          <Send className="ms-2 h-4 w-4" />
          إنهاء الاختبار
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>تأكيد إنهاء الاختبار</AlertDialogTitle>
          <AlertDialogDescription>
            {allAnswered
              ? `تمت الإجابة على جميع الأسئلة (${total}). هل تريد عرض النتيجة الآن؟`
              : `لم تتم الإجابة إلا على ${answered} من ${total} سؤالاً. الأسئلة غير المجابة ستحتسب خاطئة.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>عرض النتيجة</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
