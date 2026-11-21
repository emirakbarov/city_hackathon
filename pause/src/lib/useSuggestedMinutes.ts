import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import modelUrl from "@/lib/scroll-model.json?url";
import { recommendScrollMinutes, type ScrollModel } from "@/lib/scrollModel";
import { buildScrollContext, loadScrollSettings, minutesScrolledToday } from "@/lib/scrollContext";
import { useLocationTrace } from "@/lib/useLocationTrace";

import { wheelStart } from "@/lib/wheelStart";
import { personalise, type Exam, type PersonalState } from "@/lib/personalModel";
import { recordOpen } from "@/lib/personalLearning";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/commitments";

const NEUTRAL_MOOD = 3; // check-in no longer asks about mood

async function loadModel(): Promise<ScrollModel> {
  const res = await fetch(modelUrl);
  if (!res.ok) throw new Error("model fetch failed");
  return (await res.json()) as ScrollModel;
}

/** Raf's model suggestion, clamped for the wheel. null until the model has loaded. */
export function useSuggestedMinutes(userId: string, enabled: boolean) {
  const [personalState, setPersonalState] = useState<PersonalState | null>(null);
  const recorded = useRef(false);
  useEffect(() => {
    if (!enabled || recorded.current) return;
    recorded.current = true;
    setPersonalState(recordOpen(userId));
  }, [enabled, userId]);
  const live = useLocationTrace(enabled);
  const { data: model } = useQuery({ queryKey: ["scroll-model"], queryFn: loadModel, staleTime: Infinity, enabled });
  const { data: scrolled } = useQuery({ queryKey: ["scrolled-today", userId], queryFn: () => minutesScrolledToday(userId), enabled });
  const { data: exams } = useQuery({
    queryKey: ["personal-exams", userId, todayISO()], enabled,
    queryFn: async (): Promise<Exam[]> => {
      const { data, error } = await supabase.from("commitments").select("id, title, due_date").eq("user_id", userId).eq("kind", "exam").gte("due_date", todayISO());
      if (error) throw error;
      return (data ?? []).map(e => ({ id: e.id, title: e.title, date: `${e.due_date}T12:00:00`, importance: 2 }));
    }, retry: 1,
  });
  return useMemo(() => {
    if (!model) return null;
    const settings = loadScrollSettings();
    const base = recommendScrollMinutes(live.trace, buildScrollContext(settings, scrolled ?? 0, NEUTRAL_MOOD), model);
    const rec = personalState ? personalise({ now: Date.now(), baseMinutes: base.minutes, baseReason: base.reason, context: base.context, minutesScrolledToday: scrolled ?? 0, mood: NEUTRAL_MOOD, aim: { dailyTargetMinutes: settings.dailyTargetMinutes }, exams: exams ?? [], state: personalState }) : base;
    return { minutes: wheelStart(rec.minutes), reason: rec.reason.replace(/\d+ min/, `${wheelStart(rec.minutes)} min`) };
  }, [model, scrolled, live.trace, personalState, exams]);
}
