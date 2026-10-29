"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, authHeaders } from "@/lib/client";
import { typeColor } from "@/lib/colors";

type Ctx = {
  chunks: {
    id: string;
    document_id: string;
    document_title: string;
    idx: number;
    content: string;
    vector_score: number | null;
    fts_score: number | null;
    graph_hits: number | null;
    sources: string[];
  }[];
  entities: { id: string; name: string; type: string; score: number }[];
  relations: { id: string; source: string; target: string; type: string; description: string | null }[];
  timings: Record<string, number>;
};
type Msg = { role: "user" | "assistant"; content: string; ctx?: Ctx; error?: string };

const STORE = "graphrag.chat";

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="text-mute">Yükleniyor…</div>}>
      <Chat />
    </Suspense>
  );
}

function Chat() {
  const sp = useSearchParams();
  const [docs, setDocs] = useState<{ id: string; title: string; status: string }[]>([]);
  const [scope, setScope] = useState<string[]>(sp.get("doc") ? [sp.get("doc")!] : []);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(sp.get("q") ?? "");
  const [busy, setBusy] = useState(false);
  const [inspect, setInspect] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ documents: { id: string; title: string; status: string }[] }>("/api/documents").then((r) => setDocs(r.documents));
    try {
      const saved = localStorage.getItem(STORE);
      if (saved && !sp.get("q")) setMessages(JSON.parse(saved));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    if (!busy) {
      try {
        localStorage.setItem(STORE, JSON.stringify(messages.slice(-40)));
      } catch {}
    }
  }, [messages, busy]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }, { role: "assistant", content: "" }];
    setMessages(next);
    setBusy(true);
    const ai = next.length - 1;
    const update = (fn: (m: Msg) => Msg) => setMessages((prev) => prev.map((m, i) => (i === ai ? fn(m) : m)));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          messages: next.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
          documentIds: scope.length ? scope : undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "context") update((m) => ({ ...m, ctx: ev as Ctx }));
          else if (ev.type === "text") update((m) => ({ ...m, content: m.content + ev.text }));
          else if (ev.type === "error") update((m) => ({ ...m, error: ev.error }));
        }
      }
    } catch (e) {
      update((m) => ({ ...m, error: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  const inspected = inspect != null ? messages[inspect]?.ctx : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="card flex h-[calc(100vh-8rem)] min-h-[480px] flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 text-sm">
          <span className="text-mute">Kapsam:</span>
          <select
            className="input w-auto max-w-xs py-1"
            value=""
            onChange={(e) => e.target.value && setScope((s) => (s.includes(e.target.value) ? s : [...s, e.target.value]))}
          >
            <option value="">{scope.length ? "+ doküman ekle" : "Tüm dokümanlar (filtre ekle)"}</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          {scope.map((id) => (
            <button key={id} className="chip hover:text-ink" onClick={() => setScope((s) => s.filter((x) => x !== id))}>
              {docs.find((d) => d.id === id)?.title ?? "…"} ✕
            </button>
          ))}
          <button
            className="ml-auto text-xs text-mute hover:text-ink"
            onClick={() => {
              setMessages([]);
              setInspect(null);
            }}
          >
            Sohbeti temizle
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 scroll-thin">
          {messages.length === 0 && (
            <div className="mx-auto mt-10 max-w-lg text-center text-sm text-mute">
              <div className="text-lg font-medium text-ink">Dokümanlarınızla konuşun</div>
              <p className="mt-2">
                Her soru için vektör araması, tam metin araması ve bilgi grafı birlikte kullanılır. Yanıtlardaki [C1] gibi
                etiketler kaynak parçalara işaret eder; sağ panelde bağlamı inceleyebilirsiniz.
              </p>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent/15 px-4 py-2.5 text-sm">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="max-w-[95%]">
                {m.content ? (
                  <div className="prose-chat text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  !m.error && <div className="text-sm text-mute">{m.ctx ? "Yanıt yazılıyor…" : "Bağlam aranıyor…"}</div>
                )}
                {m.error && <div className="mt-2 text-sm text-red-300">{m.error}</div>}
                {m.ctx && (
                  <button className="mt-2 text-xs text-accent hover:underline" onClick={() => setInspect(i)}>
                    {m.ctx.chunks.length} parça · {m.ctx.relations.length} graf ilişkisi kullanıldı — bağlamı incele
                  </button>
                )}
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>

        <form
          className="flex gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            className="input min-h-[44px] flex-1 resize-none"
            rows={1}
            placeholder="Sorunuzu yazın… (Enter gönder, Shift+Enter yeni satır)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className="btn-primary" disabled={busy || !input.trim()}>
            Gönder
          </button>
        </form>
      </div>

      <aside className="card h-[calc(100vh-8rem)] min-h-[480px] overflow-y-auto p-4 scroll-thin">
        {!inspected ? (
          <div className="text-sm text-mute">Bir yanıttaki &quot;bağlamı incele&quot; bağlantısına tıklayın.</div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-mute tabular-nums">
              Süreler: {Object.entries(inspected.timings).map(([k, v]) => `${k} ${v}ms`).join(" · ")}
            </div>
            <div>
              <div className="label mb-2">Eşleşen varlıklar</div>
              <div className="flex flex-wrap gap-1.5">
                {inspected.entities.slice(0, 12).map((e) => (
                  <span key={e.id} className={`chip gap-1.5 ${e.score >= 0.82 ? "text-ink" : "opacity-60"}`} title={`skor ${e.score.toFixed(3)}`}>
                    <span className="h-2 w-2 rounded-full" style={{ background: typeColor(e.type) }} />
                    {e.name}
                  </span>
                ))}
              </div>
            </div>
            {inspected.relations.length > 0 && (
              <div>
                <div className="label mb-2">Graf ilişkileri</div>
                <ul className="space-y-1 text-xs">
                  {inspected.relations.slice(0, 40).map((r) => (
                    <li key={r.id} className="text-mute">
                      <span className="text-ink">{r.source}</span> <span className="font-mono">-[{r.type}]→</span>{" "}
                      <span className="text-ink">{r.target}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <div className="label mb-2">Kaynak parçalar</div>
              <ul className="space-y-2">
                {inspected.chunks.map((c, i) => (
                  <li key={c.id} className="rounded-lg bg-panel-2 p-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <Link href={`/documents/${c.document_id}`} className="font-medium text-accent hover:underline">
                        [C{i + 1}] {c.document_title} #{c.idx}
                      </Link>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-mute tabular-nums">
                      {c.vector_score != null && <span className="chip">vektör {c.vector_score.toFixed(3)}</span>}
                      {c.fts_score != null && <span className="chip">metin {c.fts_score.toFixed(3)}</span>}
                      {c.graph_hits != null && <span className="chip">graf {c.graph_hits}</span>}
                    </div>
                    <p className="mt-1.5 line-clamp-6 whitespace-pre-wrap text-xs text-mute">{c.content}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
