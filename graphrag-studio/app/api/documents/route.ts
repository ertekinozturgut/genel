import { db, must, DOC_LIST_COLUMNS } from "@/lib/db";
import { extractText } from "@/lib/extract";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const docs = must(await db().from("documents").select(DOC_LIST_COLUMNS).order("created_at", { ascending: false }));
    return Response.json({ documents: docs });
  } catch (e) {
    return jsonError(e);
  }
}

/** Dosya yükleme (multipart: files[]) veya düz metin (JSON: {title, text}). */
export async function POST(req: Request) {
  try {
    const supa = db();
    const created: { id: string; title: string }[] = [];
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const { title, text } = (await req.json()) as { title?: string; text?: string };
      if (!text?.trim()) return jsonError("Metin boş", 400);
      const row = must(
        await supa
          .from("documents")
          .insert({ title: title?.trim() || text.trim().slice(0, 60), filename: null, mime_type: "text/plain", content: text, char_count: text.length })
          .select("id,title")
          .single(),
      );
      created.push(row as { id: string; title: string });
    } else {
      const form = await req.formData();
      const files = form.getAll("files").filter((f): f is File => f instanceof File);
      if (!files.length) return jsonError("Dosya yok", 400);
      for (const file of files) {
        const { text, mime } = await extractText(file);
        if (!text.trim()) throw new Error(`${file.name}: metin çıkarılamadı (taranmış PDF olabilir)`);
        const row = must(
          await supa
            .from("documents")
            .insert({
              title: file.name.replace(/\.[^.]+$/, ""),
              filename: file.name,
              mime_type: mime,
              content: text.replace(/\u0000/g, ""),
              char_count: text.length,
            })
            .select("id,title")
            .single(),
        );
        created.push(row as { id: string; title: string });
      }
    }
    return Response.json({ created });
  } catch (e) {
    return jsonError(e);
  }
}
