import { promises as fs } from "fs";
import path from "path";
import type { Quest, QuestNotes, QuestView } from "./game";

export const DOCS_DIR = path.resolve(
  process.env.BIBLE_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "game-docs"),
);
const QUESTS = path.join(DOCS_DIR, "quests.json");
const LOG = path.join(DOCS_DIR, "10-decision-log.md");
const LOG_HEADING = "## Bible Quest";

type QuestFile = { version: number; quests: Quest[] };

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function inDocs(rel: string) {
  const abs = path.resolve(DOCS_DIR, rel);
  if (!abs.startsWith(DOCS_DIR + path.sep)) throw new Error("Path outside game-docs");
  return abs;
}

async function read(): Promise<QuestFile> {
  return JSON.parse(await fs.readFile(QUESTS, "utf8"));
}

async function write(data: QuestFile) {
  const tmp = QUESTS + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n");
  await fs.rename(tmp, QUESTS);
}

export async function listQuests(): Promise<QuestView[]> {
  const { quests } = await read();
  const notes = await readAllNotes();
  return Promise.all(
    quests.map(async (q) => {
      const started = q.status === "open" && !!notes[q.id];
      if (!q.file) return { ...q, fileExists: false, started };
      const abs = inDocs(q.file);
      const fileExists = await exists(abs);
      return { ...q, fileExists, absPath: abs, started: started || (q.status === "open" && fileExists) };
    }),
  );
}

async function appendLog(title: string, answer: string, when: Date) {
  const date = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
  const [first, ...rest] = answer.trim().split("\n");
  const more = rest.filter((l) => l.trim()).map((l) => "  " + l.replace(/^\s+/, ""));
  const line = [`- ${date}. **${title}**: ${first}`, ...more].join("\n");
  let text = (await exists(LOG)) ? await fs.readFile(LOG, "utf8") : "# Decision log\n";
  if (!text.includes(LOG_HEADING)) {
    text = text.replace(/\s*$/, "") + `\n\n${LOG_HEADING}\n\nDecisions locked in with the Bible Quest tracker.\n`;
  }
  text = text.replace(/\s*$/, "") + `\n${line}\n`;
  await fs.writeFile(LOG, text);
}

export async function completeQuest(id: string, answer: string, bonusXp = 0, outputText?: string | null) {
  const data = await read();
  const quest = data.quests.find((q) => q.id === id);
  if (!quest) throw new Error("Unknown quest");
  if (quest.status === "done") return quest;
  const now = new Date();
  quest.status = "done";
  quest.answer = answer.trim();
  quest.doneAt = now.toISOString();
  quest.bonusXp = Math.max(0, Math.min(500, Math.round(bonusXp) || 0));
  if (quest.output && outputText) await writeDoc(quest.output, outputText, null);
  await write(data);
  await appendLog(quest.title, answer || "(done)", now);
  return quest;
}

export async function reopenQuest(id: string) {
  const data = await read();
  const quest = data.quests.find((q) => q.id === id);
  if (!quest) throw new Error("Unknown quest");
  quest.status = "open";
  delete quest.doneAt;
  delete quest.bonusXp;
  await write(data);
  return quest;
}

export async function createSheet(id: string) {
  const data = await read();
  const quest = data.quests.find((q) => q.id === id);
  if (!quest?.file) throw new Error("This quest has no sheet");
  const target = inDocs(quest.file);
  if (await exists(target)) return target;
  const name = quest.title.replace(/ sheet$/, "");
  let body = `# ${name}\n\nStatus: Draft\n\n${quest.prompt}\n`;
  if (quest.template) {
    const tpl = inDocs(path.join("_templates", `${quest.template}.md`));
    if (await exists(tpl)) {
      body = (await fs.readFile(tpl, "utf8")).replace(/\*name\*/, name);
      body = body.replace(/\n/, `\n\n> Quest: ${quest.prompt}\n`);
    }
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body);
  return target;
}

const SKIP_DIRS = new Set(["source", "node_modules", ".git"]);

export type DocEntry = { path: string; mtime: number; size: number };

export async function listDocs(): Promise<DocEntry[]> {
  const out: DocEntry[] = [];
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
}

function mdPath(rel: string) {
  if (!rel.endsWith(".md")) throw new Error("Only .md files");
  return inDocs(rel);
}

export async function readDoc(rel: string) {
  const abs = mdPath(rel);
  const [text, st] = await Promise.all([fs.readFile(abs, "utf8"), fs.stat(abs)]);
  return { path: rel, text, mtime: Math.round(st.mtimeMs) };
}

export class ConflictError extends Error {
  constructor(public current: { text: string; mtime: number }) {
    super("The file changed on disk since you opened it");
  }
}

export async function writeDoc(rel: string, text: string, baseMtime?: number | null) {
  const abs = mdPath(rel);
  if (baseMtime != null && (await exists(abs))) {
    const st = await fs.stat(abs);
    if (Math.round(st.mtimeMs) !== baseMtime) {
      throw new ConflictError({ text: await fs.readFile(abs, "utf8"), mtime: Math.round(st.mtimeMs) });
    }
  }
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, text);
  const st = await fs.stat(abs);
  return { path: rel, mtime: Math.round(st.mtimeMs) };
}

const NOTES = path.join(DOCS_DIR, "notes.json");

async function readAllNotes(): Promise<Record<string, QuestNotes>> {
  if (!(await exists(NOTES))) return {};
  return JSON.parse(await fs.readFile(NOTES, "utf8"));
}

export async function getNotes(questId: string): Promise<QuestNotes> {
  return (await readAllNotes())[questId] ?? { overall: "", notes: [] };
}

export async function putNotes(questId: string, value: QuestNotes) {
  const all = await readAllNotes();
  if (!value.overall.trim() && value.notes.length === 0 && value.data == null) delete all[questId];
  else all[questId] = value;
  const tmp = NOTES + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(all, null, 2) + "\n");
  await fs.rename(tmp, NOTES);
}
