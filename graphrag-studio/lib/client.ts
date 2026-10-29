"use client";

export const KEY_STORAGE = "graphrag.anthropicKey";

export function getStoredKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const key = getStoredKey();
  if (key) headers.set("x-anthropic-key", key);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/login")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export function authHeaders(): HeadersInit {
  const key = getStoredKey();
  return key ? { "x-anthropic-key": key } : {};
}

const running = new Set<string>();

/** Doküman "ready" olana kadar indeksleme adımlarını sırayla çalıştırır. */
export async function runPipeline(id: string, onUpdate?: (doc: Record<string, unknown>) => void) {
  if (running.has(id)) return;
  running.add(id);
  try {
    for (let i = 0; i < 500; i++) {
      const { document } = await api<{ document: Record<string, unknown> }>(`/api/documents/${id}/process`, { method: "POST" });
      onUpdate?.(document);
      if (document.status === "ready") break;
    }
  } finally {
    running.delete(id);
  }
}

export const isRunning = (id: string) => running.has(id);
