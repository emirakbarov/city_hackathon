import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { ProfileForm } from "@/components/pause/ProfileForm";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Pause" },
      { name: "description", content: "Edit your Pause name, photo and contact number." },
      { property: "og:title", content: "Your profile — Pause" },
      { property: "og:description", content: "Edit your Pause name, photo and contact number." },
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
      <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={signOut}>Sign out</Button>
    </main>
  );
}
