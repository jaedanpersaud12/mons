// The Bible Quest MCP server: lets Claude (or any MCP client) read and write the bible.
// Every write goes through lib/store with by="mcp", so open tabs update live.
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { LAYERS, RANKS, VERDICTS, composeAnswer, isUnlocked, layerStats, nextQuest, rankFor, streak, totalXp, type LayerId, type Quest, type QuestNote } from "./game";
import { extract, parseRef } from "./sections";
import {
  addQuest,
  completeQuest,
  createSheet,
  getNotes,
  listDocs,
  listQuests,
  putNotes,
  readDoc,
  reopenQuest,
  updateQuest,
  writeDoc,
} from "./store";
import { asTypes, objectivesFor, widgetAnswer, widgetOutput, type Ctx } from "./widgets";

const BY = "mcp";

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });

async function safe<T>(fn: () => Promise<T>) {
  try {
    return text(await fn());
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

/** Plain text of a markdown line, the way the reader shows it (so inline notes anchor). */
const plain = (s: string) =>
  s
    .replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|`|~~)/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function sectionsFor(quest: Quest) {
  const cache = new Map<string, string | null>();
  const out = [];
  for (const ref of quest.context ?? []) {
    const { file } = parseRef(ref);
    if (!cache.has(file)) cache.set(file, await readDoc(file).then((d) => d.text, () => null));
    const t = cache.get(file);
    out.push(t == null ? { ref, missing: true } : extract(ref, t));
  }
  return out;
}

async function ctxFor(quest: Quest & { fileExists?: boolean }) {
  const [notes, typesNotes] = await Promise.all([getNotes(quest.id), quest.id === "types" ? null : getNotes("types")]);
  const types = asTypes(quest.id === "types" ? notes.data : typesNotes?.data);
  let sheetWords = 0;
  if (quest.file && quest.fileExists) {
    const doc = await readDoc(quest.file).catch(() => null);
    sheetWords = doc?.text.trim() ? doc.text.trim().split(/\s+/).length : 0;
  }
  const sections = await sectionsFor(quest);
  const heads = sections.flatMap((s) => ("heading" in s && s.heading ? [{ ref: s.ref, section: s.heading }] : []));
  const ctx: Ctx = { types, notes: notes.notes, overall: notes.overall, heads, sheetExists: !!quest.fileExists, sheetWords };
  return { ctx, notes, sections };
}

async function findQuest(id: string) {
  const quests = await listQuests();
  const q = quests.find((x) => x.id === id);
  if (!q) {
    const close = quests.filter((x) => x.id.includes(id) || x.title.toLowerCase().includes(id.toLowerCase())).map((x) => `${x.id} (${x.title})`);
    throw new Error(`Unknown quest "${id}".${close.length ? ` Did you mean: ${close.slice(0, 5).join(", ")}` : ""}`);
  }
  return { q, quests };
}

const brief = (q: Quest) => ({ id: q.id, title: q.title, layer: q.layer, xp: q.xp, kind: q.kind, status: q.status, widget: q.widget?.type ?? null });

export function registerBibleTools(server: McpServer) {
  server.registerTool(
    "bible_overview",
    {
      title: "Bible overview",
      description:
        "Start here. Progress through the game bible for Jaedan's creature RPG: XP, rank, each layer's status, the next quests, and the list of docs. Layers unlock in order: Rules → Skeleton → Islands and cast / Systems → Content.",
      inputSchema: z.object({}),
    },
    () =>
      safe(async () => {
        const [quests, docs] = await Promise.all([listQuests(), listDocs()]);
        const xp = totalXp(quests);
        const rank = rankFor(xp);
        const next = nextQuest(quests);
        return {
          xp,
          rank: `${rank.title} (level ${rank.level}${rank.next ? `, ${rank.next.xp - xp} XP to ${rank.next.title}` : ""})`,
          streakDays: streak(quests),
          done: `${quests.filter((q) => q.status === "done").length}/${quests.length}`,
          layers: LAYERS.map((l) => ({ id: l.id, name: l.name, blurb: l.blurb, unlocked: isUnlocked(quests, l.id), ...layerStats(quests, l.id) })),
          suggestedNext: next ? brief(next) : null,
          openInUnlockedLayers: quests.filter((q) => q.status === "open" && isUnlocked(quests, q.layer)).slice(0, 12).map(brief),
          docs: docs.map((d) => d.path),
          ranks: RANKS,
        };
      }),
  );

  server.registerTool(
    "list_quests",
    {
      title: "List quests",
      description: "List quests, optionally filtered by layer (1, 2, 3a, 3b, 4), status, or a search term in the title or prompt.",
      inputSchema: z.object({
        layer: z.enum(["1", "2", "3a", "3b", "4"]).optional(),
        status: z.enum(["open", "done"]).optional(),
        search: z.string().optional(),
      }),
    },
    ({ layer, status, search }) =>
      safe(async () => {
        const s = search?.toLowerCase();
        return (await listQuests())
          .filter((q) => (!layer || q.layer === layer) && (!status || q.status === status) && (!s || `${q.title} ${q.prompt}`.toLowerCase().includes(s)))
          .map((q) => ({ ...brief(q), prompt: q.prompt, ...(q.status === "done" ? { answer: q.answer, doneAt: q.doneAt } : {}) }));
      }),
  );

  server.registerTool(
    "get_quest",
    {
      title: "Get a quest",
      description:
        "Everything about one quest: prompt, widget spec, the current draft (notes, overall answer, widget data), objectives left to lock it, and the doc sections it needs as context. Read this before working on a quest.",
      inputSchema: z.object({ id: z.string(), includeContext: z.boolean().default(true) }),
    },
    ({ id, includeContext }) =>
      safe(async () => {
        const { q, quests } = await findQuest(id);
        const { ctx, notes, sections } = await ctxFor(q);
        return {
          ...q,
          unlocked: isUnlocked(quests, q.layer),
          draft: { overall: notes.overall, notes: notes.notes, data: notes.data ?? null },
          objectives: objectivesFor(q, notes.data, ctx),
          context: includeContext ? sections : (q.context ?? []),
          howToAnswer:
            q.widget?.type === "fields"
              ? "Call set_quest_data with {fieldId: value}. choice/text → string, multi → string[], assign → {rowLabel: optionLabel}."
              : q.widget?.type === "chart"
                ? "Call set_quest_data with {cells: {'Attacker>Defender': 'strong'|'weak'|'none'|'absorb'}}. Unset cells are neutral."
                : q.widget?.type === "islands"
                  ? "Call set_quest_data with {islands: {slotId: {element, biome, inspiration, stone, mons}}}."
                  : q.widget?.type === "types"
                    ? "Call set_quest_data with {types, sources, secondary, origins}."
                    : q.kind === "sheet"
                      ? "Write the sheet with write_doc at the quest's file path (create_sheet starts it from the template), then lock."
                      : "Leave notes on the context with add_note and/or set an overall answer with set_overall, then lock.",
        };
      }),
  );

  server.registerTool(
    "list_docs",
    { title: "List docs", description: "Every markdown doc in the bible, with size and last-modified time.", inputSchema: z.object({}) },
    () => safe(async () => (await listDocs()).map((d) => ({ path: d.path, size: d.size, modified: new Date(d.mtime).toISOString() }))),
  );

  server.registerTool(
    "read_doc",
    {
      title: "Read a doc",
      description:
        "Read a markdown doc. Optionally pass `section` (a heading, prefix match) to get just that heading and what's under it, or `match` to get only blocks mentioning a term.",
      inputSchema: z.object({ path: z.string(), section: z.string().optional(), match: z.string().optional() }),
    },
    ({ path, section, match }) =>
      safe(async () => {
        const doc = await readDoc(path);
        if (!section && !match) return doc.text;
        const ref = section ? `${path}#${section}` : `${path}?match=${encodeURIComponent(match!)}`;
        const s = extract(ref, doc.text);
        if (s.missing) throw new Error(`No section "${section}" in ${path}`);
        return s.markdown;
      }),
  );

  server.registerTool(
    "search_docs",
    {
      title: "Search docs",
      description: "Case-insensitive search across every doc. Returns path, line number, the line and the heading it sits under.",
      inputSchema: z.object({ query: z.string().min(2), limit: z.number().int().min(1).max(200).default(40) }),
    },
    ({ query, limit }) =>
      safe(async () => {
        const q = query.toLowerCase();
        const hits: { path: string; line: number; heading: string; text: string }[] = [];
        for (const d of await listDocs()) {
          const lines = (await readDoc(d.path)).text.split("\n");
          let heading = "";
          lines.forEach((l, i) => {
            const h = /^#{1,6}\s+(.*)/.exec(l);
            if (h) heading = h[1];
            if (l.toLowerCase().includes(q) && hits.length < limit) hits.push({ path: d.path, line: i + 1, heading, text: l.trim() });
          });
        }
        return hits.length ? hits : `No matches for "${query}".`;
      }),
  );

  server.registerTool(
    "write_doc",
    {
      title: "Write a doc",
      description: "Create or replace a whole markdown doc (path must end in .md, e.g. 'world/islands.md'). Prefer edit_doc for small changes.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
    },
    ({ path, content }) => safe(async () => ({ written: path, ...(await writeDoc(path, content, null, BY)) })),
  );

  server.registerTool(
    "edit_doc",
    {
      title: "Edit a doc",
      description:
        "Replace exact text in a doc. `find` must occur exactly once unless `all` is true. To append, pass find='' and the new text goes at the end.",
      inputSchema: z.object({ path: z.string(), find: z.string(), replace: z.string(), all: z.boolean().default(false) }),
    },
    ({ path, find, replace, all }) =>
      safe(async () => {
        const doc = await readDoc(path);
        let next: string;
        if (find === "") next = doc.text.replace(/\s*$/, "") + "\n\n" + replace + "\n";
        else {
          const count = doc.text.split(find).length - 1;
          if (count === 0) throw new Error("`find` text not found. Read the doc first and copy it exactly.");
          if (count > 1 && !all) throw new Error(`\`find\` occurs ${count} times. Add surrounding text or pass all=true.`);
          next = all ? doc.text.split(find).join(replace) : doc.text.replace(find, () => replace);
        }
        await writeDoc(path, next, doc.mtime, BY);
        return `Edited ${path}.`;
      }),
  );

  server.registerTool(
    "add_note",
    {
      title: "Add a note to a quest",
      description:
        "Pin a verdict to one item (a bullet, paragraph or table row) in a quest's context, just like a note in the reader. `ref` is the context ref it sits in and `section` its heading (both from get_quest). `item` is that bullet's text. Re-adding the same item replaces its note.",
      inputSchema: z.object({
        quest: z.string(),
        ref: z.string(),
        section: z.string(),
        item: z.string(),
        verdict: z.enum(["keep", "change", "question", "note"]),
        text: z.string().default(""),
      }),
    },
    ({ quest, ref, section, item, verdict, text: body }) =>
      safe(async () => {
        await findQuest(quest);
        const current = await getNotes(quest);
        const clean = plain(item);
        const key = `${ref}::${section}::${clean.slice(0, 140)}`;
        const note: QuestNote = { key, ref, section, item: clean, verdict, text: body, updatedAt: new Date().toISOString() };
        const notes = [...current.notes.filter((n) => n.key !== key), note];
        await putNotes(quest, { ...current, notes }, BY);
        return `${VERDICTS.find((v) => v.id === verdict)!.label} note saved on "${clean.slice(0, 60)}" (${notes.length} notes on ${quest}).`;
      }),
  );

  server.registerTool(
    "remove_note",
    {
      title: "Remove a note",
      description: "Delete a quest note by its key, or by item text.",
      inputSchema: z.object({ quest: z.string(), keyOrItem: z.string() }),
    },
    ({ quest, keyOrItem }) =>
      safe(async () => {
        const current = await getNotes(quest);
        const p = plain(keyOrItem);
        const notes = current.notes.filter((n) => n.key !== keyOrItem && n.item !== p);
        if (notes.length === current.notes.length) throw new Error("No matching note.");
        await putNotes(quest, { ...current, notes }, BY);
        return `Removed. ${notes.length} notes left.`;
      }),
  );

  server.registerTool(
    "set_overall",
    {
      title: "Set a quest's overall answer",
      description: "Set the free-text overall answer on a quest's draft (shown in the Notes panel).",
      inputSchema: z.object({ quest: z.string(), text: z.string() }),
    },
    ({ quest, text: body }) =>
      safe(async () => {
        await findQuest(quest);
        const current = await getNotes(quest);
        await putNotes(quest, { ...current, overall: body }, BY);
        return "Overall answer saved.";
      }),
  );

  server.registerTool(
    "set_quest_data",
    {
      title: "Fill a quest's widget",
      description:
        "Write structured answers into a quest's widget (fields, types, chart, islands). By default it merges into what's there (one level deep, plus `cells`/`islands` maps); pass replace=true to overwrite. get_quest's howToAnswer says the shape.",
      inputSchema: z.object({ quest: z.string(), data: z.record(z.string(), z.unknown()), replace: z.boolean().default(false) }),
    },
    ({ quest, data, replace }) =>
      safe(async () => {
        const { q } = await findQuest(quest);
        if (!q.widget || q.widget.type === "review") throw new Error(`${quest} has no data widget. Use add_note or set_overall.`);
        const current = await getNotes(quest);
        const prev = (current.data ?? {}) as Record<string, unknown>;
        let next: Record<string, unknown> = replace ? data : { ...prev, ...data };
        if (!replace) {
          for (const k of ["cells", "islands"]) {
            if (prev[k] && data[k]) next = { ...next, [k]: { ...(prev[k] as object), ...(data[k] as object) } };
          }
          if (q.widget.type === "islands" && prev.islands && data.islands) {
            const merged: Record<string, unknown> = { ...(prev.islands as object) };
            for (const [slot, v] of Object.entries(data.islands as Record<string, object>)) merged[slot] = { ...((merged[slot] as object) ?? {}), ...v };
            next.islands = merged;
          }
        }
        if (q.widget.type === "chart" && next.cells) {
          next.cells = Object.fromEntries(Object.entries(next.cells as Record<string, string>).filter(([, v]) => v && v !== "neutral"));
        }
        await putNotes(quest, { ...current, data: next }, BY);
        const { ctx } = await ctxFor(q);
        return { saved: true, objectives: objectivesFor(q, next, { ...ctx, notes: current.notes, overall: current.overall }) };
      }),
  );

  server.registerTool(
    "create_sheet",
    {
      title: "Start a sheet",
      description: "For sheet quests: create the quest's markdown file from its template if it doesn't exist. Returns the path.",
      inputSchema: z.object({ quest: z.string() }),
    },
    ({ quest }) => safe(async () => ({ path: await createSheet(quest, BY) })),
  );

  server.registerTool(
    "lock_quest",
    {
      title: "Lock a quest",
      description:
        "Finish a quest: composes the answer from its widget data and notes (plus `answer` if given), writes any generated doc, appends to the decision log, and awards XP. Fails if required objectives aren't met unless force=true. Only lock when Jaedan has agreed to the decision.",
      inputSchema: z.object({ id: z.string(), answer: z.string().optional(), force: z.boolean().default(false) }),
    },
    ({ id, answer, force }) =>
      safe(async () => {
        const { q } = await findQuest(id);
        if (q.status === "done") throw new Error(`${id} is already locked. reopen_quest first to change it.`);
        const { ctx, notes } = await ctxFor(q);
        const objectives = objectivesFor(q, notes.data, ctx);
        const missing = objectives.filter((o) => !o.bonus && !o.done);
        if (missing.length && !force && !answer) throw new Error(`Not ready. Still needed: ${missing.map((o) => o.label).join("; ")}`);
        const bonus = objectives.filter((o) => o.bonus && o.done).length * 25;
        const composed = [answer?.trim(), widgetAnswer(q, notes.data, ctx), composeAnswer(notes.overall, notes.notes)].filter(Boolean).join("\n");
        const done = await completeQuest(id, composed || "Done.", bonus, widgetOutput(q, notes.data, ctx), BY);
        return { locked: done.id, xp: done.xp + (done.bonusXp ?? 0), answer: done.answer, output: q.output ?? null };
      }),
  );

  server.registerTool(
    "reopen_quest",
    { title: "Reopen a quest", description: "Set a locked quest back to open so it can be changed.", inputSchema: z.object({ id: z.string() }) },
    ({ id }) => safe(async () => ({ reopened: (await reopenQuest(id, BY)).id })),
  );

  server.registerTool(
    "add_quest",
    {
      title: "Add a quest",
      description:
        "Create a new quest when a new open question comes up. kind 'decision' is answered with notes; 'sheet' writes a doc at `file`. `context` is a list of refs: 'file.md', 'file.md#Heading' or 'file.md?match=Term'.",
      inputSchema: z.object({
        id: z.string().regex(/^[a-z0-9-]+$/),
        title: z.string(),
        layer: z.enum(["1", "2", "3a", "3b", "4"]),
        prompt: z.string(),
        xp: z.number().int().min(10).max(500).default(100),
        kind: z.enum(["decision", "sheet"]).default("decision"),
        file: z.string().optional(),
        template: z.enum(["island", "species", "character", "system"]).optional(),
        context: z.array(z.string()).optional(),
      }),
    },
    (input) =>
      safe(async () => {
        const quest: Quest = { ...input, layer: input.layer as LayerId, status: "open", widget: input.kind === "decision" ? { type: "review" } : undefined };
        return { added: (await addQuest(quest, BY)).id };
      }),
  );

  server.registerTool(
    "update_quest",
    {
      title: "Update a quest",
      description: "Change an existing quest's title, prompt, xp, layer or context refs.",
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        prompt: z.string().optional(),
        xp: z.number().int().min(10).max(500).optional(),
        layer: z.enum(["1", "2", "3a", "3b", "4"]).optional(),
        context: z.array(z.string()).optional(),
      }),
    },
    ({ id, ...patch }) =>
      safe(async () => {
        const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
        return brief(await updateQuest(id, clean as Parameters<typeof updateQuest>[1], BY));
      }),
  );
}
