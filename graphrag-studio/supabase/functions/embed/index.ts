import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// gte-small: 384 boyutlu, ücretsiz, Supabase üzerinde çalışan embedding modeli
const session = new Supabase.ai.Session("gte-small");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const body = await req.json();
    const texts: string[] = Array.isArray(body.texts) ? body.texts : [String(body.text ?? "")];
    if (texts.length > 64) {
      return Response.json({ error: "max 64 texts per request" }, { status: 400 });
    }
    const embeddings: number[][] = [];
    for (const t of texts) {
      const e = await session.run(t.slice(0, 2000), { mean_pool: true, normalize: true });
      embeddings.push(Array.from(e as number[]));
    }
    return Response.json({ embeddings });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
