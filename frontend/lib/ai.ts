import OpenAI from "openai";

// Only initialize OpenAI if API key is available
export const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  : null;

export const CLASSIFY_MODEL = process.env.OPENAI_CLASSIFY_MODEL ?? "gpt-4o-mini";
export const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-large";

export async function classifyNlStrictJSON(system: string, user: string) {
  if (!openai) {
    throw new Error("OpenAI API key not configured");
  }
  
  const resp = await openai.chat.completions.create({
    model: CLASSIFY_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const txt = resp.choices[0]?.message?.content ?? "{}";
  return JSON.parse(txt);
}

export async function embed(text: string) {
  if (!openai) {
    throw new Error("OpenAI API key not configured");
  }
  
  const { data } = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: text,
  });
  return data[0].embedding;
}
