import { db, must } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

/** İndeks gezgini için tablo verisi: ?kind=chunks|entities|relations&doc=&q=&page= */
export async function GET(req: Request) {
  try {
    const supa = db();
    const sp = new URL(req.url).searchParams;
    const kind = sp.get("kind") ?? "chunks";
    const doc = sp.get("doc");
    const q = sp.get("q")?.trim();
    const page = Number(sp.get("page") ?? 0);
    const size = 50;
    const from = page * size;

    if (kind === "entities") {
      let query = supa
        .from("entities")
        .select("id,name,type,description,mention_count,document_count", { count: "exact" })
        .order("mention_count", { ascending: false })
        .range(from, from + size - 1);
      if (q) query = query.ilike("normalized_name", `%${q.toLocaleLowerCase("tr")}%`);
      if (sp.get("type")) query = query.eq("type", sp.get("type")!);
      const res = await query;
      return Response.json({ rows: must(res), count: res.count });
    }
    if (kind === "relations") {
      let query = supa
        .from("relations")
        .select(
          "id,type,description,document_id,source:entities!relations_source_id_fkey(id,name,type),target:entities!relations_target_id_fkey(id,name,type),document:documents(title)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, from + size - 1);
      if (doc) query = query.eq("document_id", doc);
      if (q) query = query.ilike("type", `%${q}%`);
      const res = await query;
      return Response.json({ rows: must(res), count: res.count });
    }
    let query = supa
      .from("chunks")
      .select("id,idx,content,token_estimate,document_id,document:documents(title)", { count: "exact" })
      .order("document_id")
      .order("idx")
      .range(from, from + size - 1);
    if (doc) query = query.eq("document_id", doc);
    if (q) query = query.ilike("content", `%${q}%`);
    const res = await query;
    return Response.json({ rows: must(res), count: res.count });
  } catch (e) {
    return jsonError(e);
  }
}
