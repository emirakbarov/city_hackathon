import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  calendarStatus, completeCalendarConnect, disconnectCalendar, startCalendarConnect, syncCalendar,
} from "@/lib/googleCalendar.functions";

function waitForOAuth(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    const cleanup = () => { window.removeEventListener("message", onMsg); window.clearInterval(poll); };
    const onMsg = (e: MessageEvent) => {
      const t = e.data?.type;
      if (e.origin !== window.location.origin || e.source !== popup || e.data?.connectorId !== "google_calendar"
        || (t !== "appUserConnectorOAuthComplete" && t !== "appUserConnectorOAuthFailed")) return;
      cleanup();
      if (t === "appUserConnectorOAuthComplete") resolve(typeof e.data?.code === "string" ? e.data.code : null);
      else { popup.close(); reject(new Error("Google didn't finish linking.")); }
    };
    window.addEventListener("message", onMsg);
    const poll = window.setInterval(() => { if (popup.closed) { cleanup(); reject(new Error("Window closed before linking finished.")); } }, 500);
  });
}

export function CalendarLink({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const status = useServerFn(calendarStatus);
  const start = useServerFn(startCalendarConnect);
  const complete = useServerFn(completeCalendarConnect);
  const sync = useServerFn(syncCalendar);
  const disconnect = useServerFn(disconnectCalendar);
  const { data } = useQuery({ queryKey: ["calendar-status", userId], queryFn: () => status() });
  const [busy, setBusy] = useState(false);
  const [reconnect, setReconnect] = useState(false);

  async function runSync(quiet = false) {
    const r = await sync();
    if (r.reconnectRequired) { setReconnect(true); return; }
    qc.invalidateQueries({ queryKey: ["commitments", userId] });
    if (!quiet) toast.success(`Pulled in ${r.count} event${r.count === 1 ? "" : "s"} from Google Calendar`);
  }

  useEffect(() => { if (data?.connected) runSync(true).catch(() => {}); }, [data?.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onLink() {
    const popup = window.open("", "lovable-oauth", "width=600,height=720");
    if (!popup) { toast.error("Allow pop-ups and try again"); return; }
    setBusy(true);
    try {
      const { authorizationUrl } = await start();
      const done = waitForOAuth(popup);
      popup.location.href = authorizationUrl;
      const code = await done;
      if (code) await complete({ data: { code } });
      setReconnect(false);
      await qc.invalidateQueries({ queryKey: ["calendar-status", userId] });
      toast.success(reconnect ? "Reconnected to Google Calendar" : "Google Calendar linked");
      await runSync();
    } catch (e) {
      popup.close();
      toast.error(e instanceof Error ? e.message : "Couldn't link Google Calendar");
    } finally { setBusy(false); }
  }

  async function onUnlink() {
    setBusy(true);
    try {
      await disconnect();
      await qc.invalidateQueries({ queryKey: ["calendar-status", userId] });
      qc.invalidateQueries({ queryKey: ["commitments", userId] });
      toast.success("Google Calendar unlinked");
    } catch { toast.error("Couldn't unlink"); } finally { setBusy(false); }
  }

  if (!data) return null;
  if (!data.configured) {
    return <p className="mt-3 text-center text-xs text-muted-foreground">Google Calendar linking is coming soon.</p>;
  }
  if (data.connected && !reconnect) {
    return (
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="h-12 flex-1 rounded-2xl" disabled={busy} onClick={() => { setBusy(true); runSync().catch(() => toast.error("Couldn't refresh")).finally(() => setBusy(false)); }}>
          📅 Refresh calendar
        </Button>
        <Button variant="ghost" className="h-12 rounded-2xl" disabled={busy} onClick={onUnlink}>Unlink</Button>
      </div>
    );
  }
  return (
    <div className="mt-3">
      {reconnect && <p className="mb-2 text-sm text-muted-foreground">Your Google Calendar access needs to be renewed.</p>}
      <Button variant="outline" className="h-12 w-full rounded-2xl" disabled={busy} onClick={onLink}>
        📅 {reconnect ? "Reconnect Google Calendar" : "Link Google Calendar"}
      </Button>
    </div>
  );
}
