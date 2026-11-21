import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeNext } from "@/lib/authDestination";
import { PW_SET_KEY } from "@/lib/pause";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const parent = getRouteApi("/_authenticated");

export const Route = createFileRoute("/_authenticated/set-password")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" ? { next: safeNext(s["next"]) } : {},
  head: () => ({
    meta: [
      { title: "Set your password — Pause" },
      { name: "description", content: "Set a password for your Pause account so you can sign in without a magic link." },
      { property: "og:title", content: "Set your password — Pause" },
      { property: "og:description", content: "Set a password for your Pause account so you can sign in without a magic link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetPassword,
});

function SetPassword() {
  const { next } = Route.useSearch();
  const { userId } = parent.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("The passwords don’t match."); return; }
    setBusy(true); setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.from("profiles").update({ has_password: true }).eq("id", userId);
      localStorage.setItem(PW_SET_KEY, "1");
      await qc.invalidateQueries({ queryKey: ["me"] });
      await navigate({ href: safeNext(next), replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t save your password. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-3xl font-bold">One last step: set a password</h1>
      <p className="mb-8 mt-3 text-muted-foreground">
        Magic links will keep working, but a password lets you back in quickly — even without your email inbox.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-2 text-sm font-medium">Password
          <Input type="password" autoComplete="new-password" minLength={8} required placeholder="At least 8 characters"
            value={password} onChange={(e) => setPassword(e.target.value)} className="h-14 rounded-2xl text-base" />
        </label>
        <label className="block space-y-2 text-sm font-medium">Confirm password
          <Input type="password" autoComplete="new-password" minLength={8} required
            value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-14 rounded-2xl text-base" />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="h-14 w-full rounded-2xl text-lg">{busy ? "Saving…" : "Save password"}</Button>
      </form>
    </main>
  );
}
