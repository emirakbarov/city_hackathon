CREATE OR REPLACE FUNCTION public.friend_leaderboard()
RETURNS TABLE(user_id uuid, redirected bigint, opens bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
    count(s.id) FILTER (WHERE s.outcome = 'redirected'),
    count(s.id)
  FROM public.profiles p
  LEFT JOIN public.sessions s ON s.user_id = p.id AND s.created_at > now() - interval '7 days'
  WHERE auth.uid() IS NOT NULL AND (p.id = auth.uid() OR public.are_friends(auth.uid(), p.id))
  GROUP BY p.id;
$$;
REVOKE EXECUTE ON FUNCTION public.friend_leaderboard() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.friend_leaderboard() TO authenticated;