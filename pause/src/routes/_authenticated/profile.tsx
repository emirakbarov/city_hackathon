import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { PW_SET_KEY } from "@/lib/pause";
import { ProfileForm } from "@/components/pause/ProfileForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Pause" },
      { name: "description", content: "Edit your Pause name, photo and contact number." },
      { property: "og:title", content: "Your profile — Pause" },
      { property: "og:description", content: "Edit your Pause name, photo and contact number." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: phone, isLoading } = useQuery({
    queryKey: ["my-phone", me.id],
    queryFn: async () => ((await supabase.rpc("get_phone", { _uid: me.id })).data as string | null) ?? null,
  });
  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <main className="space-y-8 px-5 pt-6">
      <h1 className="text-3xl font-bold">You</h1>
      {!isLoading && (
        <ProfileForm userId={me.id} initial={me} initialPhone={phone} cta="Save"
          onSaved={() => { qc.invalidateQueries({ queryKey: ["me"] }); qc.invalidateQueries({ queryKey: ["my-phone"] }); }} />
      )}
      <ChangePassword userId={me.id} />
      <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={signOut}>Sign out</Button>
    </main>
  );
}

function ChangePassword({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("The new passwords don’t match."); return; }
    setBusy(true);
    try {
      // Verify the current password by re-signing in before allowing the change.
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("Couldn't verify your account. Sign out and back in.");
      const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: current });
      if (checkError) throw new Error("Your current password is wrong.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.from("profiles").update({ has_password: true }).eq("id", userId);
      localStorage.setItem(PW_SET_KEY, "1");
      qc.invalidateQueries({ queryKey: ["me"] });
      setCurrent(""); setPassword(""); setConfirm("");
      toast.success("Password updated");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Couldn’t update your password.");
    } finally { setBusy(false); }
  }

  return (
    <section className="space-y-4 rounded-3xl border bg-card p-5">
      <h2 className="text-xl font-semibold">Change password</h2>
      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-2 text-sm font-medium">Current password
          <Input type="password" autoComplete="current-password" required value={current}
            onChange={(e) => setCurrent(e.target.value)} className="h-12 rounded-xl" />
        </label>
        <label className="block space-y-2 text-sm font-medium">New password
          <Input type="password" autoComplete="new-password" minLength={8} required placeholder="At least 8 characters"
            value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" />
        </label>
        <label className="block space-y-2 text-sm font-medium">Confirm new password
          <Input type="password" autoComplete="new-password" minLength={8} required value={confirm}
            onChange={(e) => setConfirm(e.target.value)} className="h-12 rounded-xl" />
        </label>
        <Button type="submit" variant="secondary" disabled={busy} className="h-12 w-full rounded-xl">
          {busy ? "Saving…" : "Update password"}
        </Button>
      </form>
    </section>
  );
}
