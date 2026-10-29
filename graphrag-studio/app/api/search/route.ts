import { jsonError } from "@/lib/http";
import { retrieve } from "@/lib/retrieve";

export const runtime = "nodejs";

/** Getirme (retrieval) test aracı: sohbetin kullandığı hibrit aramanın ham sonuçları. */
export async function POST(req: Request) {
  try {
    const { query, documentIds, k } = (await req.json()) as { query: string; documentIds?: string[]; k?: number };
    if (!query?.trim()) return jsonError("Sorgu boş", 400);
    return Response.json(await retrieve(query, { documentIds, k: k ?? 10 }));
  } catch (e) {
    return jsonError(e);
  }
}
