import { NextResponse } from "next/server";
import { getAllDocumentContext } from "@/lib/vectorDB";
import { generateDeepAnalysis } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    const { mode = "financial" } = await req.json();

    // Get all stored document context
    const context = await getAllDocumentContext();

    if (!context || context.trim().length < 50) {
      return NextResponse.json({
        reply:
          "⚠️ No documents found in the knowledge base. Please upload a document first using the Documents panel.",
      });
    }

    const reply = await generateDeepAnalysis(context, mode);

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Analyze API error:", err);
    return NextResponse.json(
      {
        reply: `❌ **Analysis failed**\n\n${(err as Error).message}`,
      },
      { status: 200 }
    );
  }
}
