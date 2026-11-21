import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PW_SET_KEY } from "@/lib/pause";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Reset password — Pause" },
    { name: "description", content: "Set a new password for your Pause account using your email recovery link." },
    { property: "og:title", content: "Reset password — Pause" },
    { property: "og:description", content: "Securely set a new password for your Pause account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPassword,
});

function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const type = hash.get("type");
    // Auth may already have consumed and cleared the recovery hash; getUser
    // waits for its initialization. The Auth server enforces recovery status.
    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      setReady(Boolean(data.user) && !authError && (!type || type === "recovery"));
      setChecking(false);
    }).catch(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError("The passwords don’t match."); return; }
    setBusy(true); setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      const { data } = await supabase.auth.getUser();
      if (data.user) await supabase.from("profiles").update({ has_password: true }).eq("id", data.user.id);
      localStorage.setItem(PW_SET_KEY, "1");
      setSaved(true); setPassword(""); setConfirm("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Couldn’t save your password. Request a fresh link."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-10">
    <h1 className="text-3xl font-bold">{saved ? "Password saved." : "Set your password"}</h1>
    {checking ? <p className="mt-4 text-muted-foreground">Checking your link…</p> : saved ? <>
      <p role="status" className="mt-4 text-muted-foreground">Your account now has a password.</p>
      <Button asChild className="mt-6 h-14 rounded-2xl"><Link to="/">Back to Pause</Link></Button>
    </> : !ready ? <>
      <p className="mt-4 text-muted-foreground">This link has expired or isn’t valid. Request a new password link from the sign-in page.</p>
      <Button asChild className="mt-6 h-14 rounded-2xl"><Link to="/auth">Back to sign in</Link></Button>
    </> : <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block space-y-2 text-sm font-medium">New password<Input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="h-14 rounded-2xl" /></label>
      <label className="block space-y-2 text-sm font-medium">Confirm new password<Input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-14 rounded-2xl" /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button disabled={busy} type="submit" className="h-14 w-full rounded-2xl">{busy ? "Saving…" : "Save password"}</Button>
    </form>}
  </main>;
}
