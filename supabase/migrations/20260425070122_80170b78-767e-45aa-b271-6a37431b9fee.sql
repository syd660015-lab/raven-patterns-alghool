-- جدول لإصدارات/نسخ جداول المعايير الخاصة بمصفوفات رافن CPM
CREATE TABLE public.norm_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.norm_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own norm tables"
ON public.norm_tables FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users can insert own norm tables"
ON public.norm_tables FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own norm tables"
ON public.norm_tables FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users can delete own norm tables"
ON public.norm_tables FOR DELETE TO authenticated
USING (auth.uid() = user_id AND is_default = false);

-- صفوف المعايير: قيمة الدرجة الخام لكل مئين عند كل عمر
CREATE TABLE public.norm_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.norm_tables(id) ON DELETE CASCADE,
  age_min INTEGER NOT NULL,
  age_max INTEGER NOT NULL,
  p5 INTEGER NOT NULL,
  p10 INTEGER NOT NULL,
  p25 INTEGER NOT NULL,
  p50 INTEGER NOT NULL,
  p75 INTEGER NOT NULL,
  p90 INTEGER NOT NULL,
  p95 INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_norm_rows_table ON public.norm_rows(table_id);

ALTER TABLE public.norm_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view rows of own tables"
ON public.norm_rows FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.norm_tables t WHERE t.id = norm_rows.table_id AND t.user_id = auth.uid()));

CREATE POLICY "users can insert rows into own tables"
ON public.norm_rows FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.norm_tables t WHERE t.id = norm_rows.table_id AND t.user_id = auth.uid()));

CREATE POLICY "users can update rows of own tables"
ON public.norm_rows FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.norm_tables t WHERE t.id = norm_rows.table_id AND t.user_id = auth.uid()));

CREATE POLICY "users can delete rows of own tables"
ON public.norm_rows FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.norm_tables t WHERE t.id = norm_rows.table_id AND t.user_id = auth.uid()));

-- timestamps trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_norm_tables_updated
BEFORE UPDATE ON public.norm_tables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ضمان وجود نسخة نشطة واحدة فقط لكل مستخدم
CREATE OR REPLACE FUNCTION public.ensure_single_active_norm_table()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.norm_tables
    SET is_active = false
    WHERE user_id = NEW.user_id AND id <> NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_single_active_norm_table
AFTER INSERT OR UPDATE OF is_active ON public.norm_tables
FOR EACH ROW WHEN (NEW.is_active = true)
EXECUTE FUNCTION public.ensure_single_active_norm_table();

-- عند إنشاء مستخدم جديد، أنشئ له نسخة "افتراضية" نشطة من المعايير القياسية
CREATE OR REPLACE FUNCTION public.seed_default_norm_table_for_user(_user_id UUID)
RETURNS UUID AS $$
DECLARE
  new_table_id UUID;
BEGIN
  INSERT INTO public.norm_tables (user_id, name, description, is_active, is_default)
  VALUES (_user_id, 'النسخة القياسية (Raven CPM)', 'الجداول المعيارية الافتراضية للأعمار 5-11 سنة', true, true)
  RETURNING id INTO new_table_id;

  INSERT INTO public.norm_rows (table_id, age_min, age_max, p5, p10, p25, p50, p75, p90, p95) VALUES
    (new_table_id, 5, 5,  6,  7,  9,  11, 14, 16, 17),
    (new_table_id, 6, 6,  8,  9,  11, 14, 17, 20, 22),
    (new_table_id, 7, 7,  10, 11, 14, 17, 21, 25, 27),
    (new_table_id, 8, 8,  12, 13, 16, 20, 24, 28, 30),
    (new_table_id, 9, 9,  13, 15, 18, 22, 26, 30, 32),
    (new_table_id, 10, 10, 14, 16, 20, 24, 28, 31, 33),
    (new_table_id, 11, 11, 15, 17, 21, 25, 29, 32, 34);

  RETURN new_table_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- حدّث الـ trigger ليصنع كذلك جدول معايير افتراضي عند تسجيل المستخدم
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  PERFORM public.seed_default_norm_table_for_user(NEW.id);

  RETURN NEW;
END;
$$;

-- اربط الـ trigger بـ auth.users (إن لم يكن موجوداً سابقاً)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- زرع الجداول الافتراضية للمستخدمين الموجودين الذين ليس لديهم نسخة بعد
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN
    SELECT p.id FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.norm_tables nt WHERE nt.user_id = p.id)
  LOOP
    PERFORM public.seed_default_norm_table_for_user(u.id);
  END LOOP;
END $$;