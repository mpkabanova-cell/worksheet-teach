import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => {
        const env = await import("@/server-lib/openrouterEnv.js");
        const { getVisionConfig } = await import("@/server-lib/visionOcr.js");
        const key = env.resolveApiKey();
        return new Response(
          JSON.stringify({
            ok: true,
            hasKey: Boolean(key),
            keyPrefixOk: Boolean(key) && env.isLikelyOpenRouterKey(key),
            model: process.env.OPENAI_MODEL || env.DEFAULT_CHAT_MODEL,
            ocrModel: getVisionConfig().model,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
