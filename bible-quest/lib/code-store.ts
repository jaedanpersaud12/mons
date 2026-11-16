// Live UI: widget source kept in the database (or game-docs in files mode), so the
// interface of a quest can be changed without a deploy. Every save is a new version.
import { backend } from "./backend";
import { UI_SEEDS } from "./ui-seeds";

export type CodeVersion = { v: number; source: string; note: string; at: string; by: string };
export type CodeEntry = { id: string; title: string; current: number; versions: CodeVersion[] };
export type CodeSummary = { id: string; title: string; current: number; versions: Omit<CodeVersion, "source">[] };

const KEEP = 30;
const MAX_BYTES = 200_000;
const INDEX = "code-index";
export const codeKey = (id: string) => `code-${id}`;

function checkId(id: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(id) || id === "index") throw new Error("Code ids are lowercase letters, numbers and dashes, e.g. island-board");
}

/** Compiles without running, so a typo is refused at save time instead of going live. */
export function syntaxError(source: string): string | null {
  try {
    new Function("html", "ui", source);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

function seeded(id: string): CodeEntry | null {
  const seed = UI_SEEDS[id];
  if (!seed) return null;
  return { id, title: seed.title, current: 0, versions: [{ v: 0, source: seed.source, note: "Shipped with the app", at: "", by: "app" }] };
}

export async function getCode(id: string): Promise<CodeEntry | null> {
  checkId(id);
  const stored = await backend().getJSON<CodeEntry | null>(codeKey(id), null);
  const seed = seeded(id);
  if (!stored) return seed;
  // Keep the shipped version reachable as v0 so there is always something to roll back to.
  if (seed && !stored.versions.some((x) => x.v === 0)) return { ...stored, versions: [...seed.versions, ...stored.versions] };
  return stored;
}

export async function currentCode(id: string) {
  const entry = await getCode(id);
  if (!entry) return null;
  const cur = entry.versions.find((x) => x.v === entry.current) ?? entry.versions[entry.versions.length - 1];
  return { entry, cur };
}

export const summarise = (e: CodeEntry): CodeSummary => ({
  id: e.id,
  title: e.title,
  current: e.current,
  versions: e.versions.map(({ v, note, at, by }) => ({ v, note, at, by })),
});

export async function listCode(): Promise<CodeSummary[]> {
  const ids = new Set([...(await backend().getJSON<string[]>(INDEX, [])), ...Object.keys(UI_SEEDS)]);
  const out: CodeSummary[] = [];
  for (const id of [...ids].sort()) {
    const e = await getCode(id);
    if (e) out.push(summarise(e));
  }
  return out;
}

export async function saveCode(id: string, source: string, note: string, by = "mcp", title?: string) {
  checkId(id);
  if (source.length > MAX_BYTES) throw new Error(`Source is too large (${source.length} characters, limit ${MAX_BYTES})`);
  const bad = syntaxError(source);
  if (bad) throw new Error(`Not saved, the code does not parse: ${bad}`);
  if (!/\bfunction\s+Widget\b|\bWidget\s*=/.test(source)) throw new Error("Not saved: the code must define function Widget({ data, save, ctx })");
  const b = backend();
  const existing = await b.getJSON<CodeEntry | null>(codeKey(id), null);
  const versions = existing?.versions ?? [];
  const v = Math.max(0, ...versions.map((x) => x.v)) + 1;
  const entry: CodeEntry = {
    id,
    title: title ?? existing?.title ?? UI_SEEDS[id]?.title ?? id,
    current: v,
    versions: [...versions, { v, source, note: note.trim() || "No note", at: new Date().toISOString(), by }].slice(-KEEP),
  };
  await b.setJSON(codeKey(id), entry, by);
  const index = await b.getJSON<string[]>(INDEX, []);
  if (!index.includes(id)) await b.setJSON(INDEX, [...index, id], by);
  return summarise(entry);
}

/** Points the live UI at an older version. Nothing is deleted, so you can roll forward again. */
export async function rollbackCode(id: string, version: number, by = "mcp") {
  const entry = await getCode(id);
  if (!entry) throw new Error(`No code called ${id}`);
  if (!entry.versions.some((x) => x.v === version)) throw new Error(`${id} has no version ${version}. It has: ${entry.versions.map((x) => x.v).join(", ")}`);
  const next: CodeEntry = { ...entry, current: version, versions: entry.versions.filter((x) => x.v !== 0) };
  await backend().setJSON(codeKey(id), next, by);
  const index = await backend().getJSON<string[]>(INDEX, []);
  if (!index.includes(id)) await backend().setJSON(INDEX, [...index, id], by);
  return summarise({ ...next, versions: entry.versions });
}
