import { db, must } from "./db";
import { embedOne, toVector } from "./embed";

export type RetrievedChunk = {
  id: string;
  document_id: string;
  document_title: string;
  idx: number;
  content: string;
  vector_score: number | null;
  fts_score: number | null;
  graph_hits: number | null;
  rrf: number;
  sources: ("vector" | "fts" | "graph")[];
};

export type RetrievedEntity = { id: string; name: string; type: string; description: string | null; score: number };
export type RetrievedRelation = { id: string; source: string; target: string; type: string; description: string | null };

export type Retrieval = {
  chunks: RetrievedChunk[];
  entities: RetrievedEntity[];
  relations: RetrievedRelation[];
  timings: Record<string, number>;
};

/**
 * Hibrit GraphRAG getirme:
 *  1) Vektör araması (gte-small + pgvector HNSW)
 *  2) Tam metin araması (Postgres tsvector)
 *  3) Sorgu ile eşleşen varlıklar → 1 adımlık graf komşuluğu → bu varlıkları anan chunk'lar
 *  Sonuçlar Reciprocal Rank Fusion ile birleştirilir.
 */
export async function retrieve(
  query: string,
  opts: { k?: number; documentIds?: string[] | null } = {},
): Promise<Retrieval> {
  const supa = db();
  const k = opts.k ?? 8;
  const docFilter = opts.documentIds?.length ? opts.documentIds : null;
  const t0 = Date.now();
  const qvec = toVector(await embedOne(query));
  const timings: Record<string, number> = { embed: Date.now() - t0 };

  const t1 = Date.now();
  const [vec, fts, ents] = await Promise.all([
    supa.rpc("match_chunks", { query_embedding: qvec, match_count: 20, filter_document_ids: docFilter }),
    supa.rpc("search_chunks_fts", { query_text: query, match_count: 20, filter_document_ids: docFilter }),
    supa.rpc("match_entities", { query_embedding: qvec, query_text: query, match_count: 12 }),
  ]);
  timings.search = Date.now() - t1;
  const vecRows = must(vec) as { id: string; document_id: string; idx: number; content: string; similarity: number }[];
  const ftsRows = (fts.error ? [] : fts.data) as { id: string; document_id: string; idx: number; content: string; rank: number }[];
  const entRows = must(ents) as { id: string; name: string; type: string; description: string | null; score: number }[];

  // Güçlü eşleşen varlıklar = graf tohumları
  const seeds = entRows.filter((e) => e.score >= 0.82).slice(0, 8);
  const seedIds = seeds.map((e) => e.id);

  const t2 = Date.now();
  let relations: RetrievedRelation[] = [];
  let graphRows: { id: string; document_id: string; idx: number; content: string; hits: number }[] = [];
  if (seedIds.length) {
    const ids = seedIds.join(",");
    const [rels, gchunks] = await Promise.all([
      supa
        .from("relations")
        .select("id,type,description,document_id,source:entities!relations_source_id_fkey(name),target:entities!relations_target_id_fkey(name)")
        .or(`source_id.in.(${ids}),target_id.in.(${ids})`)
        .limit(60),
      supa.rpc("chunks_for_entities", { entity_ids: seedIds, match_count: 10, exclude_ids: [] }),
    ]);
    const relRows = must(rels) as unknown as {
      id: string;
      type: string;
      description: string | null;
      document_id: string | null;
      source: { name: string } | null;
      target: { name: string } | null;
    }[];
    relations = relRows
      .filter((r) => !docFilter || (r.document_id && docFilter.includes(r.document_id)))
      .map((r) => ({
        id: r.id,
        source: r.source?.name ?? "?",
        target: r.target?.name ?? "?",
        type: r.type,
        description: r.description,
      }));
    graphRows = (must(gchunks) as typeof graphRows).filter((c) => !docFilter || docFilter.includes(c.document_id));
  }
  timings.graph = Date.now() - t2;

  // Reciprocal Rank Fusion
  const K = 60;
  const pool = new Map<string, RetrievedChunk>();
  const add = (
    row: { id: string; document_id: string; idx: number; content: string },
    rank: number,
    source: "vector" | "fts" | "graph",
    score: number,
    weight = 1,
  ) => {
    const ex =
      pool.get(row.id) ??
      ({
        id: row.id,
        document_id: row.document_id,
        document_title: "",
        idx: row.idx,
        content: row.content,
        vector_score: null,
        fts_score: null,
        graph_hits: null,
        rrf: 0,
        sources: [],
      } as RetrievedChunk);
    ex.rrf += weight / (K + rank);
    ex.sources.push(source);
    if (source === "vector") ex.vector_score = score;
    if (source === "fts") ex.fts_score = score;
    if (source === "graph") ex.graph_hits = score;
    pool.set(row.id, ex);
  };
  vecRows.forEach((r, i) => add(r, i + 1, "vector", r.similarity));
  ftsRows.forEach((r, i) => add(r, i + 1, "fts", r.rank));
  graphRows.forEach((r, i) => add(r, i + 1, "graph", r.hits, 0.8));

  const chunks = [...pool.values()].sort((a, b) => b.rrf - a.rrf).slice(0, k);

  const docIds = [...new Set(chunks.map((c) => c.document_id))];
  if (docIds.length) {
    const docs = must(await supa.from("documents").select("id,title").in("id", docIds)) as { id: string; title: string }[];
    const titles = new Map(docs.map((d) => [d.id, d.title]));
    chunks.forEach((c) => (c.document_title = titles.get(c.document_id) ?? ""));
  }
  timings.total = Date.now() - t0;

  return { chunks, entities: entRows, relations, timings };
}
