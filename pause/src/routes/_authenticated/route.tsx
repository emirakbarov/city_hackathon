import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { Home, Users, Wrench, User, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MeContext } from "@/lib/me";
import { PROFILE_COLS, sendFriendRequest, type Profile } from "@/lib/pause";
import { ProfileForm } from "@/components/pause/ProfileForm";
import { NudgeCenter } from "@/components/pause/NudgeCenter";

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
  const { data: me, isLoading } = useQuery({
    queryKey: ["me", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle();
      return (data as Profile | null) ?? null;
    },
  });

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

  if (isLoading) return <div className="min-h-[100dvh]" />;
  if (!me) {
    return (
      <main className="mx-auto max-w-md px-6 py-10">
        <h1 className="text-3xl font-bold">Make it yours</h1>
        <p className="mb-8 mt-2 text-muted-foreground">Friends find you by username.</p>
        <ProfileForm userId={userId} cta="Let's go" onSaved={() => qc.invalidateQueries({ queryKey: ["me"] })} />
      </main>
    );
  }

  const hideNav = loc.pathname.startsWith("/intercept");
  return (
    <MeContext.Provider value={me}>
      <div className="mx-auto min-h-[100dvh] max-w-md pb-28">
        <NudgeCenter />
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
    { to: "/plan", label: "Plan", Icon: Target },
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
