"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, isRunning, runPipeline } from "@/lib/client";
import { STATUS_LABEL, typeColor } from "@/lib/colors";

type Doc = {
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
  created_at: string;
};
type Stats = {
  documents: number;
  chunks: number;
  entities: number;
  relations: number;
  entity_types: Record<string, number>;
};

const ACCEPT = ".pdf,.docx,.txt,.md,.csv,.json,.html,.htm";

export default function Home() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([api<{ documents: Doc[] }>("/api/documents"), api<{ stats: Stats }>("/api/stats")]);
      setDocs(d.documents);
      setStats(s.stats);
      return d.documents;
    } catch (e) {
      setErr((e as Error).message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const start = useCallback(
    (id: string) => {
      if (isRunning(id)) return;
      runPipeline(id, (doc) => setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...(doc as Doc) } : d))))
        .catch((e) => setErr(`İndeksleme hatası: ${(e as Error).message}`))
        .finally(refresh);
    },
    [refresh],
  );

  // Açılışta yarım kalmış (hatasız) işleri otomatik sürdür
  useEffect(() => {
    refresh().then((list) => list.filter((d) => d.status !== "ready" && !d.error).forEach((d) => start(d.id)));
  }, [refresh, start]);

  async function upload(files: FileList | File[]) {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      arr.forEach((f) => fd.append("files", f));
      const { created } = await api<{ created: { id: string }[] }>("/api/documents", { method: "POST", body: fd });
      await refresh();
      created.forEach((c) => start(c.id));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submitPaste() {
    if (!pasteText.trim()) return;
    setUploading(true);
    try {
      const { created } = await api<{ created: { id: string }[] }>("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: pasteTitle, text: pasteText }),
      });
      setPasteOpen(false);
      setPasteText("");
      setPasteTitle("");
      await refresh();
      created.forEach((c) => start(c.id));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Bu doküman ve tüm indeks/graf verisi silinsin mi?")) return;
    await api(`/api/documents/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Doküman", stats?.documents],
          ["İndeks parçası", stats?.chunks],
          ["Varlık (node)", stats?.entities],
          ["İlişki (edge)", stats?.relations],
        ].map(([label, v]) => (
          <div key={label as string} className="card p-4">
            <div className="label">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{v ?? "—"}</div>
          </div>
        ))}
      </section>

      {stats && Object.keys(stats.entity_types).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.entity_types)
            .sort((a, b) => b[1] - a[1])
            .map(([t, n]) => (
              <Link key={t} href={`/graph?type=${t}`} className="chip gap-1.5 hover:text-ink">
                <span className="h-2 w-2 rounded-full" style={{ background: typeColor(t) }} />
                {t} <span className="tabular-nums">{n}</span>
              </Link>
            ))}
        </div>
      )}

      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          upload(e.dataTransfer.files);
        }}
        className={`card flex flex-col items-center justify-center gap-3 border-dashed p-8 text-center transition ${drag ? "border-accent bg-panel-2" : ""}`}
      >
        <div className="text-lg font-medium">Doküman yükle</div>
        <p className="max-w-xl text-sm text-mute">
          PDF, Word (.docx), TXT, Markdown, CSV, JSON veya HTML. Yüklenen her doküman otomatik olarak parçalanır,
          vektörleştirilir, varlık–ilişki grafı çıkarılır ve özetlenir.
        </p>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Yükleniyor…" : "Dosya seç"}
          </button>
          <button className="btn-ghost" onClick={() => setPasteOpen((v) => !v)}>
            Metin yapıştır
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
        {pasteOpen && (
          <div className="mt-2 w-full max-w-2xl space-y-2 text-left">
            <input className="input" placeholder="Başlık (opsiyonel)" value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} />
            <textarea
              className="input h-40"
              placeholder="Metni buraya yapıştırın…"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button className="btn-primary" disabled={uploading || !pasteText.trim()} onClick={submitPaste}>
              Ekle ve indeksle
            </button>
          </div>
        )}
      </section>

      {err && (
        <div className="card border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {err}{" "}
          {err.includes("API anahtar") && (
            <Link className="underline" href="/settings">
              Ayarlar
            </Link>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Dokümanlar</h2>
        {loading && <div className="text-sm text-mute">Yükleniyor…</div>}
        {!loading && docs.length === 0 && <div className="text-sm text-mute">Henüz doküman yok.</div>}
        <div className="grid gap-3 md:grid-cols-2">
          {docs.map((d) => (
            <article key={d.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/documents/${d.id}`} className="font-medium hover:text-accent">
                  {d.title}
                </Link>
                <StatusBadge status={d.status} error={d.error} />
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs text-mute">
                {d.filename && <span>{d.filename}</span>}
                {d.doc_type && <span className="chip">{d.doc_type}</span>}
                {d.language && <span className="chip">{d.language}</span>}
              </div>
              {d.status !== "ready" && (
                <div className="text-xs text-mute">
                  {d.error ? <span className="text-red-300">{d.error}</span> : d.progress}
                </div>
              )}
              {d.summary && <p className="line-clamp-3 text-sm text-mute">{d.summary}</p>}
              <div className="mt-auto flex items-center justify-between pt-2 text-xs text-mute">
                <span className="tabular-nums">
                  {d.chunk_count} parça · {d.entity_count} varlık · {d.relation_count} ilişki · {(d.char_count / 1000).toFixed(1)}k karakter
                </span>
                <span className="flex gap-3">
                  {d.status !== "ready" && (d.error || !isRunning(d.id)) && (
                    <button className="text-accent hover:underline" onClick={() => start(d.id)}>
                      {d.error ? "Tekrar dene" : "Devam et"}
                    </button>
                  )}
                  <Link className="hover:text-ink" href={`/graph?doc=${d.id}`}>
                    Graf
                  </Link>
                  <button className="hover:text-red-300" onClick={() => remove(d.id)}>
                    Sil
                  </button>
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status, error }: { status: string; error: string | null }) {
  if (error) return <span className="chip border-red-500/40 text-red-300">Hata</span>;
  const ready = status === "ready";
  return (
    <span className={`chip gap-1.5 ${ready ? "border-emerald-500/40 text-emerald-300" : "text-amber-300"}`}>
      {!ready && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
