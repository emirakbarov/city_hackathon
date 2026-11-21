import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dailyIntentionQuery } from "@/lib/dailyIntention";
import { todayISO } from "@/lib/commitments";
import { needsDailyCheckIn } from "@/lib/productivity";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function DailyCheckIn({ showSummary }: { showSummary: boolean }) {
  const me = useMe();
  const qc = useQueryClient();
  const [day, setDay] = useState(todayISO());
  const { data, isSuccess } = useQuery(dailyIntentionQuery(me.id, day));
  const [open, setOpen] = useState(false);
  const [objective, setObjective] = useState("");
  const [energy, setEnergy] = useState("steady");
  const [minutes, setMinutes] = useState(15);
  const [interests, setInterests] = useState("");
  const [busy, setBusy] = useState(false);
  const key = `pause_daily_prompt_${me.id}`;

  useEffect(() => {
    const refresh = () => setDay(todayISO());
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (isSuccess && needsDailyCheckIn(data?.day) && localStorage.getItem(key) !== day) {
      setObjective("");
      setOpen(true);
    }
  }, [isSuccess, data, day, key]);

  function changeOpen(value: boolean) {
    if (!value) localStorage.setItem(key, day);
    setOpen(value);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!objective.trim()) return;
    setBusy(true);
    try {
      if (interests.trim()) {
        const next = [...new Set([...(me.interests ?? []), ...interests.split(",").map(i => i.trim()).filter(Boolean)])];
        const result = await supabase.from("profiles").update({ interests: next }).eq("id", me.id);
        if (result.error) throw result.error;
        await qc.invalidateQueries({ queryKey: ["me", me.id] });
      }
      const { error } = await supabase.from("daily_intentions").upsert({ user_id: me.id, day, objective: objective.trim(), energy, available_minutes: minutes });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["daily-intention", me.id] });
      changeOpen(false);
    } catch { toast.error("Couldn't save today's plan. Try again."); }
    finally { setBusy(false); }
  }

  return <>
    {showSummary && <section className="mx-5 mt-6 border-b pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="font-semibold">Today's objective</h2><p className="break-words text-sm text-muted-foreground">{data?.objective || "What would make today a good day?"}</p></div>
        <Button variant="ghost" size="icon" aria-label="Edit today's objective" onClick={() => { setObjective(data?.objective ?? ""); setEnergy(data?.energy ?? "steady"); setMinutes(data?.available_minutes ?? 15); setOpen(true); }}><Pencil /></Button>
      </div>
    </section>}
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg">
        <DialogTitle>A little intention for today</DialogTitle>
        <DialogDescription>What would you like to make time for?</DialogDescription>
        <form onSubmit={save} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="daily-objective">Your main objective</Label><Input id="daily-objective" value={objective} maxLength={300} required placeholder="Finish my essay, practise Spanish…" onChange={e => setObjective(e.target.value)} /></div>
          <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">How's your energy?</legend><div className="flex gap-2">{[["low", "Low"], ["steady", "Steady"], ["high", "High"]].map(([value, label]) => <Button key={value} type="button" variant={energy === value ? "default" : "secondary"} aria-pressed={energy === value} className="flex-1" onClick={() => setEnergy(value ?? "steady")}>{label}</Button>)}</div></fieldset>
          <fieldset><legend className="mb-2 text-sm font-medium">Time for a small task?</legend><div className="flex gap-2">{[5, 15, 30].map(n => <Button key={n} type="button" variant={minutes === n ? "default" : "secondary"} aria-pressed={minutes === n} className="flex-1" onClick={() => setMinutes(n)}>{n} min</Button>)}</div></fieldset>
          {!me.interests?.length && <div className="space-y-2"><Label htmlFor="daily-interests">What do you enjoy or want to learn? (optional)</Label><Input id="daily-interests" value={interests} maxLength={300} placeholder="Duolingo, reading, chess…" onChange={e => setInterests(e.target.value)} /></div>}
          <Button type="submit" className="min-h-12 w-full" disabled={busy || !objective.trim()}>{busy ? "Saving…" : "Save today's plan"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}