import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Eye } from "lucide-react";

const CAT_LABEL: Record<string, string> = {
  critique: "نقد التطور",
  evolution_basics: "أساسيات التطور",
  genetics: "علم الوراثة",
  creation_marvels: "إبداع الخالق",
};
const CAT_COLOR: Record<string, string> = {
  critique: "var(--c-critique)",
  evolution_basics: "var(--c-evolution)",
  genetics: "var(--c-genetics)",
  creation_marvels: "var(--c-creation)",
};

export function RelatedPosts({ postId, category, title }: { postId: string; category: string; title: string }) {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      // simple relevance: same category + word overlap on title
      const { data } = await supabase.from("posts")
        .select("id,title,category,created_at,views_count,author_name,content")
        .eq("category", category as any).neq("id", postId)
        .order("created_at", { ascending: false }).limit(20);
      const words = title.split(/\s+/).filter(w => w.length > 2);
      const scored = (data ?? []).map((p) => ({
        p,
        score: words.reduce((s, w) => s + (p.title.includes(w) ? 2 : 0) + (p.content?.includes(w) ? 1 : 0), 0),
      }));
      scored.sort((a, b) => b.score - a.score || (b.p.views_count ?? 0) - (a.p.views_count ?? 0));
      setItems(scored.slice(0, 4).map(s => s.p));
    })();
  }, [postId, category, title]);

  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-base font-bold flex items-center gap-2">🔗 مقالات ذات صلة</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((p) => (
          <Link key={p.id} to="/post/$id" params={{ id: p.id }}
            className="block glass rounded-2xl p-4 hover:bg-white/5 transition"
            style={{ borderColor: `color-mix(in oklab, ${CAT_COLOR[p.category]} 25%, transparent)` }}>
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mb-1.5"
              style={{ background: `color-mix(in oklab, ${CAT_COLOR[p.category]} 20%, transparent)`, color: CAT_COLOR[p.category] }}>
              {CAT_LABEL[p.category]}
            </span>
            <h4 className="font-bold text-sm mb-1 line-clamp-2">{p.title}</h4>
            <div className="text-[10px] text-muted-foreground flex items-center gap-2">
              <span>{p.author_name ?? "—"}</span>
              <span className="inline-flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" /> {p.views_count ?? 0}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}