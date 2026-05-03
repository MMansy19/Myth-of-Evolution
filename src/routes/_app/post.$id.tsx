import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Trash2, ArrowRight, Pencil, Save, X, Eye, ImagePlus, ImageOff } from "lucide-react";
import { RichEditor, RichContent } from "@/components/RichEditor";
import { PostAIButton } from "@/components/PostAIChat";
import { RelatedPosts } from "@/components/RelatedPosts";

export const Route = createFileRoute("/_app/post/$id")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("posts")
      .select("id, title, content, cover_image_url, category")
      .eq("id", params.id)
      .maybeSingle();
    return data ?? null;
  },
  head: ({ loaderData: post }) => {
    if (!post) return { meta: [{ title: "المنشور · وهم التطور" }] };
    const desc = (post.content as string | null)
      ?.replace(/<[^>]+>/g, "")
      .slice(0, 160)
      .trim() ?? "";
    const title = `${post.title} · وهم التطور`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: post.title as string },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        ...(post.cover_image_url
          ? [
              { property: "og:image", content: post.cover_image_url as string },
              { name: "twitter:image", content: post.cover_image_url as string },
              { name: "twitter:card", content: "summary_large_image" },
            ]
          : []),
      ],
    };
  },
  component: PostPage,
});

const CAT: Record<string, { l: string; c: string }> = {
  critique: { l: "نقد التطور", c: "var(--c-critique)" },
  evolution_basics: { l: "أساسيات التطور", c: "var(--c-evolution)" },
  genetics: { l: "علم الوراثة", c: "var(--c-genetics)" },
  creation_marvels: { l: "إبداع الخالق", c: "var(--c-creation)" },
};

function PostPage() {
  const { id } = useParams({ from: "/_app/post/$id" });
  const { isStaff } = useAuth();
  const [p, setP] = useState<any>(null);
  const [nf, setNf] = useState(false);
  const [edit, setEdit] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eContent, setEContent] = useState("");
  const [eCover, setECover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    supabase.from("posts").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) setNf(true); else setP(data);
    });
  }, [id]);

  // Increment view count once per session/post
  useEffect(() => {
    if (!id || viewedRef.current) return;
    const key = `viewed:${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    viewedRef.current = true;
    supabase.rpc("increment_post_views", { _post_id: id });
  }, [id]);

  const del = async () => {
    if (!confirm("حذف المنشور؟")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); history.back(); }
  };

  const startEdit = () => {
    setETitle(p.title);
    setEContent(p.content);
    setECover(p.cover_image_url ?? null);
    setEdit(true);
  };

  const save = async () => {
    const plain = eContent.replace(/<[^>]+>/g, "").trim();
    if (eTitle.trim().length < 3 || plain.length < 20) { toast.error("العنوان أو المحتوى قصير"); return; }
    setBusy(true);
    const { data, error } = await supabase.from("posts")
      .update({ title: eTitle.trim(), content: eContent, cover_image_url: eCover, updated_at: new Date().toISOString() })
      .eq("id", id).select().maybeSingle();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ");
    setP(data); setEdit(false);
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
      setECover(data.publicUrl);
    } catch (err: any) { toast.error("تعذّر رفع الغلاف: " + err.message); }
  };

  if (nf) return <div className="glass rounded-2xl p-8 text-center">المنشور غير موجود.</div>;
  if (!p) return <div className="glass rounded-2xl p-8 text-center text-muted-foreground">جارٍ التحميل…</div>;

  const cat = CAT[p.category];
  return (
    <article className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-3.5 w-3.5"/> الرئيسية
        </Link>
        {isStaff && !edit && (
          <div className="flex gap-2 text-xs">
            <button onClick={startEdit} className="inline-flex items-center gap-1 glass rounded-full px-3 py-1.5 hover:bg-white/10">
              <Pencil className="h-3.5 w-3.5"/> تعديل
            </button>
            <button onClick={del} className="inline-flex items-center gap-1 glass rounded-full px-3 py-1.5 hover:bg-white/10 text-destructive">
              <Trash2 className="h-3.5 w-3.5"/> حذف
            </button>
          </div>
        )}
      </div>

      <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold"
        style={{ background: `color-mix(in oklab, ${cat.c} 20%, transparent)`, color: cat.c, border: `1px solid color-mix(in oklab, ${cat.c} 40%, transparent)` }}>
        {cat.l}
      </span>
      {edit ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={save} disabled={busy}
              className="flex-1 rounded-xl py-2.5 font-bold text-sm bg-primary text-primary-foreground inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
              <Save className="h-4 w-4"/> {busy ? "جارٍ الحفظ…" : "حفظ التغييرات"}
            </button>
            <button onClick={()=>setEdit(false)} disabled={busy}
              className="px-4 rounded-xl text-sm font-bold glass inline-flex items-center gap-1.5">
              <X className="h-4 w-4"/> إلغاء
            </button>
          </div>
          <input value={eTitle} onChange={e=>setETitle(e.target.value)} maxLength={200}
            className="glass-input rounded-xl px-3 py-2.5 text-lg font-bold w-full outline-none"/>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={()=>coverRef.current?.click()}
              className="glass-input rounded-full px-3 py-1.5 text-xs inline-flex items-center gap-1.5 hover:bg-white/10">
              <ImagePlus className="h-3.5 w-3.5"/> {eCover ? "تغيير صورة الغلاف" : "إضافة صورة غلاف"}
            </button>
            {eCover && (
              <button type="button" onClick={()=>setECover(null)}
                className="glass-input rounded-full px-3 py-1.5 text-xs inline-flex items-center gap-1.5 hover:bg-white/10 text-destructive">
                <ImageOff className="h-3.5 w-3.5"/> إزالة الغلاف
              </button>
            )}
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={onCoverFile}/>
          </div>
          {eCover && <img src={eCover} alt="غلاف" className="w-full max-h-72 object-cover rounded-2xl"/>}
          <RichEditor value={eContent} onChange={setEContent} placeholder="عدّل المحتوى…"/>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy}
              className="flex-1 rounded-xl py-2.5 font-bold text-sm bg-primary text-primary-foreground inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
              <Save className="h-4 w-4"/> {busy ? "جارٍ الحفظ…" : "حفظ التغييرات"}
            </button>
            <button onClick={()=>setEdit(false)} disabled={busy}
              className="px-4 rounded-xl text-sm font-bold glass inline-flex items-center gap-1.5">
              <X className="h-4 w-4"/> إلغاء
            </button>
          </div>
        </div>
      ) : (
        <>
          <h1 className="text-3xl font-black text-gradient-emerald">{p.title}</h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span>{p.author_name ?? "—"}</span>
            <span>·</span>
            <span>{new Date(p.created_at).toLocaleDateString("ar")}</span>
            {p.updated_at && p.updated_at !== p.created_at && (
              <><span>·</span><span>عُدِّل في {new Date(p.updated_at).toLocaleDateString("ar")}</span></>
            )}
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3"/> {p.views_count ?? 0} مشاهدة</span>
            <span className="ms-auto"><PostAIButton post={{ id: p.id, title: p.title, content: p.content }} /></span>
          </div>
          {p.cover_image_url && (
            <img src={p.cover_image_url} alt={p.title} className="w-full max-h-96 object-cover rounded-3xl"/>
          )}
          <div className="glass rounded-3xl p-5 sm:p-7">
            <RichContent html={p.content}/>
          </div>
          <RelatedPosts postId={p.id} category={p.category} title={p.title} />
        </>
      )}
    </article>
  );
}
