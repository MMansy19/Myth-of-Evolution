// Edge function: بحث ذكي في المقالات باستخدام Lovable AI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `أنت مساعد بحث ذكي في موقع "وهم التطور". ستحصل على قائمة منشورات الموقع (id, title, category, snippet) مع سؤال المستخدم.
مهمتك:
1. **اعتمد فقط على منشورات الموقع المرفقة** لاختيار النتائج.
2. حدّد المنشورات الأكثر صلة بالسؤال (حتى 5 نتائج).
3. اكتب إجابة موجزة بالعربية الفصحى تلخّص ما يجده المستخدم في تلك المنشورات.
4. إذا لم تجد إجابة في الموقع، اذكر ذلك صراحة في حقل answer.
5. أعد JSON فقط بهذا الشكل:
{"answer":"...","results":[{"id":"...","title":"...","reason":"..."}]}
لا تضف أي نص خارج JSON.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { query, posts } = await req.json();
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!GEMINI_KEY && !GROQ_KEY && !LOVABLE_API_KEY) throw new Error("No AI key configured");
    if (!query || typeof query !== "string") throw new Error("query required");

    const corpus = (posts ?? []).slice(0, 1000).map((p: any) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      snippet: String(p.content ?? "").replace(/<[^>]+>/g, " ").slice(0, 600),
    }));

    const callGroq = async (): Promise<any> => {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `السؤال: ${query}\n\nالمنشورات:\n${JSON.stringify(corpus)}` },
          ],
        }),
      });
      if (!r.ok) throw new Error(`Groq ${r.status}: ${await r.text()}`);
      const j = await r.json();
      const c = j?.choices?.[0]?.message?.content ?? "{}";
      try { return JSON.parse(c); } catch { return { answer: c, results: [] }; }
    };

    if (GEMINI_KEY) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
      const gr = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: `السؤال: ${query}\n\nالمنشورات:\n${JSON.stringify(corpus)}` }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });
      if (!gr.ok) {
        if (GROQ_KEY) {
          try { const parsed = await callGroq(); return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); } catch (_e) { /* fall through */ }
        }
        const t = await gr.text();
        return new Response(JSON.stringify({ error: t }), { status: gr.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const gj = await gr.json();
      const content = gj?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") ?? "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(content); } catch { parsed = { answer: content, results: [] }; }
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (GROQ_KEY) {
      try { const parsed = await callGroq(); return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); } catch (_e) { /* fall through */ }
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `السؤال: ${query}\n\nالمنشورات:\n${JSON.stringify(corpus)}` },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: t }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { answer: content, results: [] }; }
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});