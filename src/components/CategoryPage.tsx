import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, X, ImagePlus, ImageOff, ChevronRight, ChevronLeft, Sparkles, Loader2 } from "lucide-react";
import { RichEditor } from "@/components/RichEditor";

type Cat = "critique" | "evolution_basics" | "genetics" | "creation_marvels";
const PAGE_SIZE = 10;

export default function CategoryPage({ category, title, color, emoji, description }:
  { category: Cat; title: string; color: string; emoji: string; description: string }) {
  const { isStaff, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialPage = (() => {
    const raw = (location.search as any)?.page;
    const n = typeof raw === "number" ? raw : parseInt(String(raw ?? "1"), 10);
    return isNaN(n) || n < 1 ? 0 : n - 1;
  })();
  const [posts, setPosts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [t, setT] = useState(""); const [c, setC] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [titleBusy, setTitleBusy] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const [page, setPageState] = useState(initialPage);
  const [total, setTotal] = useState(0);

  const setPage = (p: number) => {
    setPageState(p);
    navigate({
      to: location.pathname,
      search: (prev: any) => ({ ...prev, page: p === 0 ? undefined : p + 1 }),
      replace: false,
    } as any);
  };

  const load = async () => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await supabase
      .from("posts").select("*", { count: "exact" })
      .eq("category", category).order("created_at", { ascending: false })
      .range(from, to);
    setPosts(data ?? []);
    setTotal(count ?? 0);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [category, page]);
  // NOTE: do not auto-reset the page when navigating back — keep the URL's ?page=N intact.

  // Preload display_name from profile (so the email is never used as fallback name)
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setAuthorName(data?.display_name ?? ""));
  }, [user]);

  const suggestTitle = async () => {
    const plain = c.replace(/<[^>]+>/g, "").trim();
    if (plain.length < 30) { toast.error("اكتب محتوى أطول لاقتراح العنوان"); return; }
    setTitleBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-title", { body: { content: c, category } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const title = (data as any)?.title?.trim();
      if (!title) throw new Error("لم يُرجع عنوان");
      setT(title);
      toast.success("تم اقتراح العنوان");
    } catch (err: any) { toast.error("تعذّر الاقتراح: " + (err.message ?? err)); }
    finally { setTitleBusy(false); }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const plain = c.replace(/<[^>]+>/g, "").trim();
    if (t.trim().length < 3 || plain.length < 20) { toast.error("العنوان والمحتوى قصيران"); return; }
    const finalName = authorName.trim() || "مشرف";
    setBusy(true);
    // Persist chosen name to the profile so it auto-fills next time
    if (authorName.trim()) {
      await supabase.from("profiles").update({ display_name: authorName.trim() }).eq("id", user!.id);
    }
    const { error } = await supabase.from("posts").insert({
      title: t.trim(), content: c.trim(), category, cover_image_url: cover,
      author_id: user!.id, author_name: finalName,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم النشر");
    const ring = document.createElement("div"); ring.className = "confetti-ring";
    document.body.appendChild(ring); setTimeout(() => ring.remove(), 900);
    setT(""); setC(""); setCover(null); setOpen(false); load();
  };

  const onCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast.error("حجم الصورة الأقصى 8MB"); return; }
    try {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `covers/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("post-media").upload(path, f, { contentType: f.type });
      if (error) throw error;
      const { data } = supabase.storage.from("post-media").getPublicUrl(path);
      setCover(data.publicUrl);
    } catch (err: any) { toast.error("تعذّر رفع الغلاف: " + err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="text-5xl">{emoji}</div>
        <h1 className="text-3xl font-black" style={{ color }}>{title}</h1>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">{description}</p>
      </div>

      {isStaff && (
        <div className="flex justify-center">
          <button onClick={()=>setOpen(!open)} className="glass rounded-full px-4 py-2 text-xs font-bold flex items-center gap-1.5 hover:bg-white/10"
            style={{ color }}>
            {open ? <><X className="h-3.5 w-3.5"/> إلغاء</> : <><Plus className="h-3.5 w-3.5"/> منشور جديد</>}
          </button>
        </div>
      )}

      {open && (
        <form onSubmit={create} className="glass rounded-3xl p-2 sm:p-4 space-y-3">
          {/* Publish button (top) */}
          <button type="submit" disabled={busy} className="w-full rounded-xl py-2.5 font-bold text-sm disabled:opacity-50"
            style={{ background: color, color: "oklch(0.15 0.05 200)" }}>
            {busy ? "جارٍ النشر…" : "نشر"}
          </button>
          <div className="flex gap-2">
            <input className="glass-input rounded-xl px-3 py-2.5 text-sm flex-1 outline-none" placeholder="العنوان"
              value={t} onChange={e=>setT(e.target.value)} maxLength={200}/>
            <button type="button" onClick={suggestTitle} disabled={titleBusy}
              title="تحديد العنوان الذكي بالذكاء الاصطناعي"
              className="glass-input rounded-xl px-3 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-white/10 disabled:opacity-50 shrink-0"
              style={{ color }}>
              {titleBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Sparkles className="h-3.5 w-3.5"/>}
              <span className="hidden sm:inline">تحديد العنوان الذكي</span>
            </button>
          </div>
          <input className="glass-input rounded-xl px-3 py-2.5 text-sm w-full outline-none"
            placeholder="اسم الناشر الظاهر للقراء (لن يُعرض بريدك)" value={authorName} onChange={e=>setAuthorName(e.target.value)} maxLength={60}/>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={()=>coverRef.current?.click()}
              className="glass-input rounded-full px-3 py-1.5 text-xs inline-flex items-center gap-1.5 hover:bg-white/10">
              <ImagePlus className="h-3.5 w-3.5"/> {cover ? "تغيير صورة الغلاف" : "إضافة صورة غلاف (اختياري)"}
            </button>
            {cover && (
              <button type="button" onClick={()=>setCover(null)}
                className="glass-input rounded-full px-3 py-1.5 text-xs inline-flex items-center gap-1.5 hover:bg-white/10 text-destructive">
                <ImageOff className="h-3.5 w-3.5"/> إزالة الغلاف
              </button>
            )}
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={onCoverFile}/>
          </div>
          {cover && <img src={cover} alt="غلاف" className="w-full max-h-60 object-cover rounded-2xl"/>}
          <RichEditor value={c} onChange={setC} placeholder="اكتب المحتوى هنا… يمكنك إضافة صور وفيديوهات وروابط وتنسيق النص"/>
          <button type="submit" disabled={busy} className="w-full rounded-xl py-2.5 font-bold text-sm disabled:opacity-50"
            style={{ background: color, color: "oklch(0.15 0.05 200)" }}>
            {busy ? "جارٍ النشر…" : "نشر"}
          </button>
        </form>
      )}

      <div id="posts-list" className="scroll-mt-20"/>
      {posts.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">لا توجد منشورات في هذا القسم بعد.</div>
      ) : (
        <>
        <div className="space-y-3">
          {posts.map((p, idx) => (
            <article key={p.id}
              className="glass rounded-2xl p-5 hover:bg-white/5 transition animate-pop-in"
              style={{ animationDelay: `${idx * 60}ms`, borderColor: `color-mix(in oklab, ${color} 25%, transparent)` }}>
              {p.cover_image_url && (
                <img src={p.cover_image_url} alt={p.title} className="w-full max-h-48 object-cover rounded-xl mb-3"/>
              )}
              <Link to="/post/$id" params={{ id: p.id }} className="block hover:opacity-80 transition">
                <h3 className="font-bold mb-1.5">{p.title}</h3>
              </Link>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {p.content.replace(/<[^>]+>/g, " ").slice(0, 200)}…
              </p>
              <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
                <div className="text-[10px] text-muted-foreground">
                  {p.author_name ?? "—"} · {new Date(p.created_at).toLocaleDateString("ar")}
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/post/$id" params={{ id: p.id }} className="text-primary text-xs font-semibold hover:underline">
                    اقرأ ←
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
        <Pagination page={page} total={total} onChange={setPage}/>
        </>
      )}
    </div>
  );
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const go = (p: number) => {
    onChange(Math.max(0, Math.min(pages - 1, p)));
    setTimeout(() => {
      const el = document.getElementById("posts-list");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };
  // Build window of up to 5 numbered buttons around current
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
          className="liquid-glass h-9 w-9 rounded-full grid place-items-center text-xs font-bold leading-none"
          style={n === page ? { background: "var(--primary)", color: "var(--primary-foreground)" } : undefined}>
          <span className="block">{n + 1}</span>
        </button>
      ))}
      <button onClick={()=>go(page+1)} disabled={page>=pages-1}
        className="liquid-glass h-9 w-9 rounded-full grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed">
        <ChevronLeft className="h-3.5 w-3.5"/>
      </button>
      <span className="text-[10px] text-muted-foreground basis-full text-center">صفحة {page+1} من {pages}</span>
    </div>
  );
}
