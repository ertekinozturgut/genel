export type Chunk = { idx: number; content: string; start: number; end: number };

/**
 * Paragraf/cümle sınırlarına saygı gösteren, örtüşmeli (overlap) parçalama.
 */
export function chunkText(text: string, size = 1200, overlap = 200): Chunk[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const chunks: Chunk[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const minCut = Math.floor(size * 0.5);
      const cuts = [window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(". "), window.lastIndexOf(" ")];
      const cut = cuts.find((c) => c >= minCut);
      if (cut !== undefined) end = start + cut + 1;
    }
    const content = clean.slice(start, end).trim();
    if (content) chunks.push({ idx: chunks.length, content, start, end });
    if (end >= clean.length) break;
    let nextStart = end - overlap;
    // örtüşmeyi kelime başına hizala
    const sp = clean.indexOf(" ", nextStart);
    if (sp !== -1 && sp < end) nextStart = sp + 1;
    start = Math.max(nextStart, start + 1);
  }
  return chunks;
}

export const estimateTokens = (s: string) => Math.ceil(s.length / 4);
