import type Anthropic from "@anthropic-ai/sdk";
import { claudeFor, FALLBACK_BETA, MODEL } from "@/lib/claude";
import { jsonError } from "@/lib/http";
import { retrieve } from "@/lib/retrieve";

export const runtime = "nodejs";
export const maxDuration = 300;

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM = `Sen kullanıcının yüklediği dokümanlar üzerinde çalışan bir GraphRAG asistanısın.
Her soruda sana iki tür bağlam verilir:
1) <chunks>: hibrit aramayla (vektör + tam metin + bilgi grafı) bulunan doküman parçaları. Her biri [C1], [C2]... şeklinde etiketlidir.
2) <graph>: sorudaki varlıklarla ilgili bilgi grafı ilişkileri (Varlık -[İLİŞKİ]-> Varlık).

Kurallar:
- Yanıtı yalnızca bu bağlama dayandır. Bağlamda olmayan bilgiyi uydurma; yoksa açıkça "dokümanlarda bu bilgi yok" de.
- İddialarını köşeli parantezle kaynak göstererek destekle, ör. "... artmıştır [C2][C5]".
- İlişkisel sorularda (kim kiminle, neye bağlı, nasıl etkiler) graf ilişkilerini kullan ve zincirleri açıkla.
- Kullanıcının dilinde yanıt ver (varsayılan Türkçe). Markdown kullan; gerektiğinde liste ve tablo kullan.`;

export async function POST(req: Request) {
  let claude: Anthropic;
  let body: { messages: ChatMessage[]; documentIds?: string[] };
  try {
    claude = claudeFor(req);
    body = await req.json();
  } catch (e) {
    return jsonError(e, 400);
  }
  const history = (body.messages ?? []).filter((m) => m.content?.trim()).slice(-12);
  const last = history.at(-1);
  if (!last || last.role !== "user") return jsonError("Son mesaj kullanıcıdan olmalı", 400);

  // Kısa takip sorularında önceki soruyu da aramaya kat
  const prevUser = history.slice(0, -1).reverse().find((m) => m.role === "user");
  const searchQuery = last.content.length < 60 && prevUser ? `${prevUser.content}\n${last.content}` : last.content;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const r = await retrieve(searchQuery, { k: 8, documentIds: body.documentIds });
        send({ type: "context", ...r });

        const chunkBlock = r.chunks
          .map((c, i) => `[C${i + 1}] (Doküman: "${c.document_title}", parça #${c.idx})\n${c.content}`)
          .join("\n\n---\n\n");
        const graphBlock = r.relations
          .slice(0, 40)
          .map((rel) => `${rel.source} -[${rel.type}]-> ${rel.target}${rel.description ? `: ${rel.description}` : ""}`)
          .join("\n");
        const entityBlock = r.entities
          .filter((e) => e.score >= 0.82)
          .slice(0, 8)
          .map((e) => `- ${e.name} (${e.type}): ${e.description ?? ""}`)
          .join("\n");

        const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
        messages.push({
          role: "user",
          content: `<chunks>\n${chunkBlock || "(eşleşen parça yok)"}\n</chunks>\n\n<graph>\nİlgili varlıklar:\n${entityBlock || "-"}\n\nİlişkiler:\n${graphBlock || "-"}\n</graph>\n\nSoru: ${last.content}`,
        });

        const s = claude.beta.messages.stream({
          model: MODEL,
          max_tokens: 64000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          system: SYSTEM,
          output_config: { effort: "medium" },
          messages,
        });
        for await (const ev of s) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            send({ type: "text", text: ev.delta.text });
          }
        }
        const final = await s.finalMessage();
        if (final.stop_reason === "refusal") send({ type: "text", text: "\n\n_(Model bu isteği yanıtlamayı reddetti.)_" });
        send({ type: "done", usage: final.usage });
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
