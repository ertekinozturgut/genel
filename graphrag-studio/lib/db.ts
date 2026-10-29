import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Sunucu tarafı Supabase istemcisi. RLS, x-app-secret header'ını doğrular. */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const secret = process.env.APP_SECRET;
  if (!url || !key || !secret) {
    throw new Error("SUPABASE_URL, SUPABASE_ANON_KEY ve APP_SECRET ortam değişkenleri gerekli");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-app-secret": secret } },
  });
  return client;
}

export function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export type DocumentRow = {
  id: string;
  title: string;
  filename: string | null;
  mime_type: string | null;
  content?: string;
  summary: string | null;
  keywords: string[] | null;
  doc_type: string | null;
  language: string | null;
  status: string;
  progress: string | null;
  error: string | null;
  char_count: number;
  chunk_count: number;
  entity_count: number;
  relation_count: number;
  extract_cursor: number;
  analysis: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export const DOC_LIST_COLUMNS =
  "id,title,filename,mime_type,summary,keywords,doc_type,language,status,progress,error,char_count,chunk_count,entity_count,relation_count,extract_cursor,analysis,created_at,updated_at";
