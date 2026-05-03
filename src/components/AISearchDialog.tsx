import { useState, useEffect } from "react";
import { Search, Sparkles, X, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Result = { id: string; title: string; reason?: string };

export function AISearchButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition glow-emerald ${className}`}
      >
        <span className="text-xs font-black tracking-wider">AI</span>
        <Search className="h-4 w-4" />
        <span>بحث ذكي في المقالات</span>
      </button>
      {open && <AISearchDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AISearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string>("");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string>("");

  // Hide the site header while this dialog is open
  useEffect(() => {
    document.body.classList.add("ai-search-open");
    return () => { document.body.classList.remove("ai-search-open"); };
  }, []);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setError("");
    setAnswer("");
    setResults([]);
    try {
      const { data: posts, error: pErr } = await supabase
        .from("posts")
        .select("id, title, category, content")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (pErr) throw pErr;
      const { data, error: fErr } = await supabase.functions.invoke("ai-search", {
        body: { query, posts: posts ?? [] },
      });
      if (fErr) throw fErr;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAnswer((data as any)?.answer ?? "");
      setResults(((data as any)?.results ?? []) as Result[]);
    } catch (err: any) {
      setError(err?.message ?? "حدث خطأ أثناء البحث");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-2xl animate-pop-in"
         style={{ zIndex: 2147483600 }} onClick={onClose}>
      <div className="glass-strong rounded-3xl w-full max-w-2xl mt-8 sm:mt-16 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-primary font-bold">
            <Sparkles className="h-4 w-4" />
            <span>بحث ذكي بالذكاء الاصطناعي</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSearch} className="p-5 space-y-3">
          <div className="glass-input flex items-center gap-2 rounded-2xl px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="اكتب سؤالك أو موضوعاً للبحث عنه..."
              className="bg-transparent flex-1 outline-none text-sm"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="font-black">AI</span>}
              بحث
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            يبحث الذكاء الاصطناعي داخل أحدث منشورات الموقع ويعرض أقربها لسؤالك.
          </p>
        </form>

        <div className="px-5 pb-5 max-h-[60vh] overflow-y-auto space-y-4">
          {error && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 text-destructive text-sm p-3">
              {error}
            </div>
          )}

          {answer && (
            <div className="glass rounded-2xl p-4 text-sm leading-relaxed">
              <div className="text-[11px] font-bold text-primary mb-1.5">✦ ملخص الذكاء الاصطناعي</div>
              {answer}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-muted-foreground">📌 منشورات ذات صلة</div>
              {results.map((r) => (
                <Link
                  key={r.id}
                  to="/post/$id"
                  params={{ id: r.id }}
                  onClick={onClose}
                  className="block glass rounded-2xl p-3.5 hover:bg-white/5 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm mb-1 truncate">{r.title}</h4>
                      {r.reason && <p className="text-[11px] text-muted-foreground line-clamp-2">{r.reason}</p>}
                    </div>
                    <ArrowLeft className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!loading && !answer && !error && results.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-6">
              اطرح سؤالاً وسيبحث الذكاء الاصطناعي في المقالات بدلاً عنك.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}