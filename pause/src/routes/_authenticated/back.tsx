import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { finishPendingScroll } from "@/lib/personalStore";

/**
 * Opened by the Shortcuts automation "When Instagram is closed → Open URL …/back?app=instagram".
 * Closes the pending scroll session so the personal model learns how long you actually scrolled.
 */
export const Route = createFileRoute("/_authenticated/back")({
  validateSearch: (s: Record<string, unknown>): { app?: string } => (
    typeof s["app"] === "string" ? { app: s["app"] as string } : {}
  ),
  head: () => ({
    meta: [
      { title: "Welcome back — Pause" },
      { name: "description", content: "How your scroll went compared with what you planned." },
      { property: "og:title", content: "Welcome back — Pause" },
      { property: "og:description", content: "How your scroll went compared with what you planned." },
    ],
  }),
  component: Back,
});

type Result = { chosen: number; actual: number } | null;

function Back() {
  const [result, setResult] = useState<Result | undefined>(undefined);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return; // StrictMode runs effects twice; only close the session once
    done.current = true;
    setResult(finishPendingScroll());
  }, []);

  if (result === undefined) return <main className="min-h-[60dvh]" />;

  const over = result ? result.actual > result.chosen : false;
  return (
    <main className="flex min-h-[70dvh] flex-col justify-center space-y-6 px-5 pt-6">
      <div className="text-center">
        <p className="text-5xl">👋</p>
        <h1 className="mt-3 text-3xl font-bold">Welcome back</h1>
      </div>

      {result && (
        <section className="rounded-3xl bg-card p-5 text-center shadow-sm">
          <p className="text-lg">
            You planned <b>{result.chosen} min</b>, you scrolled <b>{result.actual} min</b>.
          </p>
          <p className="mt-2 text-muted-foreground">
            {over ? "A bit over, no stress, Pause will learn from it" : "Nice, right on plan 🎯"}
          </p>
        </section>
      )}

      <div className="space-y-3">
        <Link to="/" className="block rounded-2xl bg-primary py-4 text-center text-lg font-semibold text-primary-foreground active:opacity-90">
          Home
        </Link>
        {result && (
          <Link to="/intercept" search={{ app: "instagram" }} className="block rounded-2xl bg-card py-4 text-center text-lg font-semibold shadow-sm active:bg-accent">
            See who's free
          </Link>
        )}
      </div>
    </main>
  );
}
