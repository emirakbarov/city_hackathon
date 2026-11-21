import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { PROFILE_COLS, inviteUrl, normalizeUsername, sendFriendRequest, type Profile } from "@/lib/pause";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAvatar } from "@/components/pause/Avatar";
import { QRCodeSVG } from "qrcode.react";
import { Leaderboard } from "@/components/pause/Leaderboard";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({
    meta: [
      { title: "Friends — Pause" },
      { name: "description", content: "Add friends by username, accept requests and share your invite link." },
      { property: "og:title", content: "Friends — Pause" },
      { property: "og:description", content: "Add friends by username, accept requests and share your invite link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Friends,
});

type F = { id: string; requester_id: string; addressee_id: string; status: string };

function Friends() {
  const me = useMe();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["friends", me.id],
    queryFn: async () => {
      const { data: fs } = await supabase.from("friendships").select("id, requester_id, addressee_id, status").neq("status", "declined");
      const rows = (fs ?? []) as F[];
      const ids = rows.map((f) => (f.requester_id === me.id ? f.addressee_id : f.requester_id));
      const { data: ps } = ids.length ? await supabase.from("profiles").select(PROFILE_COLS).in("id", ids) : { data: [] };
      const map = new Map((ps ?? []).map((p) => [p.id, p as Profile]));
      return rows.map((f) => ({ ...f, other: map.get(f.requester_id === me.id ? f.addressee_id : f.requester_id) }));
    },
  });
  const { data: results } = useQuery({
    queryKey: ["search", normalizeUsername(q)],
    enabled: normalizeUsername(q).length >= 2,
    queryFn: async () => {
      const { data } = await supabase.rpc("search_profiles", { _q: normalizeUsername(q) });
      return ((data ?? []) as Partial<Profile>[]).map((p) => ({ interests: [], has_password: true, ...p }) as Profile);
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`friendships-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => qc.invalidateQueries({ queryKey: ["friends"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["friends"] });
  const friends = (data ?? []).filter((f) => f.status === "accepted");
  const incoming = (data ?? []).filter((f) => f.status === "pending" && f.addressee_id === me.id);
  const outgoing = (data ?? []).filter((f) => f.status === "pending" && f.requester_id === me.id);
  const relation = new Map((data ?? []).map((f) => [f.other?.id, f]));

  async function add(username: string) { toast(await sendFriendRequest(me.id, username)); refresh(); }
  async function respond(id: string, status: "accepted" | "declined") {
    await supabase.from("friendships").update({ status }).eq("id", id); refresh();
  }
  async function remove(id: string) { await supabase.from("friendships").delete().eq("id", id); refresh(); }

  return (
    <main className="space-y-6 px-5 pt-6">
      <h1 className="text-3xl font-bold">Friends</h1>

      <Leaderboard meId={me.id} onInvite={() =>
        document.getElementById("invite-friends")?.scrollIntoView({ behavior: "smooth", block: "center" })
      } />

      <section>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username" autoCapitalize="none" className="h-14 rounded-2xl text-lg" />
        {results && q && (
          <ul className="mt-2 space-y-2">
            {results.length === 0 && <li className="px-2 text-sm text-muted-foreground">No matches</li>}
            {results.map((p) => {
              const r = relation.get(p.id);
              return (
                <Row key={p.id} p={p}>
                  {r?.status === "accepted" ? <span className="text-sm text-muted-foreground">Friends</span>
                    : r ? <span className="text-sm text-muted-foreground">Pending</span>
                    : <Button className="rounded-xl" onClick={() => add(p.username)}>Add</Button>}
                </Row>
              );
            })}
          </ul>
        )}
      </section>

      {incoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Requests</h2>
          <ul className="space-y-2">
            {incoming.map((f) => f.other && (
              <Row key={f.id} p={f.other}>
                <Button variant="ghost" className="rounded-xl" onClick={() => respond(f.id, "declined")}>Decline</Button>
                <Button className="rounded-xl" onClick={() => respond(f.id, "accepted")}>Accept</Button>
              </Row>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Your friends <span className="text-muted-foreground">({friends.length})</span></h2>
        {friends.length === 0 ? <p className="text-muted-foreground">No friends yet — share your invite link below.</p> : (
          <ul className="space-y-2">
            {friends.map((f) => f.other && (
              <Row key={f.id} p={f.other}>
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => remove(f.id)}>Remove</Button>
              </Row>
            ))}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Sent</h2>
          <ul className="space-y-2">
            {outgoing.map((f) => f.other && (
              <Row key={f.id} p={f.other}>
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => remove(f.id)}>Cancel</Button>
              </Row>
            ))}
          </ul>
        </section>
      )}

      <InviteCard username={me.username} />
    </main>
  );
}

function Row({ p, children }: { p: Profile; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
      <PAvatar name={p.display_name} src={p.avatar_url} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{p.display_name}</p>
        <p className="truncate text-sm text-muted-foreground">@{p.username}</p>
      </div>
      <div className="flex gap-1">{children}</div>
    </li>
  );
}

function InviteCard({ username }: { username: string }) {
  const [big, setBig] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(inviteUrl(username)), [username]);
  return (
    <>
      <section id="invite-friends" className="scroll-mt-24 rounded-3xl bg-primary p-5 text-primary-foreground">
        <div className="flex items-center gap-4">
          <button aria-label="Show QR code bigger" onClick={() => setBig(true)}
            className="shrink-0 rounded-xl bg-card p-1.5 text-foreground transition active:scale-95">
            <QRCodeSVG value={url} size={56} fgColor="currentColor" bgColor="transparent" />
          </button>
          <div className="min-w-0">
            <p className="font-semibold">Invite a new friend</p>
        <p className="mt-1 truncate text-sm opacity-90">{url}</p>
            <p className="text-xs opacity-80">Tap the code to make it bigger</p>
          </div>
        </div>
        <Button variant="secondary" className="mt-3 h-12 w-full rounded-2xl" onClick={async () => {
          const url = inviteUrl(username);
          if (navigator.share) { try { await navigator.share({ title: "Join me on Pause", url }); return; } catch { /* fall through */ } }
          await navigator.clipboard.writeText(url); toast.success("Invite link copied");
        }}>Share invite link</Button>
      </section>

      {big && (
        <div role="dialog" aria-label="Invite QR code" onClick={() => setBig(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/95 p-6 animate-in fade-in">
          <div className="rounded-3xl bg-card p-5 text-foreground shadow-lg">
            <QRCodeSVG value={url} size={260} fgColor="currentColor" bgColor="transparent" />
          </div>
          <p className="text-center font-semibold">Scan to add @{username} on Pause</p>
          <p className="text-sm text-muted-foreground">Tap anywhere to close</p>
        </div>
      )}
    </>
  );
}
