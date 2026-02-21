import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const runtime = "edge";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { message, conversationHistory } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Missing 'message'." },
        { status: 400, headers: corsHeaders },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const groqKey = process.env.GROQ_API_KEY!;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Missing Supabase env vars" },
        { status: 500, headers: corsHeaders },
      );
    }
    if (!groqKey) {
      return NextResponse.json(
        { error: "Missing GROQ_API_KEY" },
        { status: 500, headers: corsHeaders },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // -------- Retrieval: essentials + search --------
    const q = message.trim();

    const essentialsPromise = supabase
      .from("portfolio_knowledge")
      .select("project,type,title,content,tags")
      .in("type", [
        "bio",
        "skills",
        "education",
        "certification",
        "philosophy",
        "personal",
        "contact",
      ])
      .limit(12);

    const searchPromise = supabase
      .from("portfolio_knowledge")
      .select("project,type,title,content,tags")
      .or(
        [
          `title.ilike.%${q}%`,
          `content.ilike.%${q}%`,
          `tags.ilike.%${q}%`,
          `project.ilike.%${q}%`,
          `type.ilike.%${q}%`,
        ].join(","),
      )
      .limit(12);

    const [essentialsRes, searchRes] = await Promise.all([
      essentialsPromise,
      searchPromise,
    ]);

    const queryText = message.trim().toLowerCase();
    const isProjectQuestion =
      queryText.includes("project") ||
      queryText.includes("projects") ||
      queryText.includes("case study") ||
      queryText.includes("case studies") ||
      queryText.includes("work") ||
      queryText.includes("portfolio projects");

    if (essentialsRes.error) {
      return NextResponse.json(
        {
          error: "Supabase essentials query failed",
          details: essentialsRes.error.message,
        },
        { status: 500, headers: corsHeaders },
      );
    }
    if (searchRes.error) {
      return NextResponse.json(
        {
          error: "Supabase search query failed",
          details: searchRes.error.message,
        },
        { status: 500, headers: corsHeaders },
      );
    }

    const merged = [...(searchRes.data ?? []), ...(essentialsRes.data ?? [])];

    const seen = new Set<string>();
    const data = merged
      .filter((r: any) => {
        const key = `${r.project}|${r.type}|${r.title}|${(r.content ?? "").slice(0, 60)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 16);

    const context = data
      .map((r: any, idx: number) => {
        const title = (r.title ?? "").toString().trim();
        const type = (r.type ?? "").toString().trim();
        const content = (r.content ?? "").toString().trim();
        const tags = (r.tags ?? "").toString().trim();

        // Cleaner "source" format to prevent the model from dumping row metadata
        return `Source ${idx + 1} [${type}${title ? ` | ${title}` : ""}${tags ? ` | tags: ${tags}` : ""}]\n${content}`.trim();
      })
      .join("\n\n");

    // -------- Groq prompt --------
    const system = `
You are a portfolio assistant for Manthan Rase. Visitors (recruiters, collaborators, clients) use this chat to learn about him.

LENGTH RULE (CRITICAL — follow this above all else):
- Default: 1–2 sentences max.
- Only give a longer answer if the user explicitly asks to "elaborate", "tell me more", "explain in detail", or similar.
- NEVER volunteer extra information that wasn’t asked for.

GREETING / SMALLTALK RULE (CRITICAL):
If the user says "hi", "hello", "hey", "how are you", "nice to meet you", or any casual opener:
- Reply with exactly 1 casual line. Nothing more.
- Do NOT mention skills, projects, experience, or education.
- Example: "Hi! What would you like to know about Manthan?"

IDENTITY RULES:
- Speak about Manthan in third person.
- NEVER address the user as "Manthan". NEVER assume the visitor’s name.

CONTEXT RULES:
- Answer ONLY from the PORTFOLIO CONTEXT provided.
- If the answer isn’t in the context, say: "I don’t know based on my portfolio content."
- Do NOT repeat context verbatim or use database labels like "Project:", "Tags:", "Content:".
- Synthesize into natural sentences.

PROJECTS RULE:
List ONLY these when asked about projects: UXLens-AI, Moodly, De Blaze, ParkIQ, Ghost Shooter.

EDUCATION RULE:
- If end year is in the future (e.g., 2026), say "currently pursuing".
- NEVER say "has a Master’s degree" unless explicitly completed.

EXPERIENCE RULE:
- Describe as "3+ years" based on education dates.
- Keep to 1 sentence.
`;

    const messages = [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `PORTFOLIO CONTEXT (rows: ${data.length}):\n${context}\n\n` +
          `Conversation history (brief):\n${(conversationHistory ?? [])
            .slice(-6)
            .map((m: any) => `${m.role}: ${m.content}`)
            .join("\n")}\n\n` +
          `User question:\n${message}`,
      },
    ];

    const resp = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages,
          temperature: 0.3,
          max_tokens: 120,
        }),
      },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json(
        { error: "Groq request failed", details: errText },
        { status: 500, headers: corsHeaders },
      );
    }

    const out = await resp.json();
    const answer =
      out?.choices?.[0]?.message?.content ??
      "I don't know based on my portfolio content.";

    return NextResponse.json({ response: answer }, { headers: corsHeaders });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", details: e?.message ?? String(e) },
      { status: 500, headers: corsHeaders },
    );
  }
}
