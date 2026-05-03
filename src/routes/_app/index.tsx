import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, BookOpen, Users, MessageCircle, ArrowLeft, ChevronRight, ChevronLeft, Search } from "lucide-react";
import { AISearchButton } from "@/components/AISearchDialog";

export const Route = createFileRoute("/_app/")({
  component: Home,
  validateSearch: z.object({ page: z.coerce.number().int().min(1).optional() }),
  head: () => ({
    meta: [
      { title: "وهم التطور — الرئيسية" },
      { name: "description", content: "منصة علمية للنقد المنهجي لنظرية التطور، مدعومة بأحدث إصدارات Gemini." },
    ],
  }),
});

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

const PAGE_SIZE = 8;

function Home() {
  const { isStaff } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ posts: 0, supervisors: 0, categories: 4 });
  const [latest, setLatest] = useState<any[]>([]);
  const page = Math.max(0, (search.page ?? 1) - 1);
  const setPage = (p: number) => navigate({ to: "/", search: { page: p === 0 ? undefined : p + 1 }, replace: false });
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const TYPED_TEXT = "تجمع عربي يضم نخبة من المختصين والمؤهلين لنقد التطور";
  const [typed, setTyped] = useState("");

  useEffect(() => {
    let i = 0;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      i++;
      setTyped(TYPED_TEXT.slice(0, i));
      if (i < TYPED_TEXT.length) {
        timeout = setTimeout(tick, 70);
      } else {
        timeout = setTimeout(() => {
          i = 0;
          setTyped("");
          timeout = setTimeout(tick, 400);
        }, 2400);
      }
    };
    timeout = setTimeout(tick, 500);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    (async () => {
      const [{ count: postsCount }, { count: supervisors }] = await Promise.all([
        supabase.from("posts").select("*", { count: "exact", head: true }),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).in("role", ["owner", "moderator"]),
      ]);
      setStats({ posts: postsCount ?? 0, supervisors: supervisors ?? 0, categories: 4 });
      setTotal(postsCount ?? 0);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false }).range(from, to);
      setLatest(data ?? []);
    })();
  }, [page]);

  // Full-site search across ALL posts (server-side ilike on title + content)
  useEffect(() => {
    const q = query.trim();
    if (!q) { setSearchResults(null); return; }
    let cancelled = false;
    setSearchBusy(true);
    const t = setTimeout(async () => {
      const like = `%${q.replace(/[%_]/g, "")}%`;
      const { data } = await supabase
        .from("posts")
        .select("*")
        .or(`title.ilike.${like},content.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) { setSearchResults(data ?? []); setSearchBusy(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] glass-strong px-5 py-8 sm:px-8 sm:py-10 text-center space-y-5">
        <div className="absolute inset-0 pointer-events-none opacity-70" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--c-critic) 18%, transparent), transparent 35%, color-mix(in oklab, var(--c-genetics) 12%, transparent) 100%)" }} />
        <div className="relative space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-[11px] font-bold tracking-wide text-primary">
            ◈ تحليل علمي ◈ نقد منهجي ◈ حقيقة موثقة ◈
          </p>
          <h1
            className="text-3xl sm:text-5xl font-black leading-tight"
            style={{
              color: "oklch(0.62 0.19 152)",
              textShadow: "0 0 22px oklch(0.62 0.19 152 / 0.55), 0 0 8px oklch(0.62 0.19 152 / 0.4)",
            }}
          >
            وهم التطور
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto min-h-[1.75rem]" aria-label={TYPED_TEXT}>
            <span>{typed}</span>
            <span className="inline-block w-[2px] h-[1em] align-[-0.15em] mx-1 bg-primary animate-pulse" />
          </p>
          <p className="text-xs text-muted-foreground/80">لا تنسونا من صالح دعائكم</p>
          <div className="mx-auto h-[2px] w-40 rounded-full" style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)", boxShadow: "0 0 18px var(--primary)" }} />
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={stats.posts} label="منشورات" icon={BookOpen} color="var(--c-evolution)" />
        <StatCard value={stats.supervisors} label="مشرفون" icon={Users} color="var(--c-genetics)" />
        <StatCard value={stats.categories} label="أقسام" icon={Sparkles} color="var(--c-creation)" />
        <StatCard value="∞" label="نقاشات AI" icon={MessageCircle} color="var(--c-critic)" />
      </section>

      {/* Two main CTAs side by side */}
      <section className="grid sm:grid-cols-2 gap-4">
        <Link
          to="/critic"
          className="glass rounded-3xl p-6 group hover:scale-[1.02] transition-all relative overflow-hidden glow-emerald"
          style={{ borderColor: "color-mix(in oklab, var(--c-critic) 40%, transparent)" }}
        >
          <div className="absolute inset-0 opacity-30 pointer-events-none"
               style={{ background: "radial-gradient(ellipse at top, var(--c-critic), transparent 70%)" }} />
          <div className="relative space-y-3 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl glass-strong grid place-items-center text-2xl">
              🧠
            </div>
            <h3 className="text-xl font-bold" style={{ color: "var(--c-critic)" }}>
              ناقد التطور الذكي
            </h3>
            <p className="text-xs text-muted-foreground">
              مدعوم بأحدث Gemini · تحقق علمي مزدوج
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold pt-1" style={{ color: "var(--c-critic)" }}>
              ابدأ النقاش <ArrowLeft className="h-3 w-3" />
            </span>
          </div>
        </Link>

        <Link
          to={isStaff ? "/critique" : "/guest-post"}
          className="glass rounded-3xl p-6 group hover:scale-[1.02] transition-all relative overflow-hidden glow-warm"
          style={{ borderColor: "color-mix(in oklab, var(--c-guest) 40%, transparent)" }}
        >
          <div className="absolute inset-0 opacity-30 pointer-events-none"
               style={{ background: "radial-gradient(ellipse at top, var(--c-guest), transparent 70%)" }} />
          <div className="relative space-y-3 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl glass-strong grid place-items-center text-2xl">
              ✍️
            </div>
            <h3 className="text-xl font-bold" style={{ color: "var(--c-guest)" }}>
              {isStaff ? "إضافة منشور" : "النشر كضيف"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isStaff ? "انطلق إلى الأقسام وأضف منشوراً مباشراً" : "شارك طرحك · يُعرض للمراجعة"}
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold pt-1" style={{ color: "var(--c-guest)" }}>
              {isStaff ? "افتح قسم النشر" : "أرسل منشورك"} <ArrowLeft className="h-3 w-3" />
            </span>
          </div>
        </Link>
      </section>

      {/* Mission card with Basmala (matches reference video) */}
      <section aria-label="آية قرآنية" className="glass-strong rounded-[2rem] p-6 sm:p-8 text-center space-y-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-60"
             style={{ background: "radial-gradient(ellipse at top, color-mix(in oklab, var(--primary) 18%, transparent), transparent 65%)" }} />
        <div className="relative space-y-4">
          <p
            translate="no"
            className="notranslate text-xl sm:text-2xl font-bold"
            style={{
              fontFamily: '"Amiri Quran", "Amiri", "Tajawal", serif',
              color: "oklch(0.78 0.14 175)",
              textShadow: "0 0 18px oklch(0.78 0.14 175 / 0.45)",
            }}
          >
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </p>
          <p
            translate="no"
            className="notranslate text-base sm:text-xl leading-loose max-w-2xl mx-auto px-1"
            style={{
              fontFamily: '"Amiri Quran", "Amiri", "Tajawal", serif',
              color: "oklch(0.82 0.12 165)",
              textShadow: "0 0 14px oklch(0.82 0.12 165 / 0.35)",
            }}
          >
            ﴿ أَمْ جَعَلُوا لِلَّهِ شُرَكَاءَ خَلَقُوا كَخَلْقِهِ فَتَشَابَهَ الْخَلْقُ عَلَيْهِمْ ۚ قُلِ اللَّهُ خَالِقُ كُلِّ شَيْءٍ وَهُوَ الْوَاحِدُ الْقَهَّارُ ﴾
          </p>
        </div>
      </section>

      {/* Latest posts */}
      <section id="posts-list" className="space-y-4 scroll-mt-20">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gradient-emerald">
            📌 آخر المنشورات
          </h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="glass-input flex items-center gap-2 rounded-full px-3 py-1.5 flex-1 sm:w-64">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث في كل المقالات…"
                className="bg-transparent outline-none text-xs flex-1"
              />
            </div>
            <AISearchButton className="!px-3 !py-1.5 !text-xs" />
          </div>
        </div>
        {(searchResults ?? latest).length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
            {query.trim() ? (searchBusy ? "جارٍ البحث…" : "لا توجد نتائج لبحثك.") : "لا توجد منشورات بعد. كن أول من يكتب!"}
          </div>
        ) : (
          <>
          <div className="space-y-3">
            {(searchResults ?? latest).map((p, idx) => (
              <article key={p.id} style={{ animationDelay: `${idx * 60}ms` }}
                className="glass rounded-2xl p-5 hover:bg-white/5 transition animate-pop-in">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: `color-mix(in oklab, ${CAT_COLOR[p.category]} 20%, transparent)`,
                      color: CAT_COLOR[p.category],
                      border: `1px solid color-mix(in oklab, ${CAT_COLOR[p.category]} 40%, transparent)`,
                    }}
                  >
                    {CAT_LABEL[p.category]}
                  </span>
                </div>
                <Link to="/post/$id" params={{ id: p.id }} className="block hover:opacity-80 transition">
                  <h3 className="font-bold text-base mb-1.5">{p.title}</h3>
                </Link>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {p.content.replace(/<[^>]+>/g, "").slice(0, 200)}...
                </p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10 text-[11px]">
                  <span className="text-muted-foreground">
                    {p.author_name ?? "—"} · {new Date(p.created_at).toLocaleDateString("ar")}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link to="/post/$id" params={{ id: p.id }} className="text-primary font-semibold hover:underline">
                      اقرأ المزيد ←
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!searchResults && <HomePagination page={page} total={total} onChange={setPage}/>}
          </>
        )}
      </section>
    </div>
  );
}

function HomePagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  const go = (p: number) => {
    onChange(Math.max(0, Math.min(pages - 1, p)));
    setTimeout(() => {
      const el = document.getElementById("posts-list");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };
  const start = Math.max(0, Math.min(page - 2, pages - 5));
  const end = Math.min(pages, start + 5);
  const nums = Array.from({ length: end - start }, (_, i) => start + i);
  return (
    <div className="flex items-center justify-center gap-1.5 pt-4 flex-wrap">
      <button onClick={()=>go(page-1)} disabled={page===0}
        className="liquid-glass h-9 w-9 rounded-full grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed">
        <ChevronRight className="h-3.5 w-3.5"/>
      </button>
      {nums.map(n => (
        <button key={n} onClick={()=>go(n)}
          className={`liquid-glass h-9 w-9 rounded-full grid place-items-center text-xs font-bold leading-none ${n === page ? "text-primary-foreground" : ""}`}
          style={n === page ? { background: "var(--primary)", color: "var(--primary-foreground)" } : undefined}>
          <span className="block">{n + 1}</span>
        </button>
      ))}
      <button onClick={()=>go(page+1)} disabled={page>=pages-1}
        className="liquid-glass h-9 w-9 rounded-full grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed">
        <ChevronLeft className="h-3.5 w-3.5"/>
      </button>
      <span className="text-[10px] text-muted-foreground ms-2 basis-full text-center">صفحة {page+1} من {pages}</span>
    </div>
  );
}

function StatCard({ value, label, icon: Icon, color }: any) {
  return (
    <div className="glass rounded-2xl p-4 text-center" style={{ borderColor: `color-mix(in oklab, ${color} 30%, transparent)` }}>
      <Icon className="h-5 w-5 mx-auto mb-1.5" style={{ color }} />
      <div className="text-2xl font-black" style={{ color }}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
