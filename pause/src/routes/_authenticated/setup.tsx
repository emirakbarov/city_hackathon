import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PASS_SHORTCUT_LINK = "https://www.icloud.com/shortcuts/dcb8f1afa73e46c0a622a3cdc757bb73";
const CANCEL_SHORTCUT_LINK = "https://www.icloud.com/shortcuts/c5b199ec1cbe4d3aa8f0a12621c06121";
const CHECK_SHORTCUT_LINK = "https://www.icloud.com/shortcuts/1e9903894546444c990d61cf6919bfc1";
const APP_ORIGIN = "https://pause-before-scroll-together.lovable.app";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "iPhone setup — Pause" },
      { name: "description", content: "Set up the Shortcuts automation so Pause opens before Instagram." },
      { property: "og:title", content: "iPhone setup — Pause" },
      { property: "og:description", content: "Set up the Shortcuts automation so Pause opens before Instagram." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Setup,
});

function CopyLine({ value }: { value: string }) {
  return (
    <Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(value); toast.success("Copied"); }}
      className="mt-2 flex h-auto w-full items-center gap-2 whitespace-normal rounded-xl px-3 py-3 text-left font-mono text-sm">
      <span className="min-w-0 flex-1 break-all">{value}</span><Copy className="h-4 w-4 shrink-0 text-primary" />
    </Button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{n}</span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="space-y-2 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

