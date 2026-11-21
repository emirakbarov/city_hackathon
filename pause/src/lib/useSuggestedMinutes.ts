import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import modelUrl from "@/lib/scroll-model.json?url";
import { recommendScrollMinutes, type ScrollModel } from "@/lib/scrollModel";
import { buildScrollContext, loadScrollSettings, minutesScrolledToday } from "@/lib/scrollContext";
import { useLocationTrace } from "@/lib/useLocationTrace";

import { wheelStart } from "@/lib/wheelStart";

const NEUTRAL_MOOD = 3; // check-in no longer asks about mood

async function loadModel(): Promise<ScrollModel> {
  const res = await fetch(modelUrl);
  if (!res.ok) throw new Error("model fetch failed");
  return (await res.json()) as ScrollModel;
}

/** Raf's model suggestion, clamped for the wheel. null until the model has loaded. */
export function useSuggestedMinutes(userId: string, enabled: boolean) {
  const live = useLocationTrace(enabled);
  const { data: model } = useQuery({ queryKey: ["scroll-model"], queryFn: loadModel, staleTime: Infinity, enabled });
  const { data: scrolled } = useQuery({ queryKey: ["scrolled-today", userId], queryFn: () => minutesScrolledToday(userId), enabled });
  return useMemo(() => {
    if (!model) return null;
    const rec = recommendScrollMinutes(live.trace, buildScrollContext(loadScrollSettings(), scrolled ?? 0, NEUTRAL_MOOD), model);
    return { minutes: wheelStart(rec.minutes), reason: rec.reason.replace(/\d+ min/, `${wheelStart(rec.minutes)} min`) };
  }, [model, scrolled, live.trace]);
}
