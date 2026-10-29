"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { TYPE_COLORS, typeColor } from "@/lib/colors";

type Kind = "search" | "chunks" | "entities" | "relations";
type SearchResult = {
  chunks: {
    id: string;
    document_id: string;
    document_title: string;
    idx: number;
    content: string;
    vector_score: number | null;
    fts_score: number | null;
    graph_hits: number | null;
    rrf: number;
    sources: string[];
  }[];
  entities: { id: string; name: string; type: string; description: string | null; score: number }[];
  relations: { id: string; source: string; target: string; type: string; description: string | null }[];
  timings: Record<string, number>;
};

export default function ExplorerPage() {
  const [kind, setKind] = useState<Kind>("search");
  const [docs, setDocs] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    api<{ documents: { id: string; title: string }[] }>("/api/documents").then((r) => setDocs(r.documents));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">İndeks Gezgini</h1>
        <p className="text-sm text-mute">
          Vektör + tam metin indeksini, varlık ve ilişki tablolarını inceleyin; getirme (retrieval) kalitesini test edin.
        </p>
      </div>
      <div className="flex gap-1 border-b border-line text-sm">
        {(
          [
            ["search", "Arama testi"],
            ["chunks", "Parçalar"],
            ["entities", "Varlıklar"],
            ["relations", "İlişkiler"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`-mb-px border-b-2 px-3 py-2 ${kind === k ? "border-accent text-ink" : "border-transparent text-mute hover:text-ink"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {kind === "search" ? <SearchTester docs={docs} /> : <TableView kind={kind} docs={docs} />}
    </div>
  );
}

function SearchTester({ docs }: { docs: { id: string; title: string }[] }) {
  const [q, setQ] = useState("");
  const [doc, setDoc] = useState("");
  const [res, setRes] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!q.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      setRes(
        await api<SearchResult>("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, documentIds: doc ? [doc] : undefined, k: 12 }),
        }),
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <input className="input min-w-64 flex-1" placeholder="Bir sorgu yazın…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={doc} onChange={(e) => setDoc(e.target.value)}>
          <option value="">Tüm dokümanlar</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <button className="btn-primary" disabled={busy}>
          {busy ? "Aranıyor…" : "Ara"}
        </button>
      </form>
      {err && <div className="text-sm text-red-300">{err}</div>}
      {res && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-2">
            <div className="text-xs text-mute tabular-nums">
              Hibrit sıralama (RRF) · {Object.entries(res.timings).map(([k, v]) => `${k} ${v}ms`).join(" · ")}
            </div>
            {res.chunks.map((c, i) => (
              <div key={c.id} className="card p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold tabular-nums">#{i + 1}</span>
                  <Link href={`/documents/${c.document_id}`} className="text-accent hover:underline">
                    {c.document_title} · parça {c.idx}
                  </Link>
                  <span className="chip tabular-nums">rrf {c.rrf.toFixed(4)}</span>
                  {c.vector_score != null && <span className="chip tabular-nums">vektör {c.vector_score.toFixed(3)}</span>}
                  {c.fts_score != null && <span className="chip tabular-nums">tam metin {c.fts_score.toFixed(3)}</span>}
                  {c.graph_hits != null && <span className="chip tabular-nums">graf {c.graph_hits}</span>}
                </div>
                <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm text-mute">{c.content}</p>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="card p-3">
              <div className="label mb-2">Varlık eşleşmeleri</div>
              <ul className="space-y-1.5 text-sm">
                {res.entities.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: typeColor(e.type) }} />
                      {e.name}
                    </span>
                    <span className={`tabular-nums text-xs ${e.score >= 0.82 ? "text-emerald-300" : "text-mute"}`}>{e.score.toFixed(3)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-mute">≥ 0.82 skorlu varlıklar graf genişletmesinde tohum olarak kullanılır.</p>
            </div>
            {res.relations.length > 0 && (
              <div className="card p-3">
                <div className="label mb-2">Graf komşuluğu</div>
                <ul className="space-y-1 text-xs text-mute">
                  {res.relations.map((r) => (
                    <li key={r.id}>
                      <span className="text-ink">{r.source}</span> <span className="font-mono">-[{r.type}]→</span>{" "}
                      <span className="text-ink">{r.target}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type Row = Record<string, unknown> & { id: string };

function TableView({ kind, docs }: { kind: Exclude<Kind, "search">; docs: { id: string; title: string }[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [doc, setDoc] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ kind, page: String(page) });
    if (q) p.set("q", q);
    if (doc) p.set("doc", doc);
    if (type) p.set("type", type);
    const r = await api<{ rows: Row[]; count: number }>(`/api/chunks?${p}`);
    setRows(r.rows);
    setCount(r.count ?? 0);
  }, [kind, page, q, doc, type]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => setPage(0), [kind, q, doc, type]);

  const pages = Math.max(1, Math.ceil(count / 50));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder={kind === "chunks" ? "İçerikte ara…" : kind === "entities" ? "Varlık adı…" : "İlişki türü…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {kind !== "entities" && (
          <select className="input w-auto" value={doc} onChange={(e) => setDoc(e.target.value)}>
            <option value="">Tüm dokümanlar</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        )}
        {kind === "entities" && (
          <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tüm türler</option>
            {Object.keys(TYPE_COLORS).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        )}
        <span className="ml-auto self-center text-xs text-mute tabular-nums">{count} kayıt</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-mute">
            {kind === "chunks" && (
              <tr className="border-b border-line">
                <th className="p-3">Doküman</th>
                <th className="p-3">#</th>
                <th className="p-3">İçerik</th>
                <th className="p-3 text-right">Token</th>
              </tr>
            )}
            {kind === "entities" && (
              <tr className="border-b border-line">
                <th className="p-3">Varlık</th>
                <th className="p-3">Tür</th>
                <th className="p-3">Açıklama</th>
                <th className="p-3 text-right">Anılma</th>
                <th className="p-3 text-right">Doküman</th>
              </tr>
            )}
            {kind === "relations" && (
              <tr className="border-b border-line">
                <th className="p-3">Kaynak</th>
                <th className="p-3">İlişki</th>
                <th className="p-3">Hedef</th>
                <th className="p-3">Açıklama</th>
                <th className="p-3">Doküman</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((r) => {
              if (kind === "chunks") {
                const docT = (r.document as { title: string } | null)?.title;
                return (
                  <tr key={r.id} className="cursor-pointer border-b border-line/60 align-top hover:bg-panel-2" onClick={() => setOpen(open === r.id ? null : r.id)}>
                    <td className="p-3 whitespace-nowrap">
                      <Link className="hover:text-accent" href={`/documents/${r.document_id}`} onClick={(e) => e.stopPropagation()}>
                        {docT}
                      </Link>
                    </td>
                    <td className="p-3 tabular-nums">{r.idx as number}</td>
                    <td className="p-3 text-mute">
                      <p className={open === r.id ? "whitespace-pre-wrap" : "line-clamp-2"}>{r.content as string}</p>
                    </td>
                    <td className="p-3 text-right tabular-nums">{r.token_estimate as number}</td>
                  </tr>
                );
              }
              if (kind === "entities") {
                return (
                  <tr key={r.id} className="border-b border-line/60 align-top hover:bg-panel-2">
                    <td className="p-3 font-medium">{r.name as string}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: typeColor(r.type as string) }} />
                        {r.type as string}
                      </span>
                    </td>
                    <td className="p-3 text-mute">{r.description as string}</td>
                    <td className="p-3 text-right tabular-nums">{r.mention_count as number}</td>
                    <td className="p-3 text-right tabular-nums">{r.document_count as number}</td>
                  </tr>
                );
              }
              return (
                <tr key={r.id} className="border-b border-line/60 align-top hover:bg-panel-2">
                  <td className="p-3">{(r.source as { name: string } | null)?.name}</td>
                  <td className="p-3">
                    <span className="chip font-mono">{r.type as string}</span>
                  </td>
                  <td className="p-3">{(r.target as { name: string } | null)?.name}</td>
                  <td className="p-3 text-mute">{r.description as string}</td>
                  <td className="p-3 text-mute">{(r.document as { title: string } | null)?.title}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 text-sm">
        <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          ← Önceki
        </button>
        <span className="text-mute tabular-nums">
          {page + 1} / {pages}
        </span>
        <button className="btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
          Sonraki →
        </button>
      </div>
    </div>
  );
}
