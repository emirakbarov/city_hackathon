
DROP POLICY "own or friends sessions" ON public.sessions;
CREATE POLICY "own sessions" ON public.sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime DROP TABLE public.sessions;

CREATE TABLE public.session_status (
  session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  app text NOT NULL,
  created_at timestamptz NOT NULL,
  outcome text NOT NULL,
  free_status text
);
CREATE INDEX session_status_user_created ON public.session_status (user_id, created_at DESC);
GRANT SELECT ON public.session_status TO authenticated;
GRANT ALL ON public.session_status TO service_role;
ALTER TABLE public.session_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or friends status" ON public.session_status FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.are_friends(auth.uid(), user_id));

CREATE OR REPLACE FUNCTION public.sync_session_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.session_status (session_id, user_id, app, created_at, outcome, free_status)
  VALUES (NEW.id, NEW.user_id, NEW.app, NEW.created_at, NEW.outcome, NEW.free_status)
  ON CONFLICT (session_id) DO UPDATE SET outcome = EXCLUDED.outcome, free_status = EXCLUDED.free_status;
  RETURN NEW;
END $$;
CREATE TRIGGER sessions_sync_status AFTER INSERT OR UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.sync_session_status();

ALTER TABLE public.session_status REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_status;

ALTER TABLE public.nudges ADD COLUMN session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;

DROP POLICY "avatar public read" ON storage.objects;
DROP POLICY "avatar own upload" ON storage.objects;
DROP POLICY "avatar own update" ON storage.objects;
