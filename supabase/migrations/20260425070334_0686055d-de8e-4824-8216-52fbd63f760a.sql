ALTER TABLE public.test_sessions
  ADD COLUMN IF NOT EXISTS norm_table_id UUID REFERENCES public.norm_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS norm_table_name TEXT;