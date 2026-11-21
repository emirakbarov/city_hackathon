import { supabase } from "@/integrations/supabase/client";

export const REASONS = [
  { value: "socialise", label: "Socialise" },
  { value: "productive", label: "Be productive" },
  { value: "relax", label: "Relax" },
] as const;

// Older check-in answers, kept so past sessions still show a label.
const LEGACY_REASONS = [
  { value: "bored", label: "Bored" },
  { value: "procrastinating", label: "Procrastinating" },
  { value: "messaging", label: "Messaging someone" },
  { value: "habit", label: "Habit" },
  { value: "specific", label: "Something specific" },
] as const;

export const MOODS = [
  { value: 1, emoji: "😣", label: "Rough" },
  { value: 2, emoji: "😕", label: "Meh" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
] as const;

export const ACTIVITIES = ["Call?", "Grab food?", "Go for a walk?", "Gym?", "Play something?"] as const;
export type Activity = (typeof ACTIVITIES)[number];

export const ACTIVE_WINDOW_MIN = 15;
export const SHORTCUT_URL = "shortcuts://run-shortcut?name=Pause%20Pass";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  interests?: string[];
};
export const PROFILE_COLS = "id, username, display_name, avatar_url, interests";

/** Opens Pause Pass and hands it the chosen limit so it can start a timer. */
export function passUrl(minutes: number) {
  return `${SHORTCUT_URL}&input=text&text=${Math.round(minutes)}`;
}

export const INTEREST_IDEAS = [
  "Chess", "Reading", "Running", "Gym", "Guitar", "Drawing", "Cooking", "Walking", "Gaming", "Journaling", "Meditation", "Calling family",
];

/** A session only counts once it ended in a real choice: something else, or scrolling. */
export const LOGGED_OUTCOMES = ["redirected", "continued"] as const;

export function isLogged(outcome: string) {
  return (LOGGED_OUTCOMES as readonly string[]).includes(outcome);
}

export function reasonLabel(v: string | null) {
  return [...REASONS, ...LEGACY_REASONS].find((r) => r.value === v)?.label ?? "—";
}

export function timeAgo(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function inviteUrl(username: string) {
  return `${window.location.origin}/invite/${username}`;
}

export function normalizeUsername(v: string) {
  return v.trim().toLowerCase().replace(/^@/, "");
}

export function isValidUsername(v: string) {
  return /^[a-z0-9_]{3,20}$/.test(v);
}

/** WhatsApp link from a phone number; null if not usable. */
export function whatsappLink(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}`;
}

/** Keep the most recent active status per friend. */
export function latestPerUser<T extends { user_id: string; created_at: string }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const r of rows) {
    const cur = map.get(r.user_id);
    if (!cur || cur.created_at < r.created_at) map.set(r.user_id, r);
  }
  return [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function sendFriendRequest(myId: string, username: string): Promise<string> {
  const u = normalizeUsername(username);
  const { data: target } = await supabase.from("profiles").select("id").eq("username", u).maybeSingle();
  if (!target) return "No one with that username";
  if (target.id === myId) return "That's you!";
  const { data: existing } = await supabase
    .from("friendships")
    .select("id, status, requester_id")
    .or(`and(requester_id.eq.${myId},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${myId})`)
    .maybeSingle();
  if (existing) {
    if (existing.status === "accepted") return "You're already friends";
    if (existing.status === "pending" && existing.requester_id === target.id) {
      await supabase.from("friendships").update({ status: "accepted" }).eq("id", existing.id);
      return "You're now friends 🎉";
    }
    if (existing.status === "pending") return "Request already sent";
    // declined: allow a fresh request
    await supabase.from("friendships").delete().eq("id", existing.id);
  }
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: myId, addressee_id: target.id });
  if (error) return "Couldn't send request";
  return "Friend request sent";
}

export async function friendIds(myId: string) {
  const { data } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted");
  return (data ?? []).map((f) => (f.requester_id === myId ? f.addressee_id : f.requester_id));
}

/** Resize an image file to a small square JPEG data URL for avatars. */
export async function fileToAvatar(file: File, size = 160): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}
