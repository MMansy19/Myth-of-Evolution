import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `أنت "ناقد التطور الذكي" في موقع "وهم التطور" — عالم متخصص في الأحياء والوراثة وفلسفة العلوم، مهمتك نقد نظرية التطور الدارويني نقداً علمياً رصيناً.

القواعد الصارمة:
1) **اعتمد بشكل أساسي وحصري على "مقالات الموقع ذات الصلة" المرفقة كمصدر للإجابة.** استخرج الحجج والأمثلة والاقتباسات من هذه المقالات أولاً.
2) إذا لم تجد إجابة كافية في مقالات الموقع، قل صراحةً: "لم أجد هذا الموضوع في مقالات الموقع، وما يلي إضافة من معرفتي العامة:" قبل أي إضافة من خارج الموقع.
3) إن طُلب التلخيص: قدّم ملخصاً منظّماً للمقال (5-8 نقاط)، مع إبراز الحجج النقدية ضد التطور.
4) إن طُلب النقاش: ناقش الموضوع ضمن سياق المقال، وقَوِّ النقد العلمي للتطور.
5) استشهد من مقالات الموقع بصيغة [مقال: العنوان] عند الاقتباس.
6) لا تدافع عن التطور — أنت ناقد له بأمانة علمية.
7) استخدم Markdown والعربية الفصحى.
8) لا تذكر أبداً أنك ذكاء اصطناعي إلا إن سُئلت مباشرة.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { article, mode, messages } = await req.json();
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!GEMINI_KEY && !GROQ_KEY && !LOVABLE_KEY) throw new Error("No AI key configured");
    if (!article?.title || !article?.content) {
      return new Response(JSON.stringify({ error: "article required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const plain = String(article.content).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000);
    const articleContext = `عنوان المقال: ${article.title}\n\nنص المقال:\n${plain}`;

    // Fetch related site articles for RAG context (excluding current)
    let relatedContext = "";
    try {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      const { data: related } = await sb
        .from("posts")
        .select("title, content")
        .neq("id", article.id ?? "")
        .order("created_at", { ascending: false })
        .limit(40);
      if (related && related.length) {
        const snippets = related.map((p: any) =>
          `### ${p.title}\n${String(p.content).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)}`
        ).join("\n\n");
        relatedContext = `\n\n--- مقالات الموقع ذات الصلة (استخدمها كمصادر واستشهد منها) ---\n${snippets}`;
      }
    } catch (_e) { /* non-fatal */ }

    const baseMessages: any[] = [
      { role: "system", content: SYSTEM },
      { role: "user", content: articleContext + relatedContext },
    ];

    if (mode === "summarize") {
      baseMessages.push({ role: "user", content: "لخّص المقال السابق في نقاط واضحة." });
    } else if (Array.isArray(messages)) {
      for (const m of messages) {
        if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          baseMessages.push({ role: m.role, content: m.content.slice(0, 4000) });
        }
      }
    }

    // Helper: stream from Groq using OpenAI-compatible chat completions
    const streamFromGroq = async () => {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: baseMessages,
          stream: true,
        }),
      });
      if (!r.ok || !r.body) {
        const t = await r.text();
        throw new Error(`Groq error: ${t}`);
      }
      return new Response(r.body, { headers: { ...cors, "Content-Type": "text/event-stream" } });
    };

    // Prefer Gemini direct API if key is available, fallback to Groq, then Lovable.
    if (GEMINI_KEY) {
      // Convert OpenAI-style messages to Gemini format
      const sys = baseMessages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
      const contents = baseMessages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`;
      const gr = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: sys }] },
        }),
      });
      if (!gr.ok || !gr.body) {
        // Gemini failed (rate limit / quota) → try Groq fallback
        if (GROQ_KEY) {
          try { return await streamFromGroq(); } catch (e) {
            return new Response(JSON.stringify({ error: `Gemini & Groq failed: ${(e as Error).message}` }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
          }
        }
        const t = await gr.text();
        return new Response(JSON.stringify({ error: `Gemini error: ${t}` }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }
      // Convert Gemini SSE to OpenAI-style SSE expected by frontend
      const stream = new ReadableStream({
        async start(controller) {
          const reader = gr.body!.getReader();
          const dec = new TextDecoder();
          const enc = new TextEncoder();
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let nl: number;
            while ((nl = buf.indexOf("\n")) !== -1) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!line.startsWith("data: ")) continue;
              const j = line.slice(6).trim();
              if (!j) continue;
              try {
                const p = JSON.parse(j);
                const text = p?.candidates?.[0]?.content?.parts?.map((pt: any) => pt.text).filter(Boolean).join("") ?? "";
                if (text) {
                  const out = { choices: [{ delta: { content: text } }] };
                  controller.enqueue(enc.encode(`data: ${JSON.stringify(out)}\n\n`));
                }
              } catch { /* ignore */ }
            }
          }
          controller.enqueue(enc.encode(`data: [DONE]\n\n`));
          controller.close();
        },
      });
      return new Response(stream, { headers: { ...cors, "Content-Type": "text/event-stream" } });
    }

    // No Gemini → try Groq directly
    if (GROQ_KEY) {
      try { return await streamFromGroq(); } catch (_e) { /* fall through to Lovable */ }
    }

    // Fallback to Lovable AI
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: baseMessages,
        stream: true,
      }),
    });
    if (!r.ok) {
      if (r.status === 429) return new Response(JSON.stringify({ error: "تم تجاوز الحد، حاول بعد قليل." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      if (r.status === 402) return new Response(JSON.stringify({ error: "نفد الرصيد، يرجى إضافة رصيد." }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      const t = await r.text();
      return new Response(JSON.stringify({ error: t }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
    return new Response(r.body, { headers: { ...cors, "Content-Type": "text/event-stream" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});