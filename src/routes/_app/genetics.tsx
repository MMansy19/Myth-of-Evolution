import { createFileRoute } from "@tanstack/react-router";
import CategoryPage from "@/components/CategoryPage";
export const Route = createFileRoute("/_app/genetics")({
  component: () => <CategoryPage category="genetics" title="علم الوراثة والجينات" color="var(--c-genetics)" emoji="🧬"
    description="شرح علم الوراثة الحديث ودلالاته على نقد التطور"/>,
  head: () => ({ meta: [{ title: "علم الوراثة · وهم التطور" }] }),
});
