/** Yüklenen dosyalardan düz metin çıkarır. */
export async function extractText(file: File): Promise<{ text: string; mime: string }> {
  const name = file.name.toLowerCase();
  const mime = file.type || guessMime(name);
  const buf = new Uint8Array(await file.arrayBuffer());

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buf);
    const { text } = await pdfText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    return { text: pages.map((p, i) => `[Sayfa ${i + 1}]\n${p}`).join("\n\n"), mime: "application/pdf" };
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    return { text: value, mime };
  }
  const raw = new TextDecoder("utf-8").decode(buf);
  if (name.endsWith(".html") || name.endsWith(".htm") || mime === "text/html") {
    return { text: htmlToText(raw), mime: "text/html" };
  }
  return { text: raw, mime: mime || "text/plain" };
}

function guessMime(name: string): string {
  if (name.endsWith(".md")) return "text/markdown";
  if (name.endsWith(".csv")) return "text/csv";
  if (name.endsWith(".json")) return "application/json";
  if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "text/plain";
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<(br|\/p|\/div|\/h\d|\/li|\/tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}
