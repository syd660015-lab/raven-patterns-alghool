import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Brain, ClipboardList, History, Play, ShieldCheck, Sparkles, GraduationCap, BookOpen, AlertTriangle, LifeBuoy, CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "اختبار مصفوفات رافن الملونة CPM — لوحة التحكم" }],
  }),
  component: HomePage,
});

const subjectSchema = z.object({
  subject_name: z.string().trim().min(2, "اسم المفحوص مطلوب").max(100),
  subject_age_years: z.number().int().min(4, "العمر صغير جداً").max(18, "العمر خارج النطاق"),
  subject_age_months: z.number().int().min(0).max(11),
  subject_gender: z.string().optional(),
  subject_grade: z.string().optional(),
  subject_school: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-hero-gradient" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 space-y-10">
        <Hero />
        <NewSessionForm />
        <InfoCards />
      </main>
      <AppFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="rounded-3xl bg-hero-gradient text-primary-foreground p-8 sm:p-10 shadow-elegant relative overflow-hidden">
      <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-gold/30 blur-3xl" />
      <div className="relative z-10 grid sm:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>أداة تشخيص نفسي تربوي</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-3">
            ابدأ تطبيق اختبار رافن CPM
          </h1>
          <p className="text-base sm:text-lg opacity-90 leading-relaxed max-w-xl">
            أدخل بيانات المفحوص ثم انتقل لـ 36 مصفوفة بصرية. سيتم حساب الدرجة الخام،
            الرتبة المئينية، نسبة الذكاء التقديرية، والتصنيف تلقائياً.
          </p>
        </div>
        <div className="hidden sm:flex h-28 w-28 items-center justify-center rounded-3xl bg-white/15 backdrop-blur shadow-elegant">
          <Brain className="h-14 w-14" />
        </div>
      </div>
    </section>
  );
}

function NewSessionForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [birthDate, setBirthDate] = useState<string>("");
  const [form, setForm] = useState({
    subject_name: "",
    subject_age_years: 8,
    subject_age_months: 0,
    subject_gender: "",
    subject_grade: "",
    subject_school: "",
    notes: "",
  });

  // Auto-compute chronological age from birth date
  function computeAge(dob: string): { years: number; months: number; days: number } | null {
    if (!dob) return null;
    const b = new Date(dob);
    if (isNaN(b.getTime())) return null;
    const now = new Date();
    if (b > now) return null;
    let years = now.getFullYear() - b.getFullYear();
    let months = now.getMonth() - b.getMonth();
    let days = now.getDate() - b.getDate();
    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    return { years, months, days };
  }

  const computedAge = computeAge(birthDate);

  useEffect(() => {
    if (!computedAge) return;
    const y = Math.min(18, Math.max(4, computedAge.years));
    const m = Math.min(11, Math.max(0, computedAge.months));
    setForm((f) =>
      f.subject_age_years === y && f.subject_age_months === m
        ? f
        : { ...f, subject_age_years: y, subject_age_months: m },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthDate]);

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function startTest(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = subjectSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("test_sessions")
      .insert({
        user_id: user.id,
        subject_name: form.subject_name.trim(),
        subject_age_years: form.subject_age_years,
        subject_age_months: form.subject_age_months,
        subject_gender: form.subject_gender || null,
        subject_grade: form.subject_grade?.trim() || null,
        subject_school: form.subject_school?.trim() || null,
        notes: form.notes?.trim() || null,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error("تعذّر إنشاء الجلسة: " + (error?.message ?? "خطأ غير معروف"));
      return;
    }
    navigate({ to: "/test/$sessionId", params: { sessionId: data.id } });
  }

  const ageOptions = useMemo(() => Array.from({ length: 15 }, (_, i) => i + 4), []);

  return (
    <Card className="shadow-paper border-border/60 overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-gradient text-gold-foreground">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>جلسة اختبار جديدة</CardTitle>
            <CardDescription>أدخل بيانات المفحوص للبدء</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={startTest} className="grid sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <Label htmlFor="name">اسم المفحوص *</Label>
            <Input
              id="name"
              value={form.subject_name}
              onChange={(e) => update("subject_name", e.target.value)}
              placeholder="الاسم الثلاثي"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="dob">تاريخ الميلاد (يحسب العمر تلقائياً)</Label>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center mt-1">
              <Input
                id="dob"
                type="date"
                value={birthDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setBirthDate(e.target.value)}
                className="sm:max-w-[220px]"
              />
              {computedAge ? (
                <div className="text-sm flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 font-bold">
                    العمر الزمني: {computedAge.years} سنة و {computedAge.months} شهر و {computedAge.days} يوم
                  </span>
                  {(computedAge.years < 4 || computedAge.years > 18) && (
                    <span className="text-destructive text-xs">
                      ⚠️ خارج نطاق الاختبار (4–18 سنة)
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  أو اختر السنوات/الأشهر يدوياً أدناه
                </span>
              )}
            </div>
          </div>

          <div>
            <Label>العمر (سنوات) *</Label>
            <Select
              value={String(form.subject_age_years)}
              onValueChange={(v) => update("subject_age_years", Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ageOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y} سنة</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>الأشهر</Label>
            <Select
              value={String(form.subject_age_months)}
              onValueChange={(v) => update("subject_age_months", Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i).map((m) => (
                  <SelectItem key={m} value={String(m)}>{m} شهر</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>النوع</Label>
            <Select value={form.subject_gender} onValueChange={(v) => update("subject_gender", v)}>
              <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ذكر">ذكر</SelectItem>
                <SelectItem value="أنثى">أنثى</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="grade">الصف الدراسي</Label>
            <Input
              id="grade"
              value={form.subject_grade}
              onChange={(e) => update("subject_grade", e.target.value)}
              placeholder="مثال: الثالث الابتدائي"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="school">المدرسة / المؤسسة</Label>
            <Input
              id="school"
              value={form.subject_school}
              onChange={(e) => update("subject_school", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="notes">ملاحظات أولية (اختياري)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              placeholder="أي ملاحظات سلوكية أو طبية تساعد في التفسير..."
            />
          </div>

          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3 pt-2">
            <Button type="submit" size="lg" className="flex-1 bg-hero-gradient text-primary-foreground hover:opacity-95" disabled={submitting}>
              <Play className="ms-2 h-5 w-5" />
              {submitting ? "جارٍ التحضير..." : "بدء الاختبار"}
            </Button>
            <Button asChild type="button" size="lg" variant="outline" className="flex-1">
              <Link to="/sessions">
                <History className="ms-2 h-5 w-5" />
                عرض السجلات السابقة
              </Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function InfoCards() {
  const items = [
    {
      icon: BookOpen,
      title: "36 مصفوفة بصرية",
      desc: "ثلاث مجموعات (أ، أب، ب) — 12 مصفوفة لكل منها بترتيب تصاعدي للصعوبة.",
    },
    {
      icon: GraduationCap,
      title: "تصحيح فوري",
      desc: "حساب الدرجة الخام والرتبة المئينية ونسبة الذكاء التقديرية حسب عمر المفحوص.",
    },
    {
      icon: ShieldCheck,
      title: "عادل ثقافياً",
      desc: "لا يعتمد على اللغة أو القراءة، مناسب للأطفال وصعوبات التعلم وكبار السن.",
    },
  ];
  return (
    <section className="grid sm:grid-cols-3 gap-4">
      {items.map((it) => (
        <Card key={it.title} className="border-border/60 transition-smooth hover:shadow-card hover:-translate-y-0.5">
          <CardContent className="pt-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <it.icon className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground mb-1">{it.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
