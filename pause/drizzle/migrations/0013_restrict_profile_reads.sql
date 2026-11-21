DROP POLICY IF EXISTS "profiles readable by signed-in users" ON public.profiles;
CREATE POLICY "profiles readable by self and connections" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR EXISTS (SELECT 1 FROM public.friendships f WHERE (f.requester_id = auth.uid() AND f.addressee_id = profiles.id) OR (f.addressee_id = auth.uid() AND f.requester_id = profiles.id)));

CREATE OR REPLACE FUNCTION public.search_profiles(_q text)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND length(coalesce(_q,'')) >= 1
    AND p.username ILIKE replace(replace(lower(_q),'%','\%'),'_','\_') || '%'
    AND p.id <> auth.uid()
  ORDER BY p.username LIMIT 8
$$;
REVOKE ALL ON FUNCTION public.search_profiles(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.find_profile_id(_username text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE auth.uid() IS NOT NULL AND username = lower(_username) LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.find_profile_id(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_profile_id(text) TO authenticated;