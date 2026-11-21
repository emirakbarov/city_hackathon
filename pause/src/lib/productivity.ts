import { todayISO } from "./commitments";

export type DailyIntention = { day: string; objective: string; energy: string; available_minutes: number };
export type ProductiveOption = { title: string; detail: string; url?: string };

export function needsDailyCheckIn(savedDay: string | null | undefined, now = new Date()) {
  return savedDay !== todayISO(now);
}

export function productiveOptions(interests: string[], intention: DailyIntention | null, commitments: { title: string; due_date: string }[], now = new Date()): ProductiveOption[] {
  const minutes = intention?.available_minutes ?? 15;
  const detail = intention?.energy === "low" ? `One small step · ${minutes} min` : `Focus for ${minutes} min`;
  const options: ProductiveOption[] = intention?.objective ? [{ title: intention.objective, detail }] : [];
  const next = commitments.filter(c => c.due_date >= todayISO(now)).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  if (next) options.push({ title: `Work on ${next.title}`, detail });
  for (const interest of interests.slice(0, 5)) {
    if (/duolingo/i.test(interest)) options.push({ title: "Do a Duolingo lesson", detail: `Language practice · ${minutes} min`, url: "https://www.duolingo.com/learn" });
    else if (/language|spanish|french|german|italian|japanese/i.test(interest)) options.push({ title: `Practise ${interest}`, detail });
    else if (/news|current affairs/i.test(interest)) options.push({ title: `Read ${interest}`, detail: "Latest news", url: `https://news.google.com/search?q=${encodeURIComponent(interest)}` });
    else options.push({ title: interest, detail });
  }
  if (!options.length) options.push({ title: "Finish one small task", detail });
  if (!options.some(o => o.detail === "Latest news")) options.push({ title: "Read a news article", detail: "Latest news · BBC", url: "https://www.bbc.com/news" });
  return options.filter((o, i, all) => all.findIndex(p => p.title === o.title) === i);
}