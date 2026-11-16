import { backend, inDocs } from "./backend";
import type { Quest, QuestNotes, QuestView } from "./game";

const LOG = "10-decision-log.md";
const LOG_HEADING = "## Bible Quest";

type QuestFile = { version: number; quests: Quest[] };

const read = () => backend().getJSON<QuestFile>("quests", { version: 1, quests: [] });
const write = (data: QuestFile, by?: string) => backend().setJSON("quests", data, by);

export async function listQuests(): Promise<QuestView[]> {
  const b = backend();
  const [{ quests }, notes, docs] = await Promise.all([read(), b.allNotes(), b.listDocs()]);
  const paths = new Set(docs.map((d) => d.path));
  return quests.map((q) => {
    const started = q.status === "open" && !!notes[q.id];
    if (!q.file) return { ...q, fileExists: false, started };
    const fileExists = paths.has(q.file);
    return {
      ...q,
      fileExists,
      absPath: b.kind === "files" ? inDocs(q.file) : undefined,
      started: started || (q.status === "open" && fileExists),
    };
  });
}

async function appendLog(title: string, answer: string, when: Date, by?: string) {
  const date = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
  const [first, ...rest] = answer.trim().split("\n");
  const more = rest.filter((l) => l.trim()).map((l) => "  " + l.replace(/^\s+/, ""));
  const line = [`- ${date}. **${title}**: ${first}`, ...more].join("\n");
  let text = (await backend().readDoc(LOG))?.text ?? "# Decision log\n";
  if (!text.includes(LOG_HEADING)) {
    text = text.replace(/\s*$/, "") + `\n\n${LOG_HEADING}\n\nDecisions locked in with the Bible Quest tracker.\n`;
  }
  text = text.replace(/\s*$/, "") + `\n${line}\n`;
  await backend().writeDoc(LOG, text, by);
}

export async function completeQuest(id: string, answer: string, bonusXp = 0, outputText?: string | null, by?: string) {
  const data = await read();
  const quest = data.quests.find((q) => q.id === id);
  if (!quest) throw new Error("Unknown quest");
  if (quest.status === "done") return quest;
  const now = new Date();
  quest.status = "done";
  quest.answer = answer.trim();
  quest.doneAt = now.toISOString();
  quest.bonusXp = Math.max(0, Math.min(500, Math.round(bonusXp) || 0));
  if (quest.output && outputText) await writeDoc(quest.output, outputText, null, by);
  await write(data, by);
  await appendLog(quest.title, answer || "(done)", now, by);
  return quest;
}

export async function reopenQuest(id: string, by?: string) {
  const data = await read();
  const quest = data.quests.find((q) => q.id === id);
  if (!quest) throw new Error("Unknown quest");
  quest.status = "open";
  delete quest.doneAt;
  delete quest.bonusXp;
  await write(data, by);
  return quest;
}

export async function createSheet(id: string, by?: string) {
  const data = await read();
  const quest = data.quests.find((q) => q.id === id);
  if (!quest?.file) throw new Error("This quest has no sheet");
  if (await backend().readDoc(quest.file)) return quest.file;
  const name = quest.title.replace(/ sheet$/, "");
  let body = `# ${name}\n\nStatus: Draft\n\n${quest.prompt}\n`;
  if (quest.template) {
    const tpl = await backend().readDoc(`_templates/${quest.template}.md`);
    if (tpl) {
      body = tpl.text.replace(/\*name\*/, name);
      body = body.replace(/\n/, `\n\n> Quest: ${quest.prompt}\n`);
    }
  }
  await backend().writeDoc(quest.file, body, by);
  return quest.file;
}

export type DocEntry = { path: string; mtime: number; size: number };

export const listDocs = () => backend().listDocs();

function checkPath(rel: string) {
  if (!rel.endsWith(".md")) throw new Error("Only .md files");
  if (rel.split("/").some((p) => p === ".." || p === "") || rel.startsWith("/")) throw new Error("Bad path");
}

export async function readDoc(rel: string) {
  checkPath(rel);
  const doc = await backend().readDoc(rel);
  if (!doc) throw new Error("Not found");
  return { path: rel, ...doc };
}

export class ConflictError extends Error {
  constructor(public current: { text: string; mtime: number }) {
    super("The file changed since you opened it");
  }
}

export async function writeDoc(rel: string, text: string, baseMtime?: number | null, by?: string) {
  checkPath(rel);
  if (baseMtime != null) {
    const current = await backend().readDoc(rel);
    if (current && current.mtime !== baseMtime) throw new ConflictError(current);
  }
  const mtime = await backend().writeDoc(rel, text, by);
  return { path: rel, mtime };
}

export async function getNotes(questId: string): Promise<QuestNotes> {
  return ((await backend().getNote(questId)) as QuestNotes | null) ?? { overall: "", notes: [] };
}

export async function putNotes(questId: string, value: QuestNotes, by?: string) {
  const empty = !value.overall.trim() && value.notes.length === 0 && value.data == null;
  await backend().putNote(questId, empty ? null : value, by);
}

/** Adds a new open quest. Used by the MCP server. */
export async function addQuest(quest: Quest, by?: string) {
  const data = await read();
  if (data.quests.some((q) => q.id === quest.id)) throw new Error(`Quest ${quest.id} already exists`);
  data.quests.push(quest);
  await write(data, by);
  return quest;
}

/** Changes an open quest's text fields. */
export async function updateQuest(id: string, patch: Partial<Pick<Quest, "title" | "prompt" | "xp" | "context" | "layer">>, by?: string) {
  const data = await read();
  const quest = data.quests.find((q) => q.id === id);
  if (!quest) throw new Error("Unknown quest");
  Object.assign(quest, patch);
  await write(data, by);
  return quest;
}

/** Points a quest at a live UI (see lib/code-store.ts), or back at its built-in tool with code=null. */
export async function setQuestCode(id: string, code: string | null, by?: string) {
  const data = await read();
  const quest = data.quests.find((q) => q.id === id);
  if (!quest) throw new Error("Unknown quest");
  if (code) {
    if (quest.kind === "sheet" && !quest.widget) throw new Error("Sheet quests are written in the editor and cannot take a live UI");
    quest.widget = !quest.widget || quest.widget.type === "review" ? { type: "custom", code } : { ...quest.widget, code };
  } else if (quest.widget) {
    if (quest.widget.type === "custom") quest.widget = { type: "review" };
    else delete quest.widget.code;
  }
  await write(data, by);
  return quest;
}
