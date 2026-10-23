import { createFileRoute } from "@tanstack/react-router";

/** Google sends her back here after she allows (or refuses) calendar access. */
export const Route = createFileRoute("/api/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleCallback } = await import("@/server/google.server");
        let result = "error";
        try {
          result = await handleCallback(new URL(request.url));
        } catch {
          result = "error";
        }
        return new Response(null, { status: 302, headers: { Location: `/settings?google=${result}` } });
      },
    },
  },
});
