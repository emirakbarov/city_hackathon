ALTER TABLE public.commitments
  ADD COLUMN end_date date,
  ADD COLUMN all_day boolean NOT NULL DEFAULT true,
  ADD COLUMN starts_at text,
  ADD COLUMN ends_at text;
COMMENT ON COLUMN public.commitments.end_date IS 'Inclusive last day (all-day: Google end.date minus one day).';
COMMENT ON COLUMN public.commitments.starts_at IS 'Timed events: original RFC3339 start with offset.';
COMMENT ON COLUMN public.commitments.ends_at IS 'Timed events: original RFC3339 end with offset.';
CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;