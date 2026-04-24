-- Profiles table for the specialist (logged-in user)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Test sessions - one row per administered test
CREATE TABLE public.test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  subject_age_years INTEGER NOT NULL,
  subject_age_months INTEGER NOT NULL DEFAULT 0,
  subject_gender TEXT,
  subject_grade TEXT,
  subject_school TEXT,
  notes TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_score INTEGER NOT NULL DEFAULT 0,
  percentile INTEGER,
  iq_estimate INTEGER,
  classification TEXT,
  duration_seconds INTEGER,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own sessions"
  ON public.test_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own sessions"
  ON public.test_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own sessions"
  ON public.test_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can delete own sessions"
  ON public.test_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_test_sessions_user_created ON public.test_sessions(user_id, created_at DESC);