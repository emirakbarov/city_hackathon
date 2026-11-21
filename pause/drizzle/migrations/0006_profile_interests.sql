ALTER TABLE public.profiles ADD COLUMN interests text[] NOT NULL DEFAULT '{}';
GRANT SELECT (interests), INSERT (interests), UPDATE (interests) ON public.profiles TO authenticated;