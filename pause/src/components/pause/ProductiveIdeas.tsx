import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { dailyIntentionQuery } from "@/lib/dailyIntention";
import { productiveOptions } from "@/lib/productivity";
import { todayISO } from "@/lib/commitments";
import { Button } from "@/components/ui/button";

export function ProductiveIdeas({ onPick }: { onPick: (url?: string) => Promise<void> }) {
  const me = useMe();
  const intention = useQuery(dailyIntentionQuery(me.id));
  const commitments = useQuery({
    queryKey: ["productive-commitments", me.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("commitments").select("title, due_date").eq("user_id", me.id).gte("due_date", todayISO()).order("due_date").limit(3);
      if (error) throw error;
      return data;
    },
    retry: 1,
  });
  const options = productiveOptions(me.interests ?? [], intention.data ?? null, commitments.data ?? []);
  return <section className="mb-7 space-y-3">
    <h1 className="text-2xl font-bold">Make a little progress</h1>
    <div className="grid gap-2">
      {options.map(option => option.url ? <Button key={option.title} asChild variant="secondary" className="h-auto min-h-16 justify-between whitespace-normal rounded-lg px-4 py-3 text-left">
        <a href={option.url} onClick={e => { e.preventDefault(); void onPick(option.url); }}><span className="min-w-0"><span className="block break-words font-semibold">{option.title}</span><span className="block text-xs font-normal text-muted-foreground">{option.detail}</span></span><ArrowUpRight className="shrink-0" /></a>
      </Button> : <Button key={option.title} variant="secondary" className="h-auto min-h-16 justify-between whitespace-normal rounded-lg px-4 py-3 text-left" onClick={() => onPick()}>
        <span className="min-w-0"><span className="block break-words font-semibold">{option.title}</span><span className="block text-xs font-normal text-muted-foreground">{option.detail}</span></span><Check className="shrink-0" />
      </Button>)}
    </div>
  </section>;
}