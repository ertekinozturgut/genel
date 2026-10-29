# GraphRAG Studio

Yüklenen dokümanları **otomatik analiz edip indeksleyen**, bunlardan bir **bilgi grafı (knowledge graph)** çıkaran ve
**GraphRAG** (vektör + tam metin + graf) ile dokümanlarla sohbet etmeyi sağlayan web uygulaması.

## Özellikler

- **Doküman yükleme:** PDF, DOCX, TXT, MD, CSV, JSON, HTML veya yapıştırılan metin.
- **Otomatik indeksleme hattı** (devam ettirilebilir, büyük dokümanlarda adım adım ilerler):
  1. Parçalama — paragraf/cümle sınırlarına saygılı, örtüşmeli ~1200 karakterlik chunk'lar
  2. Vektörleştirme — Supabase Edge Function üzerinde `gte-small` (384 boyut), pgvector HNSW indeksi
  3. Tam metin indeksi — Postgres `tsvector` + GIN
  4. Graf çıkarımı — Claude ile varlık (entity) ve ilişki (relation) çıkarımı; varlıklar dokümanlar arası birleştirilir
  5. Doküman analizi — başlık, özet, tür, dil, anahtar kelimeler, önemli noktalar, önerilen sorular
- **Bilgi Grafı görünümü:** etkileşimli force-directed graf; tür/doküman/isim filtreleri, komşu vurgulama,
  varlık detayı (ilişkiler + geçtiği parçalar).
- **İndeks Gezgini:** parçalar, varlıklar, ilişkiler tabloları ve **arama testi** (vektör/tam metin/graf skorları, RRF sıralaması).
- **Sohbet:** hibrit getirme (RRF) + graf komşuluğu ile bağlam; yanıtlar `[C1]` biçiminde kaynak gösterir,
  kullanılan bağlam sağ panelde incelenebilir. Doküman bazında kapsam filtresi.

## Mimari

```
Next.js 16 (App Router, Vercel)
 ├─ /api/documents            yükleme + metin çıkarma (unpdf, mammoth)
 ├─ /api/documents/[id]/process  indeksleme hattının bir adımı (istemci "ready" olana kadar çağırır)
 ├─ /api/chat                 hibrit GraphRAG getirme + Claude akışlı yanıt (NDJSON)
 ├─ /api/graph, /api/entities, /api/chunks, /api/search   graf/indeks inceleme
 └─ proxy.ts                  APP_PASSWORD ile opsiyonel site şifresi
Supabase
 ├─ Postgres + pgvector: documents, chunks, entities, entity_mentions, relations
 ├─ RPC: match_chunks, search_chunks_fts, match_entities, chunks_for_entities, graph_stats
 ├─ RLS: tüm tablolar yalnızca doğru x-app-secret header'ı ile erişilebilir
 └─ Edge Function `embed`: gte-small embedding
Claude API (claude-opus-5-5): graf çıkarımı (yapılandırılmış JSON çıktı), doküman analizi, sohbet
```

## Ortam değişkenleri

| Değişken | Açıklama |
|---|---|
| `SUPABASE_URL` | Supabase proje URL'i |
| `SUPABASE_ANON_KEY` | Supabase anon key (yalnızca sunucuda kullanılır) |
| `APP_SECRET` | `private.app_config` tablosundaki `app_secret` değeri |
| `ANTHROPIC_API_KEY` | Claude API anahtarı. Tanımlı değilse arayüzde **Ayarlar** sayfasından girilebilir |
| `APP_PASSWORD` | (opsiyonel) Site giriş şifresi |

## Geliştirme

```bash
npm install
cp .env.example .env.local   # değerleri doldurun
npm run dev
```

Veritabanı şeması `supabase/migrations/` altında, embedding fonksiyonu `supabase/functions/embed/` altındadır.
