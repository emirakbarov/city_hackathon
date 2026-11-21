import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { safeNext } from "@/lib/authDestination";
import { PW_SET_KEY } from "@/lib/pause";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" ? { next: safeNext(s["next"]) } : {},
  head: () => ({
    meta: [
      { title: "Sign in — Pause" },
      { name: "description", content: "Sign in to Pause with an email magic link, password, or Google account." },
      { property: "og:title", content: "Sign in — Pause" },
      { property: "og:description", content: "Your friends and check-ins, with magic-link, password or Google sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function GoogleLogo() {
  return <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[18px] w-[18px]">
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
    <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
  </svg>;
}

function AuthPage() {
  const { next } = Route.useSearch();
  const target = safeNext(next);
  const navigate = useNavigate();
  const [method, setMethod] = useState("magic");
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 0,
  });

  useEffect(() => {
    if (user) navigate({ href: target, replace: true });
  }, [user, navigate, target]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const address = email.trim();
      const callback = `${window.location.origin}/auth?next=${encodeURIComponent(target)}`;
      if (method === "magic") {
        const { error } = await supabase.auth.signInWithOtp({ email: address, options: { emailRedirectTo: callback } });
        if (error) throw error;
        setSent("Open the magic link in your email to sign in.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("If you have an account, you’ll receive a link to set or reset your password.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: address, password, options: { emailRedirectTo: callback } });
        if (error) throw error;
        localStorage.setItem(PW_SET_KEY, "1");
        if (data.session) await navigate({ href: target, replace: true });
        else setSent("Confirm your email using the link we sent before signing in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) throw error;
        localStorage.setItem(PW_SET_KEY, "1");
        await navigate({ href: target, replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t sign in. Try again.");
    } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth?next=${encodeURIComponent(target)}` });
      if (result.error) throw result.error;
      if (result.redirected) return;
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (data.user) await navigate({ href: target, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in didn’t finish. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl text-primary-foreground">❚❚</div>
        <h1 className="text-4xl font-bold">Pause.</h1>
        <p className="mt-3 text-lg text-muted-foreground">Before you scroll, see which friends are free to do something real.</p>
      </div>
      {sent ? (
        <section role="status" className="space-y-3">
          <h2 className="text-2xl font-semibold">Check your email ✉️</h2>
          <p className="text-muted-foreground">{sent}</p>
          <p className="break-all font-medium">{email.trim()}</p>
          <Button variant="ghost" className="min-h-11" onClick={() => { setSent(""); setMode("signin"); }}>Back to sign in</Button>
        </section>
      ) : <>
        <Tabs value={method} onValueChange={(value) => { setMethod(value); setMode("signin"); setPassword(""); }}>
          <TabsList className="mb-5 grid h-12 w-full grid-cols-2">
            <TabsTrigger value="magic" className="h-10" disabled={busy}>Magic link</TabsTrigger>
            <TabsTrigger value="password" className="h-10" disabled={busy}>Password</TabsTrigger>
          </TabsList>
        </Tabs>
        {method === "password" && mode !== "signin" && <h2 className="mb-4 text-xl font-semibold">{mode === "signup" ? "Create your account" : "Set or reset your password"}</h2>}
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-2 text-sm font-medium">Email
            <Input required type="email" inputMode="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-14 rounded-2xl text-base" />
          </label>
          {method === "password" && mode !== "forgot" && <label className="block space-y-2 text-sm font-medium">Password
            <Input required type="password" minLength={mode === "signup" ? 8 : 1} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-14 rounded-2xl text-base" />
          </label>}
          <Button type="submit" disabled={busy} className="h-14 w-full rounded-2xl text-lg">{busy ? "Please wait…" : method === "magic" ? "Email me a magic link" : mode === "signup" ? "Create account" : mode === "forgot" ? "Email password link" : "Sign in"}</Button>
          {method === "password" && <div className="flex flex-wrap justify-between gap-1">
            <Button variant="link" type="button" disabled={busy} className="min-h-11 px-0" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setPassword(""); }}>{mode === "signup" ? "Already have an account?" : "Create an account"}</Button>
            <Button variant="link" type="button" disabled={busy} className="min-h-11 px-0" onClick={() => { setMode(mode === "forgot" ? "signin" : "forgot"); setPassword(""); }}>{mode === "forgot" ? "Back to sign in" : "Set or reset password"}</Button>
          </div>}
        </form>
        <div className="my-5 flex items-center gap-3 text-sm text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
        <Button variant="outline" disabled={busy} onClick={google} className="google-sign-in h-14 w-full gap-[10px] rounded-2xl px-3 text-sm font-medium [&_svg]:size-[18px]"><GoogleLogo />Continue with Google</Button>
      </>}
    </main>
  );
}
