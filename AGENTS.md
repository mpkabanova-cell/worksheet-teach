<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The worksheet app (migrated Vite SPA) lives in src/App.tsx + src/screens|components|data|export and renders client-only from src/routes/index.tsx; it manages its own screens via state, so don't convert them to routes piecemeal. Why: it relies on window/localStorage everywhere.
- Server logic ported from Express lives in src/server-lib (plain JS) and is exposed via server routes /api/chat, /api/extract-context, /health, calling OpenRouter with OPENAI_API_KEY. Why: keeps the original AI provider and API contract the client already uses.
- PDF reading sends the whole file to a multimodal model instead of pdf-parse/canvas. Why: the server runtime cannot render PDF pages.
