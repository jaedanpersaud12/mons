-- Run once on a new Neon database (Postgres 18, Realtime enabled).
CREATE TABLE IF NOT EXISTS docs (path text PRIMARY KEY, text text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS kv (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS revisions (scope text PRIMARY KEY, rev bigint NOT NULL DEFAULT 1, by_client text);
