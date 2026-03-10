CREATE TABLE public.swift_cache (
  swift_code TEXT PRIMARY KEY,
  bank_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Allow edge functions to read/write (no RLS needed - this is reference data)
ALTER TABLE public.swift_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Anyone can read swift_cache" ON public.swift_cache FOR SELECT TO authenticated USING (true);

-- Allow service role (edge functions) to insert/update via anon key
CREATE POLICY "Anyone can insert swift_cache" ON public.swift_cache FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can update swift_cache" ON public.swift_cache FOR UPDATE TO anon USING (true);