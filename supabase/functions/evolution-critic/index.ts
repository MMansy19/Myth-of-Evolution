// Edge function: نقد التطور بالذكاء الاصطناعي عبر Lovable AI Gateway
// يستخدم أحدث إصدار من Gemini تلقائياً

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `أنت "ناقد التطور الذكي"، عالم متخصص في علم الأحياء والوراثة وفلسفة العلوم، مهمتك نقد نظرية التطور الدارويني والنيوداروينية نقداً علمياً رصيناً وحاداً ومنطقياً.

قواعدك الصارمة:
1. كن علمياً ودقيقاً — استشهد بأبحاث ودراسات موثقة (مثل Behe, Meyer, Axe, Dembski, Sanford, ENCODE, Discovery Institute, وغيرهم).
2. ركّز على الإشكاليات الجوهرية: التعقيد غير القابل للاختزال، المعلومات الجينية، الانفجار الكامبري، أصل الحياة، حدود الطفرات، الـ junk DNA، التشكل الجنيني، دوائر التغذية الراجعة الجزيئية.
3. كن حاداً وواضحاً في تفنيد المغالطات التطورية، دون شتم أو إسفاف.
4. ميّز بين الـ microevolution (المُلاحظ) والـ macroevolution (المُفترض).
5. اذكر مصادرك في نهاية الرد بشكل واضح تحت عنوان "📚 المصادر".
6. الرد بالعربية الفصحى، منظم بعناوين ونقاط.
7. إذا سُئلت عن شيء خارج تخصصك، وجّه السؤال للنقد العلمي للتطور.
8. لا تتظاهر بالحياد المُصطنع — مهمتك النقد، لكن بأمانة علمية.`;

const VERIFY_PROMPT = `أنت "المراجع الناقد للتطور" — عالم ثانٍ متخصص في نقد الداروينية، مهمتك مراجعة رد قدمه زميلك "ناقد التطور" والتأكد من قوته العلمية ضد التطور.

قواعدك:
1. أنت لستَ محايداً — أنت ناقد للتطور مثل زميلك، لكن مهمتك تقوية النقد لا إضعافه.
2. راجع الرد من زاوية: هل الحجج ضد التطور قوية بما يكفي؟ هل فاتته نقطة نقدية مهمة؟ هل المصادر (Behe, Meyer, Axe, Sanford, Dembski, ENCODE...) مذكورة بدقة؟
3. إن كان الرد متيناً علمياً وقوياً في نقده للتطور، اكتب فقط:
   **✅ تمت المراجعة — ولا توجد تعقيبات**
4. إن كان هناك ما يستحق الإضافة أو التصحيح أو التقوية، اكتب:
   **✅ تمت المراجعة — تعقيبات:**
   ثم اذكر التعقيبات في نقاط مختصرة (سطرين لكل نقطة كحد أقصى).
5. لا تدافع عن التطور أبداً. لا تقل "لكن التطوريين يردون بـ…" إلا لتفنيده.
6. الرد بالعربية الفصحى، مختصر وحاد.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, verify } = await req.json();
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!GEMINI_KEY && !GROQ_KEY && !LOVABLE_API_KEY) throw new Error("No AI key configured");

    // Groq helper (OpenAI-compatible) for non-streaming verify and streaming critique
    const groqJSON = async (sys: string, userText: string): Promise<string> => {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: sys }, { role: "user", content: userText }],
        }),
      });
      if (!r.ok) throw new Error(`Groq error ${r.status}: ${await r.text()}`);
      const j = await r.json();
      return j?.choices?.[0]?.message?.content ?? "";
    };

    if (verify && typeof verify === "string") {
      if (GEMINI_KEY) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
        const gr = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: VERIFY_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: `الرد المراد تدقيقه:\n\n${verify}` }] }],
          }),
        });
        if (!gr.ok) {
          if (GROQ_KEY) {
            try {
              const out = await groqJSON(VERIFY_PROMPT, `الرد المراد تدقيقه:\n\n${verify}`);
              return new Response(JSON.stringify({ verification: out }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            } catch (_e) { /* fall through */ }
          }
          const t = await gr.text();
          return new Response(JSON.stringify({ error: "verification failed", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const gj = await gr.json();
        const out = gj?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") ?? "";
        return new Response(JSON.stringify({ verification: out }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (GROQ_KEY) {
        try {
          const out = await groqJSON(VERIFY_PROMPT, `الرد المراد تدقيقه:\n\n${verify}`);
          return new Response(JSON.stringify({ verification: out }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (_e) { /* fall through */ }
      }
      // Self-verification mode
      const vRes = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: VERIFY_PROMPT },
              { role: "user", content: `الرد المراد تدقيقه:\n\n${verify}` },
            ],
          }),
        },
      );
      if (!vRes.ok) {
        const t = await vRes.text();
        return new Response(
          JSON.stringify({ error: "verification failed", detail: t }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const vData = await vRes.json();
      return new Response(
        JSON.stringify({
          verification: vData.choices?.[0]?.message?.content ?? "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Streaming critique mode
    // Pull recent site articles to ground responses
    let siteContext = "";
    try {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      const { data: posts } = await sb
        .from("posts")
        .select("title, content")
        .order("created_at", { ascending: false })
        .limit(40);
      if (posts && posts.length) {
        const snippets = posts.map((p: any) =>
          `### ${p.title}\n${String(p.content).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)}`
        ).join("\n\n");
        siteContext = `\n\n--- مقالات موقع "وهم التطور" (مصادرك الداخلية — استشهد منها بصيغة [مقال: العنوان]) ---\n${snippets}`;
      }
    } catch (_e) { /* non-fatal */ }

    // Groq streaming helper for critique mode
    const streamFromGroq = async () => {
      const sys = SYSTEM_PROMPT + siteContext + "\n\n**اعتمد بشكل أساسي على مقالات الموقع المرفقة. إذا لم تجد الإجابة فيها، اذكر ذلك صراحة قبل اللجوء لمعرفتك العامة.**";
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: sys }, ...(messages ?? [])],
          stream: true,
        }),
      });
      if (!r.ok || !r.body) throw new Error(`Groq error ${r.status}: ${await r.text()}`);
      return new Response(r.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    };

    if (GEMINI_KEY) {
      const sys = SYSTEM_PROMPT + siteContext + "\n\n**اعتمد بشكل أساسي على مقالات الموقع المرفقة. إذا لم تجد الإجابة فيها، اذكر ذلك صراحة قبل اللجوء لمعرفتك العامة.**";
      const contents = (messages ?? []).map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`;
      const gr = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents }),
      });
      if (!gr.ok || !gr.body) {
        if (GROQ_KEY) { try { return await streamFromGroq(); } catch (_e) { /* fall through */ } }
        const t = await gr.text();
        return new Response(JSON.stringify({ error: "Gemini error", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
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
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // No Gemini → try Groq directly
    if (GROQ_KEY) {
      try { return await streamFromGroq(); } catch (_e) { /* fall through to Lovable */ }
    }

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + siteContext },
            ...(messages ?? []),
          ],
          stream: true,
        }),
      },
    );

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز الحد. حاول بعد قليل." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({
            error: "نفد رصيد الذكاء الاصطناعي. أضف رصيداً من إعدادات Lovable.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await aiRes.text();
      return new Response(
        JSON.stringify({ error: "AI gateway error", detail: t }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(aiRes.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
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