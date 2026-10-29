import { db, must, DOC_LIST_COLUMNS } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supa = db();
    const full = new URL(req.url).searchParams.get("content") === "1";
    const [doc, chunks, mentions, relations] = await Promise.all([
      supa.from("documents").select(full ? `${DOC_LIST_COLUMNS},content` : DOC_LIST_COLUMNS).eq("id", id).single(),
      supa.from("chunks").select("id,idx,content,char_start,char_end,token_estimate").eq("document_id", id).order("idx").limit(2000),
      supa.from("entity_mentions").select("chunk_id, entity:entities(id,name,type,mention_count)").eq("document_id", id).limit(5000),
      supa
        .from("relations")
        .select("id,type,description,chunk_id,source:entities!relations_source_id_fkey(id,name,type),target:entities!relations_target_id_fkey(id,name,type)")
        .eq("document_id", id)
        .limit(3000),
    ]);
    return Response.json({
      document: must(doc),
      chunks: must(chunks),
      mentions: must(mentions),
      relations: must(relations),
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supa = db();
    must(await supa.from("documents").delete().eq("id", id));
    await supa.rpc("cleanup_orphan_entities");
    await supa.rpc("recount_entity_mentions");
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
