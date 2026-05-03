import { createFileRoute } from "@tanstack/react-router";
import CategoryPage from "@/components/CategoryPage";
export const Route = createFileRoute("/_app/critique")({
  component: () => <CategoryPage category="critique" title="نقد التطور" color="var(--c-critique)" emoji="🔬"
    description="تفنيد الادعاءات التطورية بالأدلة العلمية والمنطق الصارم"/>,
  head: () => ({ meta: [{ title: "نقد التطور · وهم التطور" }] }),
});
