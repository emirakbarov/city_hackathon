import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";

const PASS_SHORTCUT_LINK = "https://www.icloud.com/shortcuts/6e2688385f414d92b75bd3170dd940ca";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "iPhone setup — Pause" },
      { name: "description", content: "Set up the Shortcuts automation so Pause opens before Instagram." },
      { property: "og:title", content: "iPhone setup — Pause" },
      { property: "og:description", content: "Set up the Shortcuts automation so Pause opens before Instagram." },
    ],
  }),
  component: Setup,
});

function CopyLine({ value }: { value: string }) {
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(value); toast.success("Copied"); }}
      className="mt-2 flex w-full items-center gap-2 rounded-xl bg-muted px-3 py-3 text-left font-mono text-sm active:bg-accent">
      <span className="min-w-0 flex-1 break-all">{value}</span><Copy className="h-4 w-4 shrink-0 text-primary" />
    </button>
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
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const interceptUrl = `${origin}/intercept?app=instagram`;
  const backUrl = `${origin}/back?app=instagram`;
  return (
    <main className="space-y-4 px-5 pt-6">
      <h1 className="text-3xl font-bold">iPhone setup</h1>
      <p className="text-muted-foreground">About 3 minutes in the Shortcuts app. Do these in order.</p>

      <Step n={1} title={`Add the "Pause Pass" shortcut`}>
        <p>Tap below, then tap <b>Add Shortcut</b>. Keep the name exactly “Pause Pass”.</p>
        <a href={PASS_SHORTCUT_LINK} target="_blank" rel="noopener noreferrer"
          className="mt-2 block rounded-2xl bg-primary py-4 text-center text-lg font-semibold text-primary-foreground active:opacity-90">
          Add Pause Pass shortcut
        </a>
        <p className="text-sm text-muted-foreground">This lets “Continue to Instagram” open it without Pause popping up again.</p>
      </Step>

      <Step n={2} title="Create the automation">
        <p>Shortcuts → <b>Automation</b> → <b>+</b> → <b>App</b> → choose <b>Instagram</b>, tick <b>Is Opened</b> → <b>Run Immediately</b>, turn off <b>Notify When Run</b>. Then add:</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li><b>Get File</b> from Shortcuts folder, path <code>pause_last_pass.txt</code>, turn off “Error If Not Found”</li>
          <li><b>Get Dates from Input</b> (the file)</li>
          <li><b>Get Time Between</b> Dates and <b>Current Date</b> in <b>Seconds</b></li>
          <li><b>If</b> Time Between <b>is greater than</b> 10 (or has no value)</li>
          <li>Inside the If: <b>Open URLs</b> with:</li>
        </ol>
        <CopyLine value={interceptUrl} />
        <p className="text-sm text-muted-foreground">Leave “Otherwise” empty.</p>
      </Step>

      <Step n={3} title="When Instagram closes, come back">
        <p>This lets Pause learn how long you actually scrolled, so its suggestions fit you better over time.</p>
        <p>Shortcuts → <b>Automation</b> → <b>+</b> → <b>App</b> → choose <b>Instagram</b>, tick <b>Is Closed</b> (untick Is Opened) → <b>Run Immediately</b>, turn off <b>Notify When Run</b>. Then add <b>Open URLs</b> with:</p>
        <CopyLine value={backUrl} />
        <p className="text-sm text-muted-foreground">Only scrolls you started from Pause are counted. Nothing leaves your phone.</p>
      </Step>

      <Step n={4} title="Add Pause to your Home Screen">
        <p>Open this page in Safari → <b>Share</b> → <b>Add to Home Screen</b>. It loads faster and keeps you signed in.</p>
      </Step>

      <Link to="/intercept" search={{ app: "instagram" }} className="block rounded-2xl bg-primary py-4 text-center text-lg font-semibold text-primary-foreground">
        Try a check-in now
      </Link>
    </main>
  );
}
