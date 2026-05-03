import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PenLine, Send, CheckCircle2, ShieldCheck, Loader2, AlertTriangle, XCircle } from "lucide-react";
import { RichEditor } from "@/components/RichEditor";
import { AiReport } from "@/components/AiReport";

export const Route = createFileRoute("/_app/guest-post")({
  component: GuestPost,
  head: () => ({ meta: [{ title: "النشر كضيف · وهم التطور" }] }),
});

const schema = z.object({
  guest_name: z.string().trim().min(2, "الاسم قصير").max(100),
  guest_email: z.string().trim().email("بريد غير صالح").max(255).optional().or(z.literal("")),
  title: z.string().trim().min(3, "العنوان قصير").max(200),
  content: z.string().trim().min(20, "المحتوى قصير").max(10000),
  category: z.enum(["critique", "evolution_basics", "genetics", "creation_marvels"]),
});

const CATEGORIES = [
  { v: "critique", l: "نقد التطور", c: "var(--c-critique)" },
  { v: "evolution_basics", l: "أساسيات التطور", c: "var(--c-evolution)" },
  { v: "genetics", l: "علم الوراثة", c: "var(--c-genetics)" },
  { v: "creation_marvels", l: "إبداع الخالق", c: "var(--c-creation)" },
] as const;

