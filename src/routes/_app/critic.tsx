import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Brain, Send, Loader2, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/critic")({
  component: CriticPage,
  head: () => ({
    meta: [
      { title: "ناقد التطور الذكي · وهم التطور" },
      { name: "description", content: "أداة ذكاء اصطناعي متخصصة لنقد التطور علمياً، مدعومة بأحدث Gemini." },
    ],
  }),
});

type Msg = { role: "user" | "assistant"; content: string; verification?: string; verifying?: boolean };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-critic`;

function CriticPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    let acc = "";
    const upsert = (chunk: string) => {
      acc += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
        }
        return [...prev, { role: "assistant", content: acc }];
      });
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      if (resp.status === 429) { toast.error("تم تجاوز الحد. حاول لاحقاً."); setLoading(false); return; }
      if (resp.status === 402) { toast.error("نفد رصيد الذكاء الاصطناعي."); setLoading(false); return; }
      if (!resp.ok || !resp.body) throw new Error("stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: rdone, value } = await reader.read();
        if (rdone) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || !line.trim()) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buf = line + "\n" + buf; break;
          }
        }
      }
    } catch (e: any) {
      toast.error("فشل الاتصال بالذكاء الاصطناعي");
    } finally { setLoading(false); }

    // مراجعة ذاتية تلقائية
    if (acc.trim()) {
      setMessages((prev) => prev.map((m, i) =>
        i === prev.length - 1 && m.role === "assistant" ? { ...m, verifying: true } : m
      ));
      try {
        const vResp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ verify: acc }),
        });
        if (vResp.ok) {
          const vData = await vResp.json();
          const verification = (vData?.verification ?? "").trim();
          setMessages((prev) => prev.map((m, i) =>
            i === prev.length - 1 && m.role === "assistant"
              ? { ...m, verifying: false, verification: verification || "✅ تمت المراجعة — ولا توجد تعقيبات" }
              : m
          ));
        } else {
          setMessages((prev) => prev.map((m, i) =>
            i === prev.length - 1 && m.role === "assistant" ? { ...m, verifying: false } : m
          ));
        }
      } catch {
        setMessages((prev) => prev.map((m, i) =>
          i === prev.length - 1 && m.role === "assistant" ? { ...m, verifying: false } : m
        ));
      }
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-semibold" style={{ color: "var(--c-critic)" }}>
          <Brain className="h-3.5 w-3.5" /> مدعوم بأحدث Gemini · تحقق علمي تلقائي
        </div>
        <h1 className="text-3xl font-black text-gradient-emerald">ناقد التطور الذكي</h1>
        <p className="text-xs text-muted-foreground max-w-lg mx-auto">
          اطرح ادعاء تطورياً وسيُفنّده الذكاء بحدّة علمية، ثم يُراجع نفسه تلقائياً للتحقق من دقته
        </p>
      </div>

      <div ref={scrollRef} className="glass rounded-3xl p-4 sm:p-6 min-h-[400px] max-h-[60vh] overflow-y-auto space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">
            <Brain className="h-10 w-10 mx-auto mb-3 opacity-50" style={{ color: "var(--c-critic)" }}/>
            ابدأ بسؤال مثل: <em>"هل تؤدي الطفرات للتطور؟"</em>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 ${m.role === "user" ? "glass-input" : "glass-strong"}`}
                 style={m.role === "assistant" ? { borderColor: "color-mix(in oklab, var(--c-critic) 40%, transparent)" } : undefined}>
              {m.role === "assistant" && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold mb-2" style={{ color: "var(--c-critic)" }}>
                  🧠 ناقد التطور
                </div>
              )}
              <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
              {m.role === "assistant" && (m.verifying || m.verification) && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  {m.verifying ? (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      مراجع ناقد ثانٍ يدقق الرد…
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold mb-1.5" style={{ color: "var(--c-critic)" }}>
                        <ShieldCheck className="h-3 w-3" /> مراجعة الناقد الثاني
                      </div>
                      <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed opacity-90">
                        <ReactMarkdown>{m.verification!}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-end">
            <div className="glass-strong rounded-2xl p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> جارٍ التفكير…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={(e)=>{e.preventDefault(); send();}} className="glass-input rounded-2xl p-2 flex gap-2">
        <input
          value={input} onChange={(e)=>setInput(e.target.value)} disabled={loading}
          placeholder="اطرح سؤالك أو ادعاءً تطورياً للنقد…"
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        />
        <button type="submit" disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-40 hover:opacity-90 flex items-center gap-1.5">
          <Send className="h-3.5 w-3.5" /> إرسال
        </button>
      </form>
    </div>
  );
}
