import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function safeNext(v: unknown) {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" ? { next: s["next"] as string } : {},
  head: () => ({
    meta: [
      { title: "Sign in — Pause" },
      { name: "description", content: "Sign in to Pause with a magic link sent to your email." },
      { property: "og:title", content: "Sign in — Pause" },
      { property: "og:description", content: "Sign in to Pause with a magic link sent to your email." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();
  const target = safeNext(next);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ href: target, replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ href: target, replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { toast.error("Enter your email"); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + target },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-10">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl text-primary-foreground">❚❚</div>
        <h1 className="text-4xl font-bold">Pause.</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Before you scroll, see which friends are free to do something real.
        </p>
      </div>
      {sent ? (
        <div className="rounded-3xl bg-card p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">Check your email ✉️</h2>
          <p className="mt-2 text-muted-foreground">
            We sent a sign-in link to <b>{email}</b>. Open it on this phone and you'll stay signed in.
          </p>
          <Button variant="ghost" className="mt-4" onClick={() => setSent(false)}>Use a different email</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Input
            type="email" inputMode="email" autoComplete="email" placeholder="you@email.com"
            value={email} onChange={(e) => setEmail(e.target.value)} className="h-14 rounded-2xl text-lg"
          />
          <Button type="submit" disabled={busy} className="h-14 w-full rounded-2xl text-lg">
            {busy ? "Sending…" : "Email me a magic link"}
          </Button>
        </form>
      )}
    </main>
  );
}
