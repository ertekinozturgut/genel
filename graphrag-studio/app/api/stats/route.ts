import { db, must } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const stats = must(await db().rpc("graph_stats"));
    return Response.json({ stats, server_key: Boolean(process.env.ANTHROPIC_API_KEY) });
  } catch (e) {
    return jsonError(e);
  }
}
