import { createFileRoute } from "@tanstack/react-router";
import CategoryPage from "@/components/CategoryPage";
export const Route = createFileRoute("/_app/creation")({
  component: () => <CategoryPage category="creation_marvels" title="إبداع الخالق" color="var(--c-creation)" emoji="✨"
    description="أمثلة من بدائع الخلق في الكون والأحياء"/>,
  head: () => ({ meta: [{ title: "إبداع الخالق · وهم التطور" }] }),
});
