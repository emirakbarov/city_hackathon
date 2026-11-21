GRANT DELETE ON public.sessions TO authenticated;
CREATE POLICY "delete own session" ON public.sessions FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER TABLE public.session_status ADD COLUMN vibe text;
CREATE OR REPLACE FUNCTION public.sync_session_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text := CASE WHEN NEW.reason IN ('socialise','productive','relax') THEN NEW.reason END;
BEGIN
  INSERT INTO public.session_status (session_id, user_id, app, created_at, outcome, free_status, vibe)
  VALUES (NEW.id, NEW.user_id, NEW.app, NEW.created_at, NEW.outcome, NEW.free_status, v)
  ON CONFLICT (session_id) DO UPDATE SET outcome = EXCLUDED.outcome, free_status = EXCLUDED.free_status, vibe = EXCLUDED.vibe;
  RETURN NEW;
END $$;