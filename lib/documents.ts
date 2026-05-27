import { storeDocumentChunks } from "./vectorDB";

// ─── Chunk text ───────────────────────────────────────────────────────────────
function splitIntoChunks(text: string, size = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    const end = Math.min(i + size, text.length);
    chunks.push(text.slice(i, end));
    i += size - overlap;
    if (i >= text.length) break;
  }

  return chunks.filter((c) => c.trim().length > 50);
}

// ─── PDF ──────────────────────────────────────────────────────────────────────
async function parsePDF(buffer: Buffer): Promise<string> {
  const pdf = (await import("pdf-parse")).default;
  const data = await pdf(buffer);
  return data.text;
}

// ─── Excel / CSV ──────────────────────────────────────────────────────────────
async function parseExcel(buffer: Buffer, fileName: string): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(ws);
    parts.push(`=== Sheet: ${sheetName} ===\n${csv}`);
  }

  return parts.join("\n\n");
}

async function parseCSV(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8");
}

// ─── Plain text ───────────────────────────────────────────────────────────────
async function parseText(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8");
}

// ─── Image (OCR via OpenAI vision) ───────────────────────────────────────────
async function parseImage(buffer: Buffer, mimeType: string): Promise<string> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const res = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
          {
            type: "text",
            text: "Extract ALL text and numerical data from this document image. Include every number, label, date, and amount visible. Format as structured text preserving the original layout as much as possible.",
          },
        ],
      },
    ],
    max_tokens: 2000,
  });

  return res.choices[0].message.content ?? "";
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function saveAndEmbedDocument(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name;
  const type = file.type;

  let text = "";

  try {
    if (type === "application/pdf" || name.endsWith(".pdf")) {
      text = await parsePDF(buffer);
    } else if (
      type.includes("spreadsheet") ||
      name.endsWith(".xlsx") ||
      name.endsWith(".xls")
    ) {
      text = await parseExcel(buffer, name);
    } else if (type === "text/csv" || name.endsWith(".csv")) {
      text = await parseCSV(buffer);
    } else if (type.startsWith("image/")) {
      text = await parseImage(buffer, type);
    } else if (type === "text/plain" || name.endsWith(".txt")) {
      text = await parseText(buffer);
    } else {
      // Try as text
      text = buffer.toString("utf-8");
    }
  } catch (err) {
    throw new Error(`Failed to parse document: ${(err as Error).message}`);
  }

  if (!text || text.trim().length < 50) {
    throw new Error(
      "Could not extract meaningful text from this document. Please ensure it is not encrypted or empty."
    );
  }

  const chunks = splitIntoChunks(text);
  await storeDocumentChunks(chunks, name);

  const wordCount = text.split(/\s+/).length;
  const chunkCount = chunks.length;

  return `✅ **Document processed successfully**

**File:** ${name}
**Words extracted:** ${wordCount.toLocaleString()}
**Knowledge chunks stored:** ${chunkCount}

Your document is now part of your Briiz AI knowledge base. You can:
- Ask questions about its contents
- Request a deep analysis using the **◎ Deep Analyze** button
- Upload more documents to expand the knowledge base

_What would you like to know about this document?_`;
}
