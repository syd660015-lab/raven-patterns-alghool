import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, LogIn, UserPlus, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppFooter } from "@/components/app-footer";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "تسجيل الدخول — اختبار مصفوفات رافن CPM" }],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email({ message: "بريد إلكتروني غير صالح" }).max(255),
  password: z.string().min(6, { message: "كلمة المرور 6 أحرف على الأقل" }).max(72),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, { message: "الاسم مطلوب" }).max(100),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 grid lg:grid-cols-2 gap-0">
        {/* Brand panel */}
        <section className="relative hidden lg:flex items-center justify-center bg-hero-gradient text-primary-foreground overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)",
            backgroundSize: "48px 48px, 64px 64px",
          }} />
          <div className="relative z-10 max-w-md text-center px-8">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 backdrop-blur-sm shadow-elegant">
              <Brain className="h-10 w-10" />
            </div>
            <h1 className="text-4xl font-black mb-4 leading-tight">
              مصفوفات رافن المتتابعة الملونة
            </h1>
            <p className="text-lg opacity-90 leading-relaxed mb-6">
              أداة احترافية لقياس الذكاء السيال لدى الأطفال من سن 5 إلى 11 سنة
            </p>
            <div className="flex items-center justify-center gap-2 text-sm opacity-80">
              <ShieldCheck className="h-4 w-4" />
              <span>اختبار عادل ثقافياً · معتمد عيادياً وتربوياً</span>
            </div>
          </div>
        </section>

        {/* Form panel */}
        <section className="flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md shadow-paper border-border/60">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-hero-gradient lg:hidden shadow-elegant">
                <Brain className="h-6 w-6 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl">مرحباً بك</CardTitle>
              <CardDescription>سجّل الدخول للبدء في تطبيق الاختبار</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">دخول</TabsTrigger>
                  <TabsTrigger value="signup">حساب جديد</TabsTrigger>
                </TabsList>
                <TabsContent value="login" className="mt-6">
                  <LoginForm />
                </TabsContent>
                <TabsContent value="signup" className="mt-6">
                  <SignupForm />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error("تعذّر تسجيل الدخول: " + error.message);
      return;
    }
    toast.success("أهلاً بك");
    navigate({ to: "/" });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="li-email">البريد الإلكتروني</Label>
        <Input
          id="li-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@mail.com"
          dir="ltr"
          className="text-start"
        />
      </div>
      <div>
        <Label htmlFor="li-pw">كلمة المرور</Label>
        <Input
          id="li-pw"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        <LogIn className="ms-2 h-4 w-4" />
        {submitting ? "جارٍ الدخول..." : "تسجيل الدخول"}
      </Button>
    </form>
  );
}

function SignupForm() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error("تعذّر إنشاء الحساب: " + error.message);
      return;
    }
    toast.success("تم إنشاء الحساب — يمكنك الدخول الآن");
    navigate({ to: "/" });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="su-name">الاسم الكامل (الأخصائي)</Label>
        <Input
          id="su-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="مثال: أ. محمد أحمد"
        />
      </div>
      <div>
        <Label htmlFor="su-email">البريد الإلكتروني</Label>
        <Input
          id="su-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          dir="ltr"
          className="text-start"
        />
      </div>
      <div>
        <Label htmlFor="su-pw">كلمة المرور</Label>
        <Input
          id="su-pw"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        <UserPlus className="ms-2 h-4 w-4" />
        {submitting ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
      </Button>
    </form>
  );
}
