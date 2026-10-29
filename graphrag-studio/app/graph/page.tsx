"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { TYPE_COLORS, typeColor } from "@/lib/colors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import("@/components/ForceGraph"), { ssr: false }) as unknown as React.ComponentType<any>;

type GNode = { id: string; name: string; type: string; description: string | null; mention_count: number; document_count: number; x?: number; y?: number };
type GLink = { id: string; source: string | GNode; target: string | GNode; type: string; description: string | null };
type EntityDetail = {
  entity: GNode;
  relations: { id: string; type: string; description: string | null; source: GNode | null; target: GNode | null }[];
  mentions: { chunk: { id: string; idx: number; content: string } | null; document: { id: string; title: string } | null }[];
};

export default function GraphPage() {
  return (
    <Suspense fallback={<div className="text-mute">Yükleniyor…</div>}>
      <GraphView />
    </Suspense>
  );
}

function GraphView() {
  const sp = useSearchParams();
  const router = useRouter();
  const [docs, setDocs] = useState<{ id: string; title: string }[]>([]);
  const [doc, setDoc] = useState(sp.get("doc") ?? "");
  const [types, setTypes] = useState<string[]>(sp.get("type") ? [sp.get("type")!] : []);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(300);
  const [data, setData] = useState<{ nodes: GNode[]; links: GLink[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<EntityDetail | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  useEffect(() => {
    api<{ documents: { id: string; title: string }[] }>("/api/documents").then((r) => setDocs(r.documents));
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (doc) p.set("doc", doc);
    if (types.length) p.set("type", types.join(","));
    if (q) p.set("q", q);
    p.set("limit", String(limit));
    try {
      const r = await api<{ nodes: GNode[]; links: GLink[] }>(`/api/graph?${p}`);
      setData(r);
    } finally {
      setLoading(false);
    }
  }, [doc, types, q, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    data.links.forEach((l) => {
      const s = typeof l.source === "string" ? l.source : l.source.id;
      const t = typeof l.target === "string" ? l.target : l.target.id;
      if (!m.has(s)) m.set(s, new Set());
      if (!m.has(t)) m.set(t, new Set());
      m.get(s)!.add(t);
      m.get(t)!.add(s);
    });
    return m;
  }, [data]);

  const focus = selected?.entity.id ?? hover;
  const isLit = (id: string) => !focus || id === focus || neighbors.get(focus)?.has(id);

  async function openEntity(id: string) {
    const d = await api<EntityDetail>(`/api/entities/${id}`);
    setSelected(d);
    const n = data.nodes.find((x) => x.id === id);
    if (n?.x != null && fgRef.current) {
      fgRef.current.centerAt(n.x, n.y, 600);
      fgRef.current.zoom(2.5, 600);
    }
  }

  const maxMentions = Math.max(1, ...data.nodes.map((n) => n.mention_count));
  const presentTypes = useMemo(() => [...new Set(data.nodes.map((n) => n.type))], [data]);

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr_340px]">
      <aside className="card h-fit space-y-4 p-4">
        <div>
          <div className="label mb-1.5">Doküman</div>
          <select
            className="input"
            value={doc}
            onChange={(e) => {
              setDoc(e.target.value);
              router.replace(e.target.value ? `/graph?doc=${e.target.value}` : "/graph");
            }}
          >
            <option value="">Tüm dokümanlar</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="label mb-1.5">Varlık ara</div>
          <input className="input" placeholder="ör. Toyota" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <div className="label mb-1.5">Türler</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(TYPE_COLORS).map((t) => {
              const on = types.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => setTypes((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
                  className={`chip gap-1.5 ${on ? "border-accent text-ink" : ""} ${!presentTypes.includes(t) && !on ? "opacity-40" : ""}`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: typeColor(t) }} />
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="label mb-1.5">En çok anılan {limit} varlık</div>
          <input type="range" min={50} max={1500} step={50} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full" />
        </div>
        <label className="flex items-center gap-2 text-sm text-mute">
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Etiketleri göster
        </label>
        <div className="text-xs text-mute tabular-nums">
          {loading ? "Yükleniyor…" : `${data.nodes.length} node · ${data.links.length} edge`}
        </div>
      </aside>

      <div ref={wrapRef} className="card relative h-[calc(100vh-8rem)] min-h-[480px] overflow-hidden">
        {data.nodes.length === 0 && !loading && (
          <div className="absolute inset-0 grid place-items-center text-sm text-mute">Gösterilecek varlık yok. Önce doküman yükleyin.</div>
        )}
        <ForceGraph2D
          fgRef={fgRef}
          width={size.w}
          height={size.h}
          graphData={data}
          backgroundColor="#12151d"
          nodeId="id"
          nodeRelSize={4}
          nodeVal={(n: GNode) => 1 + (n.mention_count / maxMentions) * 12}
          linkColor={(l: GLink) => {
            const s = typeof l.source === "string" ? l.source : l.source.id;
            const t = typeof l.target === "string" ? l.target : l.target.id;
            return !focus || s === focus || t === focus ? "rgba(139,145,163,0.55)" : "rgba(139,145,163,0.08)";
          }}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          linkLabel={(l: GLink) => `${l.type}${l.description ? ` — ${l.description}` : ""}`}
          onNodeHover={(n: GNode | null) => setHover(n?.id ?? null)}
          onNodeClick={(n: GNode) => openEntity(n.id)}
          onBackgroundClick={() => setSelected(null)}
          cooldownTicks={120}
          nodeCanvasObject={(n: GNode, ctx: CanvasRenderingContext2D, scale: number) => {
            const r = 3 + Math.sqrt(1 + (n.mention_count / maxMentions) * 40);
            const lit = isLit(n.id);
            ctx.globalAlpha = lit ? 1 : 0.15;
            ctx.beginPath();
            ctx.arc(n.x!, n.y!, r, 0, 2 * Math.PI);
            ctx.fillStyle = typeColor(n.type);
            ctx.fill();
            if (n.id === focus) {
              ctx.lineWidth = 2 / scale;
              ctx.strokeStyle = "#fff";
              ctx.stroke();
            }
            if (showLabels && (scale > 1.4 || r > 7 || n.id === focus)) {
              const fs = Math.max(10 / scale, 2.5);
              ctx.font = `${fs}px Inter, sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = "#e6e8ee";
              ctx.fillText(n.name, n.x!, n.y! + r + 1);
            }
            ctx.globalAlpha = 1;
          }}
          nodePointerAreaPaint={(n: GNode, color: string, ctx: CanvasRenderingContext2D) => {
            const r = 3 + Math.sqrt(1 + (n.mention_count / maxMentions) * 40);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(n.x!, n.y!, r + 2, 0, 2 * Math.PI);
            ctx.fill();
          }}
        />
      </div>

      <aside className="card h-[calc(100vh-8rem)] min-h-[480px] overflow-y-auto p-4 scroll-thin">
        {!selected ? (
          <div className="space-y-2 text-sm text-mute">
            <p>Ayrıntı için bir node&apos;a tıklayın.</p>
            <p>Node boyutu = anılma sayısı, renk = varlık türü. Üzerine gelince komşuları vurgulanır.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: typeColor(selected.entity.type) }} />
                <span className="text-xs text-mute">{selected.entity.type}</span>
              </div>
              <h2 className="mt-1 text-lg font-semibold">{selected.entity.name}</h2>
              <p className="mt-1 text-sm text-mute">{selected.entity.description}</p>
              <div className="mt-2 text-xs text-mute tabular-nums">
                {selected.entity.mention_count} anılma · {selected.entity.document_count} doküman
              </div>
              <Link className="mt-2 inline-block text-sm text-accent hover:underline" href={`/chat?q=${encodeURIComponent(`${selected.entity.name} hakkında neler biliyorsun?`)}`}>
                Bu varlık hakkında sor →
              </Link>
            </div>
            <div>
              <div className="label mb-2">İlişkiler ({selected.relations.length})</div>
              <ul className="space-y-2 text-sm">
                {selected.relations.map((r) => {
                  const outgoing = r.source?.id === selected.entity.id;
                  const other = outgoing ? r.target : r.source;
                  return (
                    <li key={r.id} className="rounded-lg bg-panel-2 p-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!outgoing && <span className="text-mute">←</span>}
                        <span className="chip font-mono">{r.type}</span>
                        {outgoing && <span className="text-mute">→</span>}
                        <button className="hover:text-accent" onClick={() => other && openEntity(other.id)}>
                          {other?.name}
                        </button>
                      </div>
                      {r.description && <div className="mt-1 text-xs text-mute">{r.description}</div>}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <div className="label mb-2">Geçtiği parçalar</div>
              <ul className="space-y-2 text-sm">
                {selected.mentions.map(
                  (m, i) =>
                    m.chunk && (
                      <li key={i} className="rounded-lg bg-panel-2 p-2">
                        <Link href={`/documents/${m.document?.id}`} className="text-xs text-accent hover:underline">
                          {m.document?.title} · #{m.chunk.idx}
                        </Link>
                        <p className="mt-1 line-clamp-4 text-xs text-mute">{m.chunk.content}</p>
                      </li>
                    ),
                )}
              </ul>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
