import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  appUserReconnectRequired, authorizeAppUserOAuth, callAsAppUser, disconnectAppUser, exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
import { deleteConnectionForUser, getConnectionKeyForUser, saveConnectionKeyForUser } from "@/lib/appUserConnections.server";
import { mapEvent, type GoogleEvent } from "@/lib/calendarEvents";

const GATEWAY = "https://connector-gateway.lovable.dev";
const CONNECTOR = "google_calendar";
const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export const calendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const configured = !!process.env['GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!configured) return { configured: false, connected: false };
    const k = await getConnectionKeyForUser(context.userId, CONNECTOR).catch(() => null);
    return { configured: true, connected: !!k };
  });

export const startCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientAPIKey = process.env['GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!clientAPIKey) throw new Error("Google Calendar linking isn't set up yet.");
    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL("/api/oauth/google_calendar/return", sandboxHost ? `https://${sandboxHost}` : url.origin).toString();
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY, connectorId: CONNECTOR, appUserId: context.userId, clientAPIKey, returnUrl,
      credentialsConfiguration: { scopes: SCOPES },
    });
    return { authorizationUrl };
  });

export const completeCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY, data.code);
    if (connectorId !== CONNECTOR) throw new Error("OAuth completion returned the wrong connector");
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true };
  });

export const syncCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR);
    if (!key) return { connected: false, reconnectRequired: false, count: 0 };
    const now = new Date();
    const qs = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + 60 * 86_400_000).toISOString(),
      singleEvents: "true", orderBy: "startTime", maxResults: "100",
    });
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY, connectionAPIKey: key, connectorId: CONNECTOR,
      path: `/calendar/v3/calendars/primary/events?${qs}`, requiredScopes: SCOPES,
    });
    if (await appUserReconnectRequired(res)) return { connected: false, reconnectRequired: true, count: 0 };
    if (!res.ok) {
      const body = await res.text();
      console.error(`Google Calendar fetch failed [${res.status}]: ${body}`);
      throw new Error(`Couldn't read your calendar (${res.status})`);
    }
    const json = (await res.json()) as { items?: GoogleEvent[] };
    const rows = (json.items ?? []).map(mapEvent).filter((r) => r !== null);
    const { supabase, userId } = context;
    if (rows.length) {
      const { error } = await supabase.from("commitments").upsert(
        rows.map((r) => ({ ...r, user_id: userId, source: "google_calendar", updated_at: new Date().toISOString() })),
        { onConflict: "user_id,source,external_id" },
      );
      if (error) throw new Error(error.message);
    }
    // Drop calendar entries that disappeared from Google.
    const ids = rows.map((r) => r.external_id);
    let del = supabase.from("commitments").delete().eq("user_id", userId).eq("source", "google_calendar");
    if (ids.length) del = del.not("external_id", "in", `(${ids.map((i) => `"${i.replace(/"/g, "")}"`).join(",")})`);
    await del;
    return { connected: true, reconnectRequired: false, count: rows.length };
  });

export const disconnectCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR);
    if (key) await disconnectAppUser({ gatewayBaseUrl: GATEWAY, connectionAPIKey: key, connectorId: CONNECTOR });
    await deleteConnectionForUser(context.userId, CONNECTOR);
    await context.supabase.from("commitments").delete().eq("user_id", context.userId).eq("source", "google_calendar");
    return { ok: true };
  });
