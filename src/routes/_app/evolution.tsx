import { createFileRoute } from "@tanstack/react-router";
import CategoryPage from "@/components/CategoryPage";
export const Route = createFileRoute("/_app/evolution")({
  component: () => <CategoryPage category="evolution_basics" title="أساسيات التطور" color="var(--c-evolution)" emoji="🌿"
    description="شرح أصول النظرية التطورية وأهم مفاهيمها لفهم النقد"/>,
  head: () => ({ meta: [{ title: "أساسيات التطور · وهم التطور" }] }),
});
