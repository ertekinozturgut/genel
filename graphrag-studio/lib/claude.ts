import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";
// Güvenlik sınıflandırıcısı bir isteği reddederse API isteği uygun modele otomatik devreder.
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** API anahtarı: önce ortam değişkeni, yoksa arayüzden gönderilen x-anthropic-key header'ı. */
export function claudeFor(req: Request): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY || req.headers.get("x-anthropic-key") || undefined;
  if (!apiKey) {
    throw new Error("Claude API anahtarı yok. Vercel'de ANTHROPIC_API_KEY tanımlayın veya Ayarlar sayfasından girin.");
  }
  return new Anthropic({ apiKey });
}

/** JSON şemasına uygun yapılandırılmış çıktı üretir. */
export async function structured<T>(
  client: Anthropic,
  opts: {
    system: string;
    prompt: string;
    schema: Record<string, unknown>;
    effort?: "low" | "medium" | "high";
    maxTokens?: number;
  },
): Promise<T> {
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: opts.system,
    output_config: {
      effort: opts.effort ?? "low",
      format: { type: "json_schema", schema: opts.schema },
    },
    messages: [{ role: "user", content: opts.prompt }],
  });
  if (res.stop_reason === "refusal") {
    throw new Error("Model bu içeriği işlemeyi reddetti.");
  }
  if (res.stop_reason === "max_tokens") {
    throw new Error("Yanıt token sınırına ulaştı; içerik çok uzun.");
  }
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(text) as T;
}

// ---------- Bilgi grafı çıkarımı ----------

export type ExtractedEntity = { name: string; type: string; description: string; chunks: number[] };
export type ExtractedRelation = { source: string; target: string; type: string; description: string; chunk: number };
export type Extraction = { entities: ExtractedEntity[]; relations: ExtractedRelation[] };

export const ENTITY_TYPES = [
  "Person",
  "Organization",
  "Location",
  "Product",
  "Technology",
  "Concept",
  "Event",
  "Process",
  "Metric",
  "Date",
  "Document",
  "Other",
];

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["entities", "relations"],
  properties: {
    entities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "type", "description", "chunks"],
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ENTITY_TYPES },
          description: { type: "string" },
          chunks: { type: "array", items: { type: "integer" } },
        },
      },
    },
    relations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source", "target", "type", "description", "chunk"],
        properties: {
          source: { type: "string" },
          target: { type: "string" },
          type: { type: "string" },
          description: { type: "string" },
          chunk: { type: "integer" },
        },
      },
    },
  },
};

const EXTRACTION_SYSTEM = `Sen bir bilgi grafı (knowledge graph) çıkarım motorusun. Sana numaralandırılmış metin parçaları (chunk) verilecek.
Görevin: metindeki önemli varlıkları (entity) ve aralarındaki ilişkileri (relation) çıkarmak.

Kurallar:
- Varlık adlarını metinde geçtiği dilde, kanonik ve kısa yaz (ör. "Toyota Türkiye", "RAG", "Ahmet Yılmaz"). Aynı varlığın farklı yazımlarını tek isimde birleştir.
- Zamir, genel ifade ("şirket", "sistem") veya önemsiz kelimeleri varlık yapma.
- description: varlığın bu metindeki rolünü anlatan 1-2 cümle (metnin dilinde).
- chunks: varlığın geçtiği chunk numaraları.
- İlişki type'ı BÜYÜK_HARF_SNAKE_CASE kısa bir fiil olsun (ör. WORKS_FOR, PART_OF, USES, LOCATED_IN, PRODUCES, DEPENDS_ON, CAUSES, OWNS, RELATED_TO).
- İlişkinin source ve target'ı mutlaka entities listesindeki isimlerden biri olmalı.
- Sadece metinde açıkça desteklenen ilişkileri yaz; uydurma.`;

export async function extractGraph(
  client: Anthropic,
  docTitle: string,
  chunks: { idx: number; content: string }[],
): Promise<Extraction> {
  const body = chunks.map((c) => `<chunk n="${c.idx}">\n${c.content}\n</chunk>`).join("\n\n");
  return structured<Extraction>(client, {
    system: EXTRACTION_SYSTEM,
    prompt: `Doküman: "${docTitle}"\n\n${body}\n\nBu parçalardan varlıkları ve ilişkileri çıkar.`,
    schema: extractionSchema,
    effort: "low",
  });
}

// ---------- Doküman analizi ----------

export type DocAnalysis = {
  title: string;
  summary: string;
  doc_type: string;
  language: string;
  keywords: string[];
  key_points: string[];
  suggested_questions: string[];
};

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "doc_type", "language", "keywords", "key_points", "suggested_questions"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    doc_type: { type: "string" },
    language: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
    key_points: { type: "array", items: { type: "string" } },
    suggested_questions: { type: "array", items: { type: "string" } },
  },
};

export async function analyzeDocument(
  client: Anthropic,
  filename: string,
  content: string,
  topEntities: string[],
): Promise<DocAnalysis> {
  const LIMIT = 60000;
  const excerpt =
    content.length > LIMIT
      ? `${content.slice(0, LIMIT * 0.7)}\n\n[... orta kısım kısaltıldı ...]\n\n${content.slice(-LIMIT * 0.3)}`
      : content;
  return structured<DocAnalysis>(client, {
    system:
      "Dokümanları analiz eden bir uzmansın. Çıktıyı Türkçe yaz (title hariç: title dokümanın kendi dilinde, kısa ve açıklayıcı olsun).",
    prompt: `Dosya adı: ${filename}
Grafta öne çıkan varlıklar: ${topEntities.join(", ") || "-"}

<document>
${excerpt}
</document>

Bu dokümanı analiz et:
- title: kısa açıklayıcı başlık
- summary: 4-8 cümlelik özet
- doc_type: doküman türü (ör. Rapor, Sözleşme, Makale, Teknik Doküman, Sunum, E-posta, Kılavuz, Veri)
- language: dil (ör. Türkçe, English)
- keywords: 5-12 anahtar kelime
- key_points: en önemli 3-7 bulgu/madde
- suggested_questions: bu dokümana sorulabilecek 4 iyi soru`,
    schema: analysisSchema,
    effort: "low",
  });
}
