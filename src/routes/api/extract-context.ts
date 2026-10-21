import { createFileRoute } from "@tanstack/react-router";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/extract-context")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { extractContextFromFile, ContextExtractError, MAX_UPLOAD_BYTES } = await import(
          "@/server-lib/extractContext.js"
        );
        try {
          const form = await request.formData();
          let file: File | null = null;
          for (const v of form.values()) {
            if (typeof v !== "string") {
              file = v as File;
              break;
            }
          }
          if (!file) return json(400, { error: "NO_FILE", message: "Файл не передан" });
          if (file.size > MAX_UPLOAD_BYTES)
            return json(413, { error: "TOO_LARGE", message: "Файл больше 10 МБ" });
          const buffer = new Uint8Array(await file.arrayBuffer());
          const result = await extractContextFromFile(buffer as unknown as Buffer, file.name, file.type);
          return json(200, result);
        } catch (err) {
          if (err instanceof ContextExtractError) {
            const e = err as InstanceType<typeof ContextExtractError> & { code: string; status: number };
            return json(e.status, { error: e.code, message: e.message });
          }
          const message = err instanceof Error ? err.message : "Ошибка извлечения контекста";
          console.error("[api/extract-context]", message);
          return json(502, { error: "EXTRACT_ERROR", message });
        }
      },
    },
  },
});
