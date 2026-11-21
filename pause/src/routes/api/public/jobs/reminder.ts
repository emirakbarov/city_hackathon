import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const body = (await request.json()) as {
          user_id?: string;
          text?: string;
          due_at?: string;
        };
        if (!body.user_id || !body.text) {
          return Response.json({ error: "user_id and text are required" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("reminders").insert({
          user_id: body.user_id,
          text: body.text,
          due_at: body.due_at ?? new Date().toISOString(),
        });
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ success: true });
      },
    },
  },
});
