CREATE TABLE public.daily_intentions (
 user_id uuid NOT NULL,
 day date NOT NULL,
 objective text NOT NULL,
 energy text NOT NULL DEFAULT 'steady' CHECK (energy IN ('low','steady','high')),
 available_minutes integer NOT NULL DEFAULT 15 CHECK (available_minutes IN (5,15,30)),
 PRIMARY KEY (user_id, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_intentions TO authenticated;
GRANT ALL ON public.daily_intentions TO service_role;
ALTER TABLE public.daily_intentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own daily intentions" ON public.daily_intentions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());