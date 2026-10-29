create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.app_config (key text primary key, value text not null);

-- Uygulama sunucusu her istekte x-app-secret header'ı gönderir; RLS bunu kontrol eder.
create or replace function private.has_app_secret() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (current_setting('request.headers', true)::json ->> 'x-app-secret')
      = (select value from private.app_config where key = 'app_secret'),
    false)
$$;
grant usage on schema private to anon, authenticated;
grant execute on function private.has_app_secret() to anon, authenticated;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  filename text,
  mime_type text,
  content text not null,
  summary text,
  keywords text[] default '{}',
  doc_type text,
  language text,
  status text not null default 'pending',
  progress text,
  error text,
  char_count int default 0,
  chunk_count int default 0,
  entity_count int default 0,
  relation_count int default 0,
  extract_cursor int not null default 0,
  analysis jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  idx int not null,
  content text not null,
  char_start int,
  char_end int,
  token_estimate int,
  embedding extensions.vector(384),
  fts tsvector generated always as (to_tsvector('simple', content)) stored,
  created_at timestamptz default now()
);
create index chunks_document_idx on public.chunks(document_id, idx);
create index chunks_fts_idx on public.chunks using gin(fts);
create index chunks_embedding_idx on public.chunks using hnsw (embedding extensions.vector_cosine_ops);

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  type text not null default 'Concept',
  description text,
  mention_count int not null default 0,
  document_count int not null default 0,
  embedding extensions.vector(384),
  created_at timestamptz default now()
);
create index entities_name_trgm on public.entities using gin (normalized_name extensions.gin_trgm_ops);
create index entities_embedding_idx on public.entities using hnsw (embedding extensions.vector_cosine_ops);

create table public.entity_mentions (
  entity_id uuid not null references public.entities(id) on delete cascade,
  chunk_id uuid not null references public.chunks(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  primary key (entity_id, chunk_id)
);
create index entity_mentions_doc_idx on public.entity_mentions(document_id);
create index entity_mentions_chunk_idx on public.entity_mentions(chunk_id);

create table public.relations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.entities(id) on delete cascade,
  target_id uuid not null references public.entities(id) on delete cascade,
  type text not null,
  description text,
  weight real default 1,
  document_id uuid references public.documents(id) on delete cascade,
  chunk_id uuid references public.chunks(id) on delete cascade,
  created_at timestamptz default now()
);
create index relations_source_idx on public.relations(source_id);
create index relations_target_idx on public.relations(target_id);
create index relations_doc_idx on public.relations(document_id);

alter table public.documents enable row level security;
alter table public.chunks enable row level security;
alter table public.entities enable row level security;
alter table public.entity_mentions enable row level security;
alter table public.relations enable row level security;

create policy app_all on public.documents for all to anon using (private.has_app_secret()) with check (private.has_app_secret());
create policy app_all on public.chunks for all to anon using (private.has_app_secret()) with check (private.has_app_secret());
create policy app_all on public.entities for all to anon using (private.has_app_secret()) with check (private.has_app_secret());
create policy app_all on public.entity_mentions for all to anon using (private.has_app_secret()) with check (private.has_app_secret());
create policy app_all on public.relations for all to anon using (private.has_app_secret()) with check (private.has_app_secret());

create or replace function public.match_chunks(query_embedding extensions.vector(384), match_count int default 10, filter_document_ids uuid[] default null)
returns table (id uuid, document_id uuid, idx int, content text, similarity float)
language sql stable set search_path = public, extensions as $$
  select c.id, c.document_id, c.idx, c.content, 1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.embedding is not null
    and (filter_document_ids is null or c.document_id = any(filter_document_ids))
  order by c.embedding <=> query_embedding
  limit match_count
$$;

create or replace function public.search_chunks_fts(query_text text, match_count int default 10, filter_document_ids uuid[] default null)
returns table (id uuid, document_id uuid, idx int, content text, rank float)
language sql stable set search_path = public, extensions as $$
  select c.id, c.document_id, c.idx, c.content, ts_rank_cd(c.fts, q)::float as rank
  from chunks c, websearch_to_tsquery('simple', query_text) q
  where c.fts @@ q
    and (filter_document_ids is null or c.document_id = any(filter_document_ids))
  order by rank desc
  limit match_count
$$;

create or replace function public.match_entities(query_embedding extensions.vector(384), query_text text, match_count int default 10)
returns table (id uuid, name text, type text, description text, mention_count int, score float)
language sql stable set search_path = public, extensions as $$
  select e.id, e.name, e.type, e.description, e.mention_count,
    greatest(
      coalesce(1 - (e.embedding <=> query_embedding), 0),
      case when position(e.normalized_name in lower(query_text)) > 0 and length(e.normalized_name) > 2 then 1.0 else 0 end,
      extensions.word_similarity(e.normalized_name, lower(query_text))
    )::float as score
  from entities e
  order by score desc
  limit match_count
$$;

create or replace function public.chunks_for_entities(entity_ids uuid[], match_count int default 6, exclude_ids uuid[] default '{}')
returns table (id uuid, document_id uuid, idx int, content text, hits int)
language sql stable set search_path = public as $$
  select c.id, c.document_id, c.idx, c.content, count(*)::int as hits
  from entity_mentions m join chunks c on c.id = m.chunk_id
  where m.entity_id = any(entity_ids) and not (c.id = any(exclude_ids))
  group by c.id
  order by hits desc, c.idx
  limit match_count
$$;

create or replace function public.graph_stats()
returns json language sql stable set search_path = public as $$
  select json_build_object(
    'documents', (select count(*) from documents),
    'chunks', (select count(*) from chunks),
    'entities', (select count(*) from entities),
    'relations', (select count(*) from relations),
    'entity_types', (select coalesce(json_object_agg(type, n), '{}'::json) from (select type, count(*) n from entities group by type) t),
    'relation_types', (select coalesce(json_object_agg(type, n), '{}'::json) from (select type, count(*) n from relations group by type order by n desc limit 25) t)
  )
$$;

create or replace function public.cleanup_orphan_entities()
returns int language sql volatile set search_path = public as $$
  with del as (
    delete from entities e
    where not exists (select 1 from entity_mentions m where m.entity_id = e.id)
      and not exists (select 1 from relations r where r.source_id = e.id or r.target_id = e.id)
    returning 1)
  select count(*)::int from del
$$;

create or replace function public.recount_entity_mentions()
returns void language sql volatile set search_path = public as $$
  update entities e set
    mention_count = coalesce((select count(*) from entity_mentions m where m.entity_id = e.id), 0),
    document_count = coalesce((select count(distinct m.document_id) from entity_mentions m where m.entity_id = e.id), 0)
  where true
$$;

insert into private.app_config(key, value) values ('app_secret', encode(extensions.gen_random_bytes(24), 'hex'));
