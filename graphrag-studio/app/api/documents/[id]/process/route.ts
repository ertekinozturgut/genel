import { claudeFor } from "@/lib/claude";
import { jsonError } from "@/lib/http";
import { processStep } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

/** İndeksleme hattını bir adım ilerletir. İstemci "ready" olana kadar tekrar çağırır. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const claude = claudeFor(req);
    const doc = await processStep(id, claude);
    const { content: _omit, ...rest } = doc;
    return Response.json({ document: rest });
  } catch (e) {
    return jsonError(e);
  }
}
