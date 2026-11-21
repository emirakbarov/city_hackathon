import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAvatar } from "./Avatar";
import { INTEREST_IDEAS, fileToAvatar, isValidUsername, normalizeUsername, type Profile } from "@/lib/pause";

export function ProfileForm({ userId, initial, initialPhone, onSaved, cta }: {
  userId: string; initial?: Profile; initialPhone?: string | null | undefined; onSaved: () => void; cta: string;
}) {
  const [username, setUsername] = useState(initial?.username ?? "");
  const [name, setName] = useState(initial?.display_name ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [avatar, setAvatar] = useState<string | null>(initial?.avatar_url ?? null);
  const [interests, setInterests] = useState<string[]>(initial?.interests ?? []);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const u = normalizeUsername(username);
    if (!isValidUsername(u)) { toast.error("Username: 3–20 lowercase letters, numbers or _"); return; }
    if (!name.trim()) { toast.error("Add a display name"); return; }
    setBusy(true);
    const row = { username: u, display_name: name.trim(), avatar_url: avatar, phone: phone.trim() || null, interests };
    const { error } = initial
      ? await supabase.from("profiles").update(row).eq("id", userId)
      : await supabase.from("profiles").insert({ id: userId, ...row });
    setBusy(false);
    if (error) {
      toast.error(error.code === "23505" ? "That username is taken" : "Couldn't save profile");
      return;
    }
    toast.success("Saved");
    onSaved();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex items-center gap-4">
        <PAvatar name={name || "?"} src={avatar} size={72} />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="rounded-xl" onClick={() => fileRef.current?.click()}>
            {avatar ? "Change photo" : "Add photo"}
          </Button>
          {avatar && <Button type="button" variant="ghost" onClick={() => setAvatar(null)}>Remove</Button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) setAvatar(await fileToAvatar(f));
        }} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="emir" autoCapitalize="none" className="h-12 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Emir" className="h-12 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone / WhatsApp <span className="text-muted-foreground">(optional, friends only)</span></Label>
        <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 7700 900123" className="h-12 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label>Things you'd rather do than scroll</Label>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...INTEREST_IDEAS, ...interests])].map((i) => {
            const on = interests.includes(i);
            return (
              <button key={i} type="button" onClick={() => setInterests(on ? interests.filter((x) => x !== i) : [...interests, i])}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                {i}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add your own" className="h-11 rounded-xl" />
          <Button type="button" variant="secondary" className="h-11 rounded-xl" onClick={() => {
            const v = custom.trim();
            if (v && !interests.includes(v)) setInterests([...interests, v]);
            setCustom("");
          }}>Add</Button>
        </div>
      </div>
      <Button type="submit" disabled={busy} className="h-14 w-full rounded-2xl text-lg">{busy ? "Saving…" : cta}</Button>
    </form>
  );
}
