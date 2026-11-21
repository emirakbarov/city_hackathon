import { createFileRoute, Link, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { Home, Users, Wrench, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MeContext } from "@/lib/me";
import { PROFILE_COLS, PW_SET_KEY, sendFriendRequest, type Profile } from "@/lib/pause";
import { ProfileForm } from "@/components/pause/ProfileForm";
import { NudgeCenter } from "@/components/pause/NudgeCenter";
import { DailyCheckIn } from "@/components/pause/DailyCheckIn";

const PENDING_INVITE_KEY = "pause_pending_invite";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.href } });
    return { userId: data.session.user.id };
  },
  component: Layout,
});

function Layout() {
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const loc = useLocation();
  const navigate = useNavigate();
  const { data: me, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["me", userId],
    queryFn: async () => {
      // Throw on errors (expired token, network blip) so we retry instead of
      // mistaking a failed read for "no profile yet".
      const { data, error } = await supabase.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle();
      if (error) throw error;
      if (!data) {
        // An expired sign-in reads as "no rows" rather than an error, which
        // used to show "Make it yours" by mistake. Refresh and re-check.
        const { data: ref } = await supabase.auth.refreshSession();
        if (!ref.session) throw new Error("Session expired");
        const again = await supabase.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle();
        if (again.error) throw again.error;
        return (again.data as Profile | null) ?? null;
      }
      return (data as Profile | null) ?? null;
    },
    retry: 2,
    retryDelay: (n) => Math.min(500 * 2 ** n, 4000),
  });

  // Everyone needs a password on their account: magic-link and Google users
  // are sent to set one before they can use the app.
  useEffect(() => {
    if (!me) return;
    const hasPw = me.has_password || localStorage.getItem(PW_SET_KEY) === "1";
    if (!hasPw && loc.pathname !== "/set-password") {
      navigate({ to: "/set-password", search: { next: loc.href }, replace: true });
    }
  }, [me, loc.pathname, loc.href, navigate]);

  useEffect(() => {
    if (!me) return;
    const pending = localStorage.getItem(PENDING_INVITE_KEY);
    if (!pending) return;
    localStorage.removeItem(PENDING_INVITE_KEY);
    if (pending === me.username) return;
    sendFriendRequest(me.id, pending).then((msg) => {
      toast(msg);
      qc.invalidateQueries({ queryKey: ["friends"] });
    });
  }, [me, qc]);

  if (isLoading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-6">
        <p className="text-muted-foreground">Loading Pause…</p>
      </main>
    );
  }
  if (isError && !me) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-bold">Couldn't load your account</h1>
        <p className="text-muted-foreground">Check your connection and try again, or sign in again.</p>
        <button
          className="h-12 rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-60"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          {isFetching ? "Trying…" : "Try again"}
        </button>
        <button
          className="h-12 rounded-full border border-border font-semibold"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth", search: { next: loc.href } });
          }}
        >
          Sign in again
        </button>
      </main>
    );
  }
  if (!me) {
    return (
      <main className="mx-auto max-w-md px-6 py-10">
        <h1 className="text-3xl font-bold">Make it yours</h1>
        <p className="mb-8 mt-2 text-muted-foreground">Friends find you by username.</p>
        <ProfileForm userId={userId} cta="Let's go" onSaved={() => qc.invalidateQueries({ queryKey: ["me"] })} />
      </main>
    );
  }

  const hideNav = loc.pathname.startsWith("/intercept") || loc.pathname === "/times-up" || loc.pathname === "/set-password";
  return (
    <MeContext.Provider value={me}>
      <div className="mx-auto min-h-[100dvh] max-w-md pb-28">
        <NudgeCenter />
        {loc.pathname !== "/times-up" && loc.pathname !== "/set-password" && me.has_password && <DailyCheckIn showSummary={loc.pathname === "/"} />}
        <Outlet />
      </div>
      {!hideNav && <BottomNav />}
    </MeContext.Provider>
  );
}

function BottomNav() {
  const items = [
    { to: "/", label: "Home", Icon: Home },
    { to: "/friends", label: "Friends", Icon: Users },
    { to: "/setup", label: "Setup", Icon: Wrench },
    { to: "/profile", label: "Me", Icon: User },
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md justify-around">
        {items.map(({ to, label, Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: true }}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-xs text-muted-foreground"
            activeProps={{ className: "text-primary font-semibold" }}>
            <Icon className="h-6 w-6" />{label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
