import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

const PENDING_INVITE_KEY = "pause_pending_invite";

export const Route = createFileRoute("/invite/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `Join @${params.username} on Pause` },
      { name: "description", content: `@${params.username} invited you to Pause — swap scrolling for hanging out.` },
      { property: "og:title", content: `Join @${params.username} on Pause` },
      { property: "og:description", content: "Swap scrolling for hanging out with friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Invite,
});

function Invite() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    localStorage.setItem(PENDING_INVITE_KEY, username.toLowerCase());
    navigate({ to: "/friends", replace: true });
  }, [username, navigate]);
  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
      <p className="text-lg text-muted-foreground">Joining @{username} on Pause…</p>
    </main>
  );
}
