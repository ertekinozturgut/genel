export function jsonError(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err);
  return Response.json({ error: message }, { status });
}
