// Edge function: مراجعة منشور ضيف بالذكاء الاصطناعي مع الاستفادة من المقالات الموجودة
// يعيد تقريراً يحتوي على حكم (موافق/تعديلات/مرفوض) وروابط أرقام مباشرة لمقالات ذات صلة

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `أنت "محكّم وهم التطور" — عالم متخصص في نقد الداروينية، مهمتك مراجعة منشور قدّمه ضيف قبل نشره على الموقع.

مهامك:
1. اقرأ المنشور بدقة وقيّمه علمياً.
2. ستُزوَّد بقائمة من المقالات الموجودة على الموقع (لكل مقال: رقم تسلسلي، عنوان، مقتطف، قسم). استفد منها كمرجعية، واربطها بالمنشور إن كان ذا صلة.
3. إن استخدمت أي مقال من القائمة كمرجع أو كرابط ذي صلة، اذكره بصيغة [#رقم] داخل النص (مثلاً: "كما بُيّن في [#3]").
4. لا تخترع أرقاماً غير موجودة في القائمة المُعطاة.
5. كن ناقداً للتطور: إن كان المنشور يدعم التطور، فنّده بحدة. إن كان ينتقد التطور، قَوِّ حججه واقترح تحسينات.
6. تأكد من خلو المنشور من السب أو المحتوى المسيء أو السبام.

صيغة الرد (إلزامية):

**الحكم:** APPROVE  أو  REVISE  أو  REJECT

**ملخص التقييم:**
(فقرة قصيرة 2-3 أسطر)

**الملاحظات:**
- نقطة 1
- نقطة 2
- ...

**مقالات ذات صلة من الموقع:**
- [#رقم] سبب الصلة (سطر واحد)
- ... (اتركها فارغة "لا يوجد" إن لم تكن هناك صلة)

قواعد الحكم:
- APPROVE: المنشور علمي، رصين، لا يدعم التطور أو ينتقده بشكل سليم.
- REVISE: يحتاج تحسينات لكن أساسه جيد.
- REJECT: يدعم التطور دون نقد، أو مسيء، أو سبام، أو خالٍ من المحتوى.`;

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, content, category } = await req.json();
    if (!title || !content) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!GEMINI_KEY && !GROQ_KEY && !LOVABLE_API_KEY) throw new Error("No AI key configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Pull related posts (prefer same category, then critique posts)
    const { data: sameCat } = await supabase
      .from("posts")
      .select("id, title, content, category, created_at")
      .eq("category", category)
      .order("created_at", { ascending: false })
      .limit(15);

    const { data: critique } = await supabase
      .from("posts")
      .select("id, title, content, category, created_at")
      .eq("category", "critique")
      .order("created_at", { ascending: false })
      .limit(10);

    const merged = [...(sameCat ?? []), ...(critique ?? [])];
    const seen = new Set<string>();
    const unique = merged.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    }).slice(0, 20);

    const numbered = unique.map((p, i) => ({
      n: i + 1,
      id: p.id,
      title: p.title,
      category: p.category,
      excerpt: stripHtml(p.content).slice(0, 280),
    }));

    const corpusText = numbered.length
      ? numbered.map((p) =>
        `[#${p.n}] (${p.category}) ${p.title}\n${p.excerpt}`
      ).join("\n\n")
      : "لا توجد مقالات سابقة في الموقع.";

    const userMessage =
      `# المنشور المُراد مراجعته\n\n**القسم:** ${category}\n**العنوان:** ${title}\n\n**المحتوى:**\n${
        stripHtml(content).slice(0, 6000)
      }\n\n---\n\n# مقالات الموقع المتاحة للاستشهاد بأرقامها\n\n${corpusText}`;

    let report = "";
    const callGroq = async (): Promise<string> => {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userMessage }],
        }),
      });
      if (!r.ok) throw new Error(`Groq error ${r.status}: ${await r.text()}`);
      const j = await r.json();
      return j?.choices?.[0]?.message?.content ?? "";
    };

    if (GEMINI_KEY) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
      const gr = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
        }),
      });
      if (!gr.ok) {
        if (GROQ_KEY) {
          try { report = await callGroq(); } catch (_e) {
            const t = await gr.text();
            return new Response(JSON.stringify({ error: "Gemini error", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } else {
        const t = await gr.text();
        return new Response(JSON.stringify({ error: "Gemini error", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        const gj = await gr.json();
        report = gj?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") ?? "";
      }
    } else if (GROQ_KEY) {
      report = await callGroq();
    } else {
      const aiRes = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userMessage },
            ],
          }),
        },
      );
      if (!aiRes.ok) {
        const t = await aiRes.text();
        const status = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500;
        return new Response(JSON.stringify({ error: "AI gateway error", detail: t }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await aiRes.json();
      report = data.choices?.[0]?.message?.content ?? "";
    }

    // Parse verdict
    const upper = report.toUpperCase();
    let verdict: "APPROVE" | "REVISE" | "REJECT" = "REVISE";
    if (upper.includes("APPROVE")) verdict = "APPROVE";
    else if (upper.includes("REJECT")) verdict = "REJECT";

    // Build a refs map so the client can render number-links
    const refs = numbered.map((p) => ({ n: p.n, id: p.id, title: p.title }));

    return new Response(
      JSON.stringify({ report, verdict, refs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});