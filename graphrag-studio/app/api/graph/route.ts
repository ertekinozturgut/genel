import { db, must } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

/** Graf verisi: ?doc=<id>&limit=300&type=Person,Organization&q=metin */
export async function GET(req: Request) {
  try {
    const supa = db();
    const sp = new URL(req.url).searchParams;
    const doc = sp.get("doc");
    const limit = Math.min(Number(sp.get("limit") ?? 300), 2000);
    const types = sp.get("type")?.split(",").filter(Boolean);
    const q = sp.get("q")?.trim().toLocaleLowerCase("tr");

    let entityIds: string[] | null = null;
    if (doc) {
      const m = must(await supa.from("entity_mentions").select("entity_id").eq("document_id", doc).limit(10000)) as { entity_id: string }[];
      entityIds = [...new Set(m.map((x) => x.entity_id))];
      if (!entityIds.length) return Response.json({ nodes: [], links: [] });
    }

    let eq = supa.from("entities").select("id,name,type,description,mention_count,document_count").order("mention_count", { ascending: false }).limit(limit);
    if (entityIds) eq = eq.in("id", entityIds.slice(0, 1500));
    if (types?.length) eq = eq.in("type", types);
    if (q) eq = eq.ilike("normalized_name", `%${q}%`);
    const nodes = must(await eq) as { id: string }[];
    const ids = nodes.map((n) => n.id);
    if (!ids.length) return Response.json({ nodes: [], links: [] });

    // İlişkileri parça parça çek (URL uzunluğu sınırı)
    const links: unknown[] = [];
    const idSet = new Set(ids);
    for (let i = 0; i < ids.length; i += 150) {
      const part = ids.slice(i, i + 150);
      let rq = supa.from("relations").select("id,source_id,target_id,type,description,document_id").in("source_id", part).limit(5000);
      if (doc) rq = rq.eq("document_id", doc);
      const rows = must(await rq) as { source_id: string; target_id: string }[];
      for (const r of rows) if (idSet.has(r.target_id)) links.push(r);
    }
    return Response.json({ nodes, links });
  } catch (e) {
    return jsonError(e);
  }
}
