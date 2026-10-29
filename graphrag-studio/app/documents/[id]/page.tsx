"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { api, runPipeline } from "@/lib/client";
import { STATUS_LABEL, typeColor } from "@/lib/colors";

type Ent = { id: string; name: string; type: string; mention_count: number };
type Detail = {
  document: {
    id: string;
    title: string;
    filename: string | null;
    summary: string | null;
    keywords: string[] | null;
    doc_type: string | null;
    language: string | null;
    status: string;
    progress: string | null;
    error: string | null;
    char_count: number;
    chunk_count: number;
    entity_count: number;
    relation_count: number;
    analysis: { key_points?: string[]; suggested_questions?: string[] } | null;
    created_at: string;
  };
  chunks: { id: string; idx: number; content: string; token_estimate: number }[];
  mentions: { chunk_id: string; entity: Ent | null }[];
  relations: {
    id: string;
    type: string;
    description: string | null;
    chunk_id: string | null;
    source: Ent | null;
    target: Ent | null;
  }[];
};

export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"chunks" | "entities" | "relations">("chunks");
  const [selected, setSelected] = useState<string | null>(null);

  const load = () =>
    api<Detail>(`/api/documents/${id}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const byChunk = useMemo(() => {
    const m = new Map<string, Ent[]>();
    data?.mentions.forEach((x) => {
      if (!x.entity) return;
      const list = m.get(x.chunk_id) ?? [];
      list.push(x.entity);
      m.set(x.chunk_id, list);
    });
    return m;
  }, [data]);

  const entities = useMemo(() => {
    const m = new Map<string, Ent & { local: number }>();
    data?.mentions.forEach((x) => {
      if (!x.entity) return;
      const e = m.get(x.entity.id) ?? { ...x.entity, local: 0 };
      e.local++;
      m.set(x.entity.id, e);
    });
    return [...m.values()].sort((a, b) => b.local - a.local);
  }, [data]);

  if (err) return <div className="text-red-300">{err}</div>;
  if (!data) return <div className="text-mute">Yükleniyor…</div>;
  const d = data.document;
  const visibleChunks = selected ? data.chunks.filter((c) => byChunk.get(c.id)?.some((e) => e.id === selected)) : data.chunks;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-mute hover:text-ink">
            ← Dokümanlar
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{d.title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {d.filename && <span className="chip">{d.filename}</span>}
            {d.doc_type && <span className="chip">{d.doc_type}</span>}
            {d.language && <span className="chip">{d.language}</span>}
            <span className="chip">{STATUS_LABEL[d.status] ?? d.status}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {d.status !== "ready" && (
            <button className="btn-ghost" onClick={() => runPipeline(id, () => load()).then(load).catch((e) => setErr(e.message))}>
              İndekslemeyi sürdür
            </button>
          )}
          <Link className="btn-ghost" href={`/graph?doc=${id}`}>
            Grafı aç
          </Link>
          <Link className="btn-primary" href={`/chat?doc=${id}`}>
            Bu dokümanla sohbet
          </Link>
        </div>
      </div>

      {d.error && <div className="card border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{d.error}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card space-y-3 p-5 lg:col-span-2">
          <div className="label">Özet</div>
          <p className="text-sm leading-relaxed">{d.summary ?? (d.status === "ready" ? "—" : d.progress)}</p>
          {d.analysis?.key_points?.length ? (
            <>
              <div className="label pt-2">Önemli noktalar</div>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {d.analysis.key_points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        <div className="card space-y-3 p-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Parça" v={d.chunk_count} />
            <Stat label="Varlık" v={d.entity_count} />
            <Stat label="İlişki" v={d.relation_count} />
            <Stat label="Karakter" v={d.char_count.toLocaleString("tr")} />
          </div>
          {d.keywords?.length ? (
            <>
              <div className="label pt-2">Anahtar kelimeler</div>
              <div className="flex flex-wrap gap-1.5">
                {d.keywords.map((k) => (
                  <span key={k} className="chip">
                    {k}
                  </span>
                ))}
              </div>
            </>
          ) : null}
          {d.analysis?.suggested_questions?.length ? (
            <>
              <div className="label pt-2">Sorulabilecek sorular</div>
              <div className="flex flex-col gap-1.5">
                {d.analysis.suggested_questions.map((q) => (
                  <Link key={q} href={`/chat?doc=${id}&q=${encodeURIComponent(q)}`} className="text-left text-sm text-accent hover:underline">
                    {q}
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex gap-1 border-b border-line text-sm">
        {(
          [
            ["chunks", `İndeks parçaları (${data.chunks.length})`],
            ["entities", `Varlıklar (${entities.length})`],
            ["relations", `İlişkiler (${data.relations.length})`],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 ${tab === k ? "border-accent text-ink" : "border-transparent text-mute hover:text-ink"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "chunks" && (
        <div className="space-y-3">
          {selected && (
            <div className="text-sm text-mute">
              Filtre: {entities.find((e) => e.id === selected)?.name}{" "}
              <button className="text-accent" onClick={() => setSelected(null)}>
                temizle
              </button>
            </div>
          )}
          {visibleChunks.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-mute">
                <span>
                  #{c.idx} · ~{c.token_estimate} token
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.content}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(byChunk.get(c.id) ?? []).map((e) => (
                  <button key={e.id} onClick={() => setSelected(e.id)} className="chip gap-1.5 hover:text-ink">
                    <span className="h-2 w-2 rounded-full" style={{ background: typeColor(e.type) }} />
                    {e.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "entities" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-mute">
              <tr className="border-b border-line">
                <th className="p-3">Varlık</th>
                <th className="p-3">Tür</th>
                <th className="p-3 text-right">Bu dokümanda</th>
                <th className="p-3 text-right">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id} className="border-b border-line/60 hover:bg-panel-2">
                  <td className="p-3">
                    <button
                      className="hover:text-accent"
                      onClick={() => {
                        setSelected(e.id);
                        setTab("chunks");
                      }}
                    >
                      {e.name}
                    </button>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: typeColor(e.type) }} />
                      {e.type}
                    </span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{e.local}</td>
                  <td className="p-3 text-right tabular-nums">{e.mention_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "relations" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-mute">
              <tr className="border-b border-line">
                <th className="p-3">Kaynak</th>
                <th className="p-3">İlişki</th>
                <th className="p-3">Hedef</th>
                <th className="p-3">Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {data.relations.map((r) => (
                <tr key={r.id} className="border-b border-line/60 align-top hover:bg-panel-2">
                  <td className="p-3">{r.source?.name}</td>
                  <td className="p-3">
                    <span className="chip font-mono">{r.type}</span>
                  </td>
                  <td className="p-3">{r.target?.name}</td>
                  <td className="p-3 text-mute">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number | string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{v}</div>
    </div>
  );
}
