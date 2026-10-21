import { createFileRoute } from "@tanstack/react-router";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = await import("@/server-lib/openrouterEnv.js");
        const apiKey = env.resolveApiKey();
        const baseUrl = env.resolveBaseUrl();
        const model = process.env.OPENAI_MODEL || env.DEFAULT_CHAT_MODEL;
        if (!apiKey) return json(503, { error: "NO_API_KEY", message: "OPENAI_API_KEY не задан на сервере" });

        let payload: { messages?: unknown; temperature?: unknown; response_format?: unknown } = {};
        try {
          payload = await request.json();
        } catch {
          /* empty */
        }
        const { messages, temperature, response_format } = payload;
        if (!Array.isArray(messages) || messages.length === 0)
          return json(400, { error: "BAD_REQUEST", message: "Нужен messages[]" });

        const body: Record<string, unknown> = {
          model,
          temperature: typeof temperature === "number" ? temperature : 0.5,
          messages,
        };
        const rf = env.resolveChatResponseFormat(model, response_format);
        if (rf) body.response_format = rf;

        try {
          const upstream = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "HTTP-Referer": process.env.APP_URL || "https://lovable.app",
              "X-Title": "Worksheet Constructor",
            },
            body: JSON.stringify(body),
          });
          const text = await upstream.text();
          if (!upstream.ok) {
            let message = text.slice(0, 500);
            try {
              const p = JSON.parse(text);
              if (p.error && typeof p.error === "object" && p.error.message) message = p.error.message;
              else if (typeof p.message === "string") message = p.message;
              else if (typeof p.error === "string") message = p.error;
            } catch {
              /* raw */
            }
            if (!message.trim()) message = `Upstream HTTP ${upstream.status}`;
            if (upstream.status === 402)
              return json(402, {
                error: "INSUFFICIENT_CREDITS",
                message: "На OpenRouter недостаточно кредитов. Пополните баланс на openrouter.ai и повторите запрос.",
                detail: message.slice(0, 500),
              });
            if (env.isUpstreamAuthFailure(upstream.status))
              return json(upstream.status, {
                error: "AUTH_ERROR",
                message: env.authErrorMessageForUpstream(message),
                detail: message.slice(0, 500),
              });
            return json(upstream.status, { error: "UPSTREAM_ERROR", message });
          }
          return new Response(text, { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (err) {
          return json(502, { error: "PROXY_ERROR", message: err instanceof Error ? err.message : "Ошибка прокси" });
        }
      },
    },
  },
});
