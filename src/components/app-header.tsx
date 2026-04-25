import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Brain, LogOut, History, ClipboardList, Settings2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function AppHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const isAuthed = !!user;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-hero-gradient shadow-elegant transition-smooth group-hover:scale-105">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-foreground">مصفوفات رافن الملونة</span>
            <span className="text-[11px] text-muted-foreground">CPM · قياس الذكاء السيال</span>
          </div>
        </Link>

        {isAuthed && (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Button
              asChild
              variant={location.pathname === "/" ? "secondary" : "ghost"}
              size="sm"
            >
              <Link to="/">
                <ClipboardList className="ms-2 h-4 w-4" />
                <span className="hidden sm:inline">الرئيسية</span>
              </Link>
            </Button>
            <Button
              asChild
              variant={location.pathname.startsWith("/sessions") ? "secondary" : "ghost"}
              size="sm"
            >
              <Link to="/sessions">
                <History className="ms-2 h-4 w-4" />
                <span className="hidden sm:inline">السجلات</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="ms-2 h-4 w-4" />
              <span className="hidden sm:inline">خروج</span>
            </Button>
          </nav>
        )}

        {!isAuthed && (
          <Button asChild variant="default" size="sm">
            <Link to="/auth">
              <UserIcon className="ms-2 h-4 w-4" />
              تسجيل الدخول
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
