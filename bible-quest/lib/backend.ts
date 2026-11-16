// Where Bible Quest keeps its data.
//   DATABASE_URL set  -> Neon Postgres (deployed, and synced between machines)
//   otherwise         -> the ../game-docs folder, as before
import { promises as fs } from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

export type DocMeta = { path: string; mtime: number; size: number };
export type DocBody = { text: string; mtime: number };

export interface Backend {
  readonly kind: "db" | "files";
  getJSON<T>(key: string, fallback: T): Promise<T>;
  setJSON(key: string, value: unknown, by?: string): Promise<void>;
  listDocs(): Promise<DocMeta[]>;
  readDoc(rel: string): Promise<DocBody | null>;
  writeDoc(rel: string, text: string, by?: string): Promise<number>;
  allNotes(): Promise<Record<string, unknown>>;
  getNote(id: string): Promise<unknown | null>;
  putNote(id: string, value: unknown | null, by?: string): Promise<void>;
}

/* ---------------- Postgres ---------------- */

function dbBackend(url: string): Backend {
  const sql = neon(url);
  const bump = (scope: string, by?: string) =>
    sql`INSERT INTO revisions (scope, rev, by_client) VALUES (${scope}, 1, ${by ?? null})
        ON CONFLICT (scope) DO UPDATE SET rev = revisions.rev + 1, by_client = EXCLUDED.by_client`;
  return {
    kind: "db",
    async getJSON<T>(key: string, fallback: T) {
      const rows = await sql`SELECT value FROM kv WHERE key = ${key}`;
      return rows.length ? (rows[0].value as T) : fallback;
    },
    async setJSON(key, value, by) {
      await sql`INSERT INTO kv (key, value, updated_at) VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
      await bump(key, by);
    },
    async listDocs() {
      const rows = await sql`SELECT path, length(text) AS size, updated_at FROM docs ORDER BY path`;
      return rows.map((r) => ({ path: r.path as string, size: Number(r.size), mtime: new Date(r.updated_at as string).getTime() }));
    },
    async readDoc(rel) {
      const rows = await sql`SELECT text, updated_at FROM docs WHERE path = ${rel}`;
      return rows.length ? { text: rows[0].text as string, mtime: new Date(rows[0].updated_at as string).getTime() } : null;
    },
    async writeDoc(rel, text, by) {
      const rows = await sql`INSERT INTO docs (path, text, updated_at) VALUES (${rel}, ${text}, now())
                             ON CONFLICT (path) DO UPDATE SET text = EXCLUDED.text, updated_at = now()
                             RETURNING updated_at`;
      await bump(`doc:${rel}`, by);
      return new Date(rows[0].updated_at as string).getTime();
    },
    async allNotes() {
      const rows = await sql`SELECT key, value FROM kv WHERE key LIKE 'notes:%'`;
      return Object.fromEntries(rows.map((r) => [(r.key as string).slice(6), r.value]));
    },
    async getNote(id) {
      const rows = await sql`SELECT value FROM kv WHERE key = ${"notes:" + id}`;
      return rows.length ? rows[0].value : null;
    },
    async putNote(id, value, by) {
      if (value == null) await sql`DELETE FROM kv WHERE key = ${"notes:" + id}`;
      else
        await sql`INSERT INTO kv (key, value, updated_at) VALUES (${"notes:" + id}, ${JSON.stringify(value)}::jsonb, now())
                  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
      await bump(`notes:${id}`, by);
    },
  };
}

/* ---------------- Files ---------------- */

export const DOCS_DIR = path.resolve(
  process.env.BIBLE_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "game-docs"),
);
const SKIP_DIRS = new Set(["source", "node_modules", ".git"]);
const FILE_FOR_KEY: Record<string, string> = { quests: "quests.json", notes: "notes.json" };

export function inDocs(rel: string) {
  const abs = path.resolve(DOCS_DIR, rel);
  if (!abs.startsWith(DOCS_DIR + path.sep)) throw new Error("Path outside game-docs");
  return abs;
}

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function filesBackend(): Backend {
  return {
    kind: "files",
    async getJSON<T>(key: string, fallback: T) {
      const abs = path.join(DOCS_DIR, FILE_FOR_KEY[key] ?? `${key}.json`);
      return (await exists(abs)) ? (JSON.parse(await fs.readFile(abs, "utf8")) as T) : fallback;
    },
    async setJSON(key, value) {
      const abs = path.join(DOCS_DIR, FILE_FOR_KEY[key] ?? `${key}.json`);
      await fs.writeFile(abs + ".tmp", JSON.stringify(value, null, 2) + "\n");
      await fs.rename(abs + ".tmp", abs);
    },
    async listDocs() {
      const out: DocMeta[] = [];
      async function walk(dir: string, rel: string) {
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
          if (entry.name.startsWith(".")) continue;
          const abs = path.join(dir, entry.name);
          const r = rel ? `${rel}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) await walk(abs, r);
          } else if (entry.name.endsWith(".md")) {
            const st = await fs.stat(abs);
            out.push({ path: r, mtime: Math.round(st.mtimeMs), size: st.size });
          }
        }
      }
      await walk(DOCS_DIR, "");
      return out.sort((a, b) => a.path.localeCompare(b.path));
    },
    async readDoc(rel) {
      const abs = inDocs(rel);
      if (!(await exists(abs))) return null;
      const [text, st] = await Promise.all([fs.readFile(abs, "utf8"), fs.stat(abs)]);
      return { text, mtime: Math.round(st.mtimeMs) };
    },
    async writeDoc(rel, text) {
      const abs = inDocs(rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, text);
      return Math.round((await fs.stat(abs)).mtimeMs);
    },
    async allNotes() {
      return this.getJSON<Record<string, unknown>>("notes", {});
    },
    async getNote(id) {
      return (await this.allNotes())[id] ?? null;
    },
    async putNote(id, value) {
      const all = await this.allNotes();
      if (value == null) delete all[id];
      else all[id] = value;
      await this.setJSON("notes", all);
    },
  };
}

let cached: Backend | null = null;
export function backend(): Backend {
  if (!cached) cached = process.env.DATABASE_URL ? dbBackend(process.env.DATABASE_URL) : filesBackend();
  return cached;
}
