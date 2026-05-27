import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedText(text: string): Promise<number[]> {
  // Truncate to avoid token limits (roughly 8000 tokens max)
  const truncated = text.slice(0, 30000);

  const res = await client.embeddings.create({
    model: "text-embedding-3-large",
    input: truncated,
  });

  return res.data[0].embedding;
}
