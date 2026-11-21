CREATE TABLE public.commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('exam','deadline','other')),
  due_date date NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','google_calendar')),
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, external_id)
);
CREATE INDEX commitments_user_due ON public.commitments (user_id, due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commitments TO authenticated;
GRANT ALL ON public.commitments TO service_role;
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own commitments read" ON public.commitments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own commitments insert" ON public.commitments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own commitments update" ON public.commitments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own commitments delete" ON public.commitments FOR DELETE TO authenticated USING (user_id = auth.uid());
COMMENT ON TABLE public.commitments IS 'Upcoming exams/deadlines/other per user; intended to feed scroll model examPeriod/daysUntilExam/minutesToNextCommitment.';