function GuestPost() {
  const { isStaff } = useAuth();
  const [form, setForm] = useState({ guest_name: "", guest_email: "", title: "", content: "", category: "critique" as const });
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | { report: string; verdict: string; refs: { n: number; id: string; title: string }[] }>(null);

  if (isStaff) {
    return (
      <div className="max-w-2xl mx-auto space-y-5 text-center">
        <div className="glass rounded-3xl p-8 space-y-4">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-semibold" style={{ color: "var(--c-guest)" }}>
            <PenLine className="h-3.5 w-3.5" /> إضافة منشور
          </div>
          <h1 className="text-3xl font-black text-gradient-emerald">هذه الصفحة مخصّصة للضيوف فقط</h1>
          <p className="text-sm text-muted-foreground">بما أنك مشرف، أضف المنشورات مباشرةً من صفحات الأقسام.</p>
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <Link to="/critique" className="glass-input rounded-2xl px-4 py-3 text-sm font-bold hover:bg-white/10 transition">نقد التطور</Link>
            <Link to="/evolution" className="glass-input rounded-2xl px-4 py-3 text-sm font-bold hover:bg-white/10 transition">أساسيات التطور</Link>
            <Link to="/genetics" className="glass-input rounded-2xl px-4 py-3 text-sm font-bold hover:bg-white/10 transition">علم الوراثة</Link>
            <Link to="/creation" className="glass-input rounded-2xl px-4 py-3 text-sm font-bold hover:bg-white/10 transition">إبداع الخالق</Link>
          </div>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const plain = form.content.replace(/<[^>]+>/g, "").trim();
    const finalForm = anonymous
      ? { ...form, guest_name: "مجهول", guest_email: "anonymous@example.com" }
      : form;
    const parsed = schema.safeParse({ ...finalForm, content: plain.length >= 20 ? form.content : "" });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);

    // 1) AI review first
    let report = ""; let verdict = "REVISE"; let refs: any[] = [];
    try {
      const { data, error: aiErr } = await supabase.functions.invoke("guest-post-review", {
        body: { title: parsed.data.title, content: parsed.data.content, category: parsed.data.category },
      });
      if (aiErr) throw aiErr;
      report = data?.report ?? ""; verdict = data?.verdict ?? "REVISE"; refs = data?.refs ?? [];
    } catch (err: any) {
      toast.error("تعذّرت مراجعة الذكاء الاصطناعي: " + (err?.message ?? "خطأ"));
      setLoading(false); return;
    }

    // 2) Save submission with the AI report attached
    const { error } = await supabase.from("guest_posts").insert({
      ...parsed.data,
      guest_email: parsed.data.guest_email || "anonymous@example.com",
      ai_report: report,
      ai_verdict: verdict,
      ai_reviewed_at: new Date().toISOString(),
      ai_refs: refs,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const ring = document.createElement("div"); ring.className = "confetti-ring";
    document.body.appendChild(ring); setTimeout(() => ring.remove(), 900);
    setDone({ report, verdict, refs });
  };

  if (done) {
    const v = done.verdict;
    const tone = v === "APPROVE"
      ? { c: "var(--c-evolution)", icon: <CheckCircle2 className="h-12 w-12 mx-auto"/>, t: "قبِله المحكّم الذكي" }
      : v === "REJECT"
      ? { c: "oklch(0.7 0.2 25)", icon: <XCircle className="h-12 w-12 mx-auto"/>, t: "رفضه المحكّم الذكي" }
      : { c: "var(--c-guest)", icon: <AlertTriangle className="h-12 w-12 mx-auto"/>, t: "يحتاج مراجعة" };
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center glass rounded-3xl p-6 space-y-2 glow-warm">
          <div style={{ color: tone.c }}>{tone.icon}</div>
          <h2 className="text-2xl font-bold">تم إرسال منشورك</h2>
          <p className="text-xs text-muted-foreground">سيتأكّد المشرفون من القرار قبل النشر النهائي.</p>
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-bold" style={{ color: tone.c }}>
            <ShieldCheck className="h-3.5 w-3.5"/> مراجعة الذكاء الاصطناعي: {tone.t}
          </div>
        </div>
        <AiReport report={done.report} refs={done.refs}/>
        <div className="text-center">
          <Link to="/" className="inline-block px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold">العودة للرئيسية</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 px-0">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-semibold" style={{ color: "var(--c-guest)" }}>
          <PenLine className="h-3.5 w-3.5" /> النشر كضيف · مراجعة AI ثم اعتماد المشرفين
        </div>
        <h1 className="text-3xl font-black text-gradient-emerald">شارك طرحك</h1>
        <p className="text-xs text-muted-foreground">يمكنك إضافة صور وفيديوهات من جهازك وتنسيق النص بحرية</p>
      </div>

      <form onSubmit={submit} className="glass rounded-3xl p-2 sm:p-4 space-y-3">
        {/* Submit button (top) */}
        <button type="submit" disabled={loading}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-bold text-sm hover:opacity-90 transition glow-warm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: "var(--c-guest)", color: "oklch(0.15 0.05 50)" }}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin"/> جارٍ مراجعة AI…</> : <><Send className="h-4 w-4" /> إرسال ومراجعة بالذكاء الاصطناعي</>}
        </button>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={anonymous} onChange={e=>setAnonymous(e.target.checked)}
            className="accent-primary w-4 h-4"/>
          <span>النشر كمجهول (دون اسم أو بريد)</span>
        </label>
        {!anonymous && (
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="glass-input rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="اسمك أو اسم مستعار" value={form.guest_name} onChange={e=>setForm({...form, guest_name: e.target.value})}/>
            <input type="email" className="glass-input rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="بريدك (اختياري — للتواصل فقط، لن يُنشر)" value={form.guest_email} onChange={e=>setForm({...form, guest_email: e.target.value})}/>
          </div>
        )}
        <select value={form.category} onChange={e=>setForm({...form, category: e.target.value as any})}
          className="glass-input rounded-xl px-3 py-2.5 text-sm w-full outline-none">
          {CATEGORIES.map(c => <option key={c.v} value={c.v} className="bg-background">{c.l}</option>)}
        </select>
        <input className="glass-input rounded-xl px-3 py-2.5 text-sm w-full outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="عنوان المنشور" value={form.title} onChange={e=>setForm({...form, title: e.target.value})}/>
        <RichEditor value={form.content} onChange={(html)=>setForm({...form, content: html})}
          placeholder="اكتب محتوى منشورك… يمكنك إضافة صور وفيديوهات من جهازك وروابط وتنسيق النص."/>
        <button type="submit" disabled={loading}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-bold text-sm hover:opacity-90 transition glow-warm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: "var(--c-guest)", color: "oklch(0.15 0.05 50)" }}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin"/> جارٍ مراجعة AI…</> : <><Send className="h-4 w-4" /> إرسال ومراجعة بالذكاء الاصطناعي</>}
        </button>
      </form>
    </div>
  );
}
