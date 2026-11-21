
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username, display_name, avatar_url, created_at) ON public.profiles TO authenticated;
CREATE OR REPLACE FUNCTION public.get_phone(_uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT phone FROM public.profiles WHERE id = _uid AND (_uid = auth.uid() OR public.are_friends(auth.uid(), _uid));
$$;
REVOKE EXECUTE ON FUNCTION public.get_phone(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_phone(uuid) TO authenticated;
