import { db, must } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supa = db();
    const relSel = "id,type,description,document_id,source:entities!relations_source_id_fkey(id,name,type),target:entities!relations_target_id_fkey(id,name,type)";
    const [entity, out, inc, mentions] = await Promise.all([
      supa.from("entities").select("id,name,type,description,mention_count,document_count,created_at").eq("id", id).single(),
      supa.from("relations").select(relSel).eq("source_id", id).limit(200),
      supa.from("relations").select(relSel).eq("target_id", id).limit(200),
      supa.from("entity_mentions").select("chunk:chunks(id,idx,content,document_id), document:documents(id,title)").eq("entity_id", id).limit(50),
    ]);
    return Response.json({
      entity: must(entity),
      relations: [...(must(out) as unknown[]), ...(must(inc) as unknown[])],
      mentions: must(mentions),
    });
  } catch (e) {
    return jsonError(e);
  }
}
