import type Anthropic from "@anthropic-ai/sdk";
import { db, must, type DocumentRow } from "./db";
import { chunkText, estimateTokens } from "./chunk";
import { embedTexts, toVector } from "./embed";
import { analyzeDocument, extractGraph, type Extraction } from "./claude";

/**
 * Devam ettirilebilir indeksleme hattı. Her çağrı bir adımı ilerletir; böylece
 * büyük dokümanlar sunucusuz fonksiyon zaman sınırına takılmaz.
 *
 * pending → chunking → embedding → extracting → analyzing → ready
 */
export const STAGES = ["pending", "embedding", "extracting", "analyzing", "ready"] as const;

const EXTRACT_GROUP_CHARS = 9000; // bir Claude çağrısındaki metin
const EXTRACT_PARALLEL = 3; // adım başına paralel çağrı

export const normalizeName = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .replace(/[“”"'`’]/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function setDoc(id: string, patch: Partial<DocumentRow>) {
  must(await db().from("documents").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id));
}

export async function processStep(id: string, claude: Anthropic): Promise<DocumentRow> {
  const doc = must(await db().from("documents").select("*").eq("id", id).single()) as DocumentRow;
  try {
    switch (doc.status) {
      case "pending":
      case "error":
        await stepChunk(doc);
        break;
      case "embedding":
        await stepEmbed(doc);
        break;
      case "extracting":
        await stepExtract(doc, claude);
        break;
      case "analyzing":
        await stepAnalyze(doc, claude);
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setDoc(id, { error: `${doc.status}: ${message}`, progress: "Hata — tekrar denenebilir" });
    throw err;
  }
  return must(await db().from("documents").select("*").eq("id", id).single()) as DocumentRow;
}

async function stepChunk(doc: DocumentRow) {
  const supa = db();
  // Hata sonrası yeniden başlatmada önceki türetilmiş veriyi temizle
  must(await supa.from("relations").delete().eq("document_id", doc.id));
  must(await supa.from("chunks").delete().eq("document_id", doc.id));

  const chunks = chunkText(doc.content ?? "");
  for (let i = 0; i < chunks.length; i += 200) {
    const rows = chunks.slice(i, i + 200).map((c) => ({
      document_id: doc.id,
      idx: c.idx,
      content: c.content,
      char_start: c.start,
      char_end: c.end,
      token_estimate: estimateTokens(c.content),
    }));
    must(await supa.from("chunks").insert(rows));
  }
  await setDoc(doc.id, {
    status: "embedding",
    error: null,
    extract_cursor: 0,
    chunk_count: chunks.length,
    progress: `${chunks.length} parça oluşturuldu, vektörleştiriliyor…`,
  });
}

async function stepEmbed(doc: DocumentRow) {
  const supa = db();
  const pending = must(
    await supa.from("chunks").select("id,content").eq("document_id", doc.id).is("embedding", null).order("idx").limit(96),
  ) as { id: string; content: string }[];

  if (pending.length > 0) {
    const vectors = await embedTexts(pending.map((c) => c.content));
    await Promise.all(
      pending.map(async (c, i) => must(await supa.from("chunks").update({ embedding: toVector(vectors[i]) }).eq("id", c.id))),
    );
  }
  const { count } = await supa
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .eq("document_id", doc.id)
    .is("embedding", null);
  if (!count) {
    await setDoc(doc.id, { status: "extracting", progress: "Varlık ve ilişkiler çıkarılıyor…" });
  } else {
    await setDoc(doc.id, { progress: `Vektörleştiriliyor: ${doc.chunk_count - count}/${doc.chunk_count}` });
  }
}

async function stepExtract(doc: DocumentRow, claude: Anthropic) {
  const supa = db();
  const remaining = must(
    await supa
      .from("chunks")
      .select("id,idx,content")
      .eq("document_id", doc.id)
      .gte("idx", doc.extract_cursor)
      .order("idx")
      .limit(80),
  ) as { id: string; idx: number; content: string }[];

  if (remaining.length === 0) {
    await setDoc(doc.id, { status: "analyzing", progress: "Doküman analiz ediliyor…" });
    return;
  }

  // Chunk'ları ~9k karakterlik gruplara ayır
  const groups: (typeof remaining)[] = [];
  let cur: typeof remaining = [];
  let size = 0;
  for (const c of remaining) {
    if (cur.length && size + c.content.length > EXTRACT_GROUP_CHARS) {
      groups.push(cur);
      if (groups.length === EXTRACT_PARALLEL) break;
      cur = [];
      size = 0;
    }
    cur.push(c);
    size += c.content.length;
  }
  if (cur.length && groups.length < EXTRACT_PARALLEL) groups.push(cur);

  const extractions = await Promise.all(groups.map((g) => extractGraph(claude, doc.title, g)));
  for (let i = 0; i < groups.length; i++) {
    await saveExtraction(doc.id, groups[i], extractions[i]);
  }

  const lastIdx = groups[groups.length - 1].at(-1)!.idx;
  const cursor = lastIdx + 1;
  const done = cursor >= doc.chunk_count;
  await setDoc(doc.id, {
    extract_cursor: cursor,
    status: done ? "analyzing" : "extracting",
    progress: done ? "Doküman analiz ediliyor…" : `Graf çıkarımı: ${cursor}/${doc.chunk_count} parça`,
  });
}

async function saveExtraction(documentId: string, chunks: { id: string; idx: number }[], ex: Extraction) {
  const supa = db();
  const chunkByIdx = new Map(chunks.map((c) => [c.idx, c.id]));
  const fallbackChunk = chunks[0].id;

  // 1) Varlıkları birleştir (normalize isim üzerinden)
  const merged = new Map<string, { name: string; type: string; description: string; chunks: Set<number> }>();
  for (const e of ex.entities) {
    const key = normalizeName(e.name);
    if (!key || key.length < 2) continue;
    const m = merged.get(key);
    if (m) {
      e.chunks.forEach((c) => m.chunks.add(c));
      if (!m.description && e.description) m.description = e.description;
    } else {
      merged.set(key, { name: e.name.trim(), type: e.type, description: e.description, chunks: new Set(e.chunks) });
    }
  }
  // İlişkilerde geçip varlık listesinde olmayan isimleri de ekle
  for (const r of ex.relations) {
    for (const n of [r.source, r.target]) {
      const key = normalizeName(n);
      if (key && !merged.has(key)) {
        merged.set(key, { name: n.trim(), type: "Other", description: "", chunks: new Set([r.chunk]) });
      }
    }
  }
  if (merged.size === 0) return;
  const keys = [...merged.keys()];

  // 2) Mevcut varlıkları bul, yenilerini ekle
  const existing = must(
    await supa.from("entities").select("id,normalized_name,description").in("normalized_name", keys),
  ) as { id: string; normalized_name: string; description: string | null }[];
  const idByKey = new Map(existing.map((e) => [e.normalized_name, e.id]));

  const toInsert = keys
    .filter((k) => !idByKey.has(k))
    .map((k) => {
      const m = merged.get(k)!;
      return { name: m.name, normalized_name: k, type: m.type, description: m.description || null };
    });
  if (toInsert.length) {
    const inserted = must(
      await supa.from("entities").upsert(toInsert, { onConflict: "normalized_name", ignoreDuplicates: true }).select("id,normalized_name"),
    ) as { id: string; normalized_name: string }[];
    inserted.forEach((e) => idByKey.set(e.normalized_name, e.id));
    // Eşzamanlı eklemede ignoreDuplicates nedeniyle dönmeyenleri tekrar oku
    const missing = keys.filter((k) => !idByKey.has(k));
    if (missing.length) {
      const again = must(await supa.from("entities").select("id,normalized_name").in("normalized_name", missing)) as {
        id: string;
        normalized_name: string;
      }[];
      again.forEach((e) => idByKey.set(e.normalized_name, e.id));
    }
  }
  // Açıklaması olmayan mevcut varlıkları zenginleştir
  await Promise.all(
    existing
      .filter((e) => !e.description && merged.get(e.normalized_name)?.description)
      .map(async (e) =>
        must(await supa.from("entities").update({ description: merged.get(e.normalized_name)!.description }).eq("id", e.id)),
      ),
  );

  // 3) Varlık-chunk bağlantıları
  const mentions: { entity_id: string; chunk_id: string; document_id: string }[] = [];
  const seen = new Set<string>();
  for (const [key, m] of merged) {
    const entityId = idByKey.get(key);
    if (!entityId) continue;
    const chunkIds = [...m.chunks].map((n) => chunkByIdx.get(n)).filter(Boolean) as string[];
    if (chunkIds.length === 0) chunkIds.push(fallbackChunk);
    for (const chunkId of chunkIds) {
      const k = `${entityId}:${chunkId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      mentions.push({ entity_id: entityId, chunk_id: chunkId, document_id: documentId });
    }
  }
  if (mentions.length) {
    must(await supa.from("entity_mentions").upsert(mentions, { onConflict: "entity_id,chunk_id", ignoreDuplicates: true }));
  }

  // 4) İlişkiler
  const relations = ex.relations
    .map((r) => ({
      source_id: idByKey.get(normalizeName(r.source)),
      target_id: idByKey.get(normalizeName(r.target)),
      type: r.type.toUpperCase().replace(/[^A-Z0-9_ÇĞİÖŞÜ]+/g, "_").replace(/^_|_$/g, "") || "RELATED_TO",
      description: r.description || null,
      document_id: documentId,
      chunk_id: chunkByIdx.get(r.chunk) ?? fallbackChunk,
    }))
    .filter((r) => r.source_id && r.target_id && r.source_id !== r.target_id);
  if (relations.length) must(await supa.from("relations").insert(relations));
}

async function stepAnalyze(doc: DocumentRow, claude: Anthropic) {
  const supa = db();

  // Embedding'i olmayan varlıkları vektörleştir (graf tabanlı arama için)
  for (let round = 0; round < 5; round++) {
    const ents = must(
      await supa.from("entities").select("id,name,type,description").is("embedding", null).limit(128),
    ) as { id: string; name: string; type: string; description: string | null }[];
    if (!ents.length) break;
    const vecs = await embedTexts(ents.map((e) => `${e.name} (${e.type}): ${e.description ?? ""}`));
    await Promise.all(
      ents.map(async (e, i) => must(await supa.from("entities").update({ embedding: toVector(vecs[i]) }).eq("id", e.id))),
    );
  }
  must(await supa.rpc("recount_entity_mentions"));

  const mentionRows = must(
    await supa.from("entity_mentions").select("entity_id, entities(name, mention_count)").eq("document_id", doc.id).limit(2000),
  ) as unknown as { entity_id: string; entities: { name: string; mention_count: number } | null }[];
  const entityIds = new Set(mentionRows.map((m) => m.entity_id));
  const counts = new Map<string, number>();
  mentionRows.forEach((m) => m.entities && counts.set(m.entities.name, (counts.get(m.entities.name) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([n]) => n);

  const { count: relCount } = await supa
    .from("relations")
    .select("id", { count: "exact", head: true })
    .eq("document_id", doc.id);

  const analysis = await analyzeDocument(claude, doc.filename ?? doc.title, doc.content ?? "", top);
  await setDoc(doc.id, {
    title: analysis.title || doc.title,
    summary: analysis.summary,
    keywords: analysis.keywords,
    doc_type: analysis.doc_type,
    language: analysis.language,
    analysis: { key_points: analysis.key_points, suggested_questions: analysis.suggested_questions },
    entity_count: entityIds.size,
    relation_count: relCount ?? 0,
    status: "ready",
    error: null,
    progress: "Hazır",
  });
}
