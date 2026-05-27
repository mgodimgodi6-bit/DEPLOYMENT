import { Pinecone } from "@pinecone-database/pinecone";
import { embedText } from "./embeddings";

let _pc: Pinecone | null = null;

function getPinecone(): Pinecone {
  if (!_pc) {
    _pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
  return _pc;
}

function getIndex() {
  return getPinecone().index(
    process.env.PINECONE_INDEX_NAME || "briiz-ai-db"
  );
}

export async function queryVectorDB(query: string): Promise<string> {
  try {
    const vector = await embedText(query);
    const index = getIndex();

    const results = await index.query({
      vector,
      topK: 8,
      includeMetadata: true,
    });

    if (!results.matches?.length) return "";

    return results.matches
      .filter((m) => m.score && m.score > 0.5)
      .map((m) => (m.metadata as Record<string, string>)?.text || "")
      .filter(Boolean)
      .join("\n\n---\n\n");
  } catch (err) {
    console.error("VectorDB query error:", err);
    return "";
  }
}

export async function storeDocumentChunks(
  chunks: string[],
  docName: string
): Promise<void> {
  const index = getIndex();
  const vectors = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.trim()) continue;

    try {
      const emb = await embedText(chunk);
      vectors.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        values: emb,
        metadata: {
          text: chunk,
          document: docName,
          chunkIndex: i,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error(`Failed to embed chunk ${i}:`, err);
    }
  }

  if (vectors.length > 0) {
    // Upsert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      await index.upsert(vectors.slice(i, i + batchSize));
    }
  }
}

export async function getAllDocumentContext(): Promise<string> {
  try {
    // Query with a broad vector to get a sample of stored docs
    const dummyVector = new Array(3072).fill(0.01);
    const index = getIndex();

    const results = await index.query({
      vector: dummyVector,
      topK: 20,
      includeMetadata: true,
    });

    return results.matches
      ?.map((m) => (m.metadata as Record<string, string>)?.text || "")
      .filter(Boolean)
      .join("\n\n---\n\n") || "";
  } catch (err) {
    console.error("getAllDocumentContext error:", err);
    return "";
  }
}
