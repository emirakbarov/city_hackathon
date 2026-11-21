import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PROFILE_COLS, type Profile } from "@/lib/pause";
import { PAvatar } from "@/components/pause/Avatar";

export const LEADERBOARD_SIZE = 5;

export function Leaderboard({ meId, onInvite }: { meId: string; onInvite?: () => void }) {
  const { data } = useQuery({
    queryKey: ["leaderboard", meId],
    queryFn: async () => {
      const { data: rows } = await supabase.rpc("friend_leaderboard");
      const list = rows ?? [];
      const ids = list.map((r) => r.user_id);
      const { data: ps } = ids.length ? await supabase.from("profiles").select(PROFILE_COLS).in("id", ids) : { data: [] };
      const map = new Map((ps ?? []).map((p) => [p.id, p as Profile]));
      return list
        .map((r) => ({ ...r, redirected: Number(r.redirected), opens: Number(r.opens), p: map.get(r.user_id) }))
        .filter((r) => r.p)
        .sort((a, b) => b.redirected - a.redirected || a.opens - b.opens);
    },
  });
  if (!data || data.length < 2) return null;
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Leaderboard</h2>
      <p className="mb-3 text-sm text-muted-foreground">Who chose something else over Instagram this week</p>
      <ol className="space-y-2">
        {data.slice(0, LEADERBOARD_SIZE).map((r, i) => (
          <li key={r.user_id} className={`flex items-center gap-3 rounded-2xl p-3 ${r.user_id === meId ? "bg-accent" : "bg-card"}`}>
            <span className="w-6 text-center font-bold text-muted-foreground">{i === 0 && r.redirected > 0 ? "🏆" : i + 1}</span>
            <PAvatar name={r.p!.display_name} src={r.p!.avatar_url} size={36} />
            <span className="flex-1 truncate font-medium">{r.user_id === meId ? "You" : r.p!.display_name}</span>
            <span className="text-right text-sm"><b className="text-primary">{r.redirected}</b> <span className="text-muted-foreground">/ {r.opens} opens</span></span>
          </li>
        ))}
      </ol>
      {onInvite && (
        <button type="button" onClick={onInvite}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-3 py-3.5 text-sm font-semibold text-primary transition hover:bg-primary/10 active:scale-[0.99]">
          <UserPlus className="h-4 w-4" /> Invite friends
        </button>
      )}
    </section>
  );
}
