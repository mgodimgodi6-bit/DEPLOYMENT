import { NextResponse } from "next/server";
import { saveAndEmbedDocument } from "@/lib/documents";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 20MB." },
        { status: 400 }
      );
    }

    const reply = await saveAndEmbedDocument(file);

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Upload API error:", err);
    return NextResponse.json(
      {
        reply: `❌ **Upload failed**\n\n${(err as Error).message}\n\nPlease try again or contact support.`,
      },
      { status: 200 }
    );
  }
}

// Required for large file uploads in Next.js
export const config = {
  api: {
    bodyParser: false,
  },
};