function Setup() {
  const interceptUrl = `${APP_ORIGIN}/intercept?app=instagram`;
  const timesUpUrl = `${APP_ORIGIN}/times-up?minutes=`;
  return (
    <main className="space-y-4 px-5 pt-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold">iPhone setup</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Setup help" className="h-11 w-11 shrink-0 rounded-full"><HelpCircle className="h-5 w-5 text-primary" /></Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
            <DialogHeader><DialogTitle>Setup FAQ</DialogTitle></DialogHeader>
            <div className="space-y-4">
      <Step n={1} title="How Pause Pass works">
        <p><b>Pause Pass still asks you to type the minutes?</b> Pause already sends your chosen minutes into the shortcut. Open Pause Pass to edit, find the action that asks for the minutes (it will say <b>Ask Each Time</b> or <b>Ask for Input</b>), tap it and choose <b>Shortcut Input</b> instead. Do this once and it never asks again.</p>
        <p>If your “Pause Pass” doesn’t match the actions below yet, open it to edit and replace its old date-file actions with these, in order:</p>
        <p>Pause Pass only handles timed passes. Clearing the limit is a separate shortcut — see <b>How Pause Cancel works</b> below.</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li><b>Get Numbers from Input</b>: input = <b>Shortcut Input</b>. Set variable <b>Minutes</b> to that number. “Start 20 min on Instagram” sends 20, not seconds.</li>
          <li><b>If</b> Minutes has no value, is less than 1, or is greater than 45: <b>Stop This Shortcut</b> (use separate If actions).</li>
          <li><b>Current Date</b> → set variable <b>Started</b>.</li>
          <li><b>Adjust Date</b>: add <b>Minutes</b> minutes to <b>Started</b> → set variable <b>Expires</b>.</li>
          <li><b>Format Date</b> for Started, then Expires: choose <b>ISO 8601</b> for each (keep the time and time zone).</li>
          <li><b>Text</b>: use the JSON below, replacing the values with the magic variables <b>Minutes</b>, formatted <b>Started</b>, and formatted <b>Expires</b>. Keep quotes around the dates, but not the number.</li>
          <li><b>Set Name</b> of the Text to <code>pause_scroll.json</code> → <b>Save File</b> to <b>iCloud Drive / Shortcuts</b>. Turn <b>Ask Where to Save</b> off and <b>Overwrite If File Exists</b> on.</li>
          <li><b>Start Timer</b>: duration = <b>Minutes</b>, unit = <b>minutes</b>.</li>
          <li>Finally, <b>Open App</b>: Instagram. The file must be saved before this action.</li>
        </ol>
        <CopyLine value={'{"minutes":20,"started_at":"2026-11-21T16:00:00Z","expires_at":"2026-11-21T16:20:00Z"}'} />
        <p className="text-sm text-muted-foreground">Example only: insert the three variables, not these fixed values. Do not add a Wait action. The saved expiry, not the Clock timer, decides where your next Instagram open goes.</p>
      </Step>

      <Step n={2} title="How Pause Cancel works">
        <p>The <b>Cancel limit and open Instagram</b> button on “Time’s up” runs <b>Pause Cancel</b>. Its one job is to clear the saved limit so Instagram opens normally again.</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li><b>Text</b>: <code>{'{"cancelled":true}'}</code></li>
          <li><b>Set Name</b> of the Text to <code>pause_scroll.json</code> → <b>Save File</b> to <b>iCloud Drive / Shortcuts</b>. Turn <b>Ask Where to Save</b> off and <b>Overwrite If File Exists</b> on.</li>
          <li><b>Open App</b>: Instagram.</li>
        </ol>
        <p className="text-sm text-muted-foreground">Pause Cancel receives nothing, so it must not ask for input or try to read a number. The next timed pass from a Pause check-in overwrites this file with its chosen minutes and expiry. If a Clock timer is still running, cancel it in Clock too.</p>
      </Step>

      <Step n={3} title="Create the automation">
        <p>Shortcuts → <b>Automation</b> → <b>+</b> → <b>App</b> → choose <b>Instagram</b>, tick <b>Is Opened</b> → <b>Run Immediately</b>, turn off <b>Notify When Run</b>. Replace the old 10-second check with:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li><b>Get File from Folder</b>: iCloud Drive / Shortcuts, path <code>pause_scroll.json</code>. Turn <b>Error If Not Found</b> off.</li>
          <li><b>If</b> File has no value: <b>Open URLs</b> with the check-in link below, then <b>Stop This Shortcut</b>.</li>
        </ol>
        <CopyLine value={interceptUrl} />
        <ol start={3} className="list-decimal space-y-2 pl-5">
          <li><b>Get Dictionary from Input</b> (File). First get <code>cancelled</code>: if it is <b>true</b>, <b>Stop This Shortcut</b> so Instagram stays open. Otherwise get <code>minutes</code> → set variable <b>Minutes</b>. Get <code>expires_at</code> → <b>Get Dates from Input</b> → set variable <b>Expiry</b>.</li>
          <li>If Minutes or Expiry has no value: <b>Open URLs</b> with the check-in link, then <b>Stop This Shortcut</b>.</li>
          <li><b>Current Date</b> → set variable <b>Now</b>. <b>Get Time Between Dates</b>: from <b>Now</b> to <b>Expiry</b>, in <b>Seconds</b>.</li>
          <li><b>If</b> Time Between <b>is greater than 0</b>: <b>Stop This Shortcut</b>. Instagram stays open for the rest of the chosen time. Do not restart the timer or rewrite the file.</li>
          <li><b>Otherwise</b>: <b>Text</b> with the time’s-up link below, then insert the <b>Minutes</b> magic variable immediately after <code>=</code>. <b>Open URLs</b> with that Text.</li>
        </ol>
        <CopyLine value={timesUpUrl} />
        <p className="text-sm text-muted-foreground">For 20 minutes the final link ends in <code>/times-up?minutes=20</code>. Keep the expired file: every later Instagram open returns to “Time’s up”, even the next day. No automatic reset and no new check-in is logged.</p>
        <p className="text-sm text-muted-foreground">To deliberately start fresh later, delete <code>pause_scroll.json</code> in Files → iCloud Drive → Shortcuts. Your next Instagram open shows the check-in again.</p>
        <p className="text-sm text-muted-foreground">Cancelling with <b>Pause Cancel</b> removes the limit until you start a new timed pass from a Pause check-in. A new pass overwrites the cancelled file with its chosen minutes and expiry. If a Clock timer is still running, cancel it in Clock too.</p>
      </Step>

      <Step n={4} title="Add Pause to your Home Screen">
        <p>Open this page in Safari → <b>Share</b> → <b>Add to Home Screen</b>. It loads faster and keeps you signed in.</p>
        <p className="text-sm text-muted-foreground">Shortcuts opens the Safari website; sign in there too if your Home Screen app has a separate session.</p>
      </Step>

      <p className="text-sm text-muted-foreground">The timer rings at the chosen time. Pause cannot close Instagram while you stay in it; the next time you open Instagram, the automation takes you to “Time’s up”.</p>

            </div>
          </DialogContent>
        </Dialog>
      </div>

      <section className="space-y-2 rounded-3xl bg-card p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Add the shortcuts</h2>
        <p className="text-[15px] leading-relaxed text-muted-foreground">Pause needs these so it can open before Instagram, start your chosen timer, and send you to “Time’s up” when it ends. Tap each one, then <b>Add Shortcut</b> — keep the names as they are. Stuck? Tap <b>?</b> above.</p>
        <Button asChild className="mt-2 h-auto w-full whitespace-normal rounded-2xl py-4 text-lg"><a href={PASS_SHORTCUT_LINK} target="_blank" rel="noopener noreferrer">Add Pause Pass shortcut</a></Button>
        <Button asChild variant="secondary" className="h-auto w-full whitespace-normal rounded-2xl py-4 text-lg"><a href={CANCEL_SHORTCUT_LINK} target="_blank" rel="noopener noreferrer">Add Pause Cancel shortcut</a></Button>
        <Button asChild variant="secondary" className="h-auto w-full whitespace-normal rounded-2xl py-4 text-lg"><a href={CHECK_SHORTCUT_LINK} target="_blank" rel="noopener noreferrer">Add Pause Check shortcut</a></Button>
      </section>

      <section className="space-y-2 rounded-3xl bg-card p-5 shadow-sm">
        <h2 className="text-xl font-semibold">One last step: the Instagram automation</h2>
        <p className="text-[15px] leading-relaxed text-muted-foreground">The automation that opens Pause before Instagram has to be set up <b>by hand on each phone</b> — iOS doesn’t let the app or a shortcut create it for you. Once it’s set up it keeps running on its own; you only need to redo it if you delete the shortcut it runs or switch phones. The steps are in the <b>?</b> above, under “Create the automation”.</p>
      </section>

      <Link to="/intercept" search={{ app: "instagram" }} className="block rounded-2xl bg-primary py-4 text-center text-lg font-semibold text-primary-foreground">
        Try a check-in now
      </Link>

      <section className="space-y-2 rounded-3xl bg-card p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Leaving Pause?</h2>
        <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-relaxed">
          <li>Shortcuts → <b>Automation</b> → swipe left on the Instagram automation → <b>Delete</b>.</li>
          <li>Shortcuts → <b>Shortcuts</b> → long-press Pause Pass, Pause Cancel and Pause Check → <b>Delete</b>.</li>
          <li>Optional: Files → iCloud Drive → Shortcuts → delete <code>pause_scroll.json</code>.</li>
        </ol>
        <Button asChild variant="secondary" className="h-auto w-full rounded-2xl py-4 text-lg"><a href="shortcuts://">Open Shortcuts</a></Button>
      </section>
    </main>
  );
}
