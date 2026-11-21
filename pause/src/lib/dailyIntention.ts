import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "./commitments";

export function dailyIntentionQuery(userId: string, day = todayISO()) {
  return queryOptions({
    queryKey: ["daily-intention", userId, day],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_intentions").select("day, objective, energy, available_minutes").eq("user_id", userId).eq("day", day).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
    retry: 1,
  });
}