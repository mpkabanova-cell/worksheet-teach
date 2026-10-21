import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import "../styles/global.css";

const App = lazy(() => import("../App"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Рабочие листы — Ассистент Преподавателя" },
      { name: "description", content: "Создавайте рабочие листы с заданиями с помощью ИИ, редактируйте и печатайте." },
      { property: "og:title", content: "Рабочие листы — Ассистент Преподавателя" },
      { property: "og:description", content: "Конструктор рабочих листов с генерацией заданий ИИ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  );
}
