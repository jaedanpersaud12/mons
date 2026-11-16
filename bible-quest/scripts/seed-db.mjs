// Copies ../game-docs into the Neon database: every .md doc, quests.json and notes.json.
// Usage: DATABASE_URL=... node scripts/seed-db.mjs [--force]
// Without --force it refuses to overwrite a database that already has quests.
import { neon } from "@neondatabase/serverless";
import { promises as fs } from "fs";
import path from "path";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL");
const sql = neon(url);
const dir = path.resolve(process.env.BIBLE_DIR ?? path.join(process.cwd(), "..", "game-docs"));
const force = process.argv.includes("--force");

const existing = await sql`SELECT 1 FROM kv WHERE key = 'quests'`;
if (existing.length && !force) {
  console.error("The database already has quests. Pass --force to overwrite them with the files.");
  process.exit(1);
}

async function walk(d, rel = "") {
  const out = [];
  for (const e of await fs.readdir(d, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "source") continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(path.join(d, e.name), r)));
    else if (e.name.endsWith(".md")) out.push(r);
  }
  return out;
}

const bump = (scope) =>
  sql`INSERT INTO revisions (scope, rev, by_client) VALUES (${scope}, 1, 'seed')
      ON CONFLICT (scope) DO UPDATE SET rev = revisions.rev + 1, by_client = 'seed'`;

for (const rel of await walk(dir)) {
  const text = await fs.readFile(path.join(dir, rel), "utf8");
  await sql`INSERT INTO docs (path, text) VALUES (${rel}, ${text}) ON CONFLICT (path) DO UPDATE SET text = EXCLUDED.text, updated_at = now()`;
  await bump(`doc:${rel}`);
  console.log("doc", rel);
}
const quests = JSON.parse(await fs.readFile(path.join(dir, "quests.json"), "utf8"));
await sql`INSERT INTO kv (key, value) VALUES ('quests', ${JSON.stringify(quests)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
await bump("quests");
let notes = {};
try {
  notes = JSON.parse(await fs.readFile(path.join(dir, "notes.json"), "utf8"));
} catch {}
for (const [id, value] of Object.entries(notes)) {
  await sql`INSERT INTO kv (key, value) VALUES (${"notes:" + id}, ${JSON.stringify(value)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  await bump(`notes:${id}`);
}
console.log(`Seeded ${quests.quests.length} quests and ${Object.keys(notes).length} notes entries.`);
