// Writes the Neon database back out to ../game-docs, so git keeps a readable copy.
// Usage: DATABASE_URL=... node scripts/export-db.mjs
import { neon } from "@neondatabase/serverless";
import { promises as fs } from "fs";
import path from "path";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL");
const sql = neon(url);
const dir = path.resolve(process.env.BIBLE_DIR ?? path.join(process.cwd(), "..", "game-docs"));

for (const row of await sql`SELECT path, text FROM docs`) {
  const abs = path.resolve(dir, row.path);
  if (!abs.startsWith(dir + path.sep)) continue;
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, row.text);
}
const [q] = await sql`SELECT value FROM kv WHERE key = 'quests'`;
if (q) await fs.writeFile(path.join(dir, "quests.json"), JSON.stringify(q.value, null, 2) + "\n");
const notes = {};
for (const row of await sql`SELECT key, value FROM kv WHERE key LIKE 'notes:%' ORDER BY key`) notes[row.key.slice(6)] = row.value;
await fs.writeFile(path.join(dir, "notes.json"), JSON.stringify(notes, null, 2) + "\n");
console.log("Exported to", dir);
