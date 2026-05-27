import { NextResponse } from "next/server";
import { queryVectorDB } from "@/lib/vectorDB";
import { generateAIResponse } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    const { text, mode = "general" } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // RAG: retrieve relevant context from knowledge base
    const context = await queryVectorDB(text);

    // Generate AI response with mode-specific instructions
    const reply = await generateAIResponse(text, context, mode);

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      {
        reply: `⚠️ **API Error**\n\n${(err as Error).message}\n\nCheck your \`.env.local\` file contains valid \`OPENAI_API_KEY\` and \`PINECONE_API_KEY\`.`,
      },
      { status: 200 }
    );
  }
}
