/**
 * Supabase Edge Function (gte-small, 384 boyut) ile embedding üretir.
 * Ücretsizdir; ayrı bir embedding API anahtarı gerektirmez.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY eksik");

  const BATCH = 16;
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) batches.push(texts.slice(i, i + BATCH));

  const results: number[][][] = new Array(batches.length);
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const i = next++;
      results[i] = await callEmbed(url, key, batches[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, batches.length) }, worker));
  return results.flat();
}

async function callEmbed(url: string, key: string, texts: string[], attempt = 0): Promise<number[][]> {
  const res = await fetch(`${url}/functions/v1/embed`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) {
    if (attempt < 3 && (res.status >= 500 || res.status === 429)) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      return callEmbed(url, key, texts, attempt + 1);
    }
    throw new Error(`Embedding hatası ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { embeddings: number[][] };
  return json.embeddings;
}

export async function embedOne(text: string): Promise<number[]> {
  const [e] = await embedTexts([text]);
  return e;
}

/** pgvector'a string formatında gönderim */
export const toVector = (v: number[]) => `[${v.join(",")}]`;
