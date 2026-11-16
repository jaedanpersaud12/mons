// MCP tools for the live UI: read, write and roll back the interface of a quest
// without a deploy. Source lives in the database; open tabs reload it as it changes.
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { currentCode, getCode, listCode, rollbackCode, saveCode } from "./code-store";
import { listQuests, setQuestCode } from "./store";

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

export const UI_GUIDE = `# Writing a live UI for Bible Quest

A live UI is one JavaScript file kept in the database. It draws a quest's tool inside a sandboxed
iframe. It has no network, no cookies and no access to the app: all it can do is draw and call save().

## The contract

    function Widget({ data, save, ctx }) { return html\`...\`; }

- data: the quest's saved answers (null until something is saved). Never mutate it.
- save(next) or save(prev => next): stores the answers. The app autosaves, syncs devices and keeps
  the data even if this code is later replaced or crashes.
- ctx: { quest: {id,title,prompt}, disabled, mains, secondaries, elements, starters, slots, fields }.
  Honour ctx.disabled (the quest is locked or done).
- Plain script, not a module: no import/export. Write htm, not JSX:
  html\`<div class="card">\${x}</div>\`, components as html\`<\${Row} key=\${id} item=\${it} />\`.
- In scope: html, ui, useState, useEffect, useMemo, useRef, useCallback (Preact hooks).

## Replacing a built-in tool versus a new tool

- Attached to a quest that already has a tool (fields, types, chart, islands), the code replaces
  only the interface. Keep the same data shape: objectives, the decision-log answer and the
  generated doc are still worked out by the app from that data. get_ui_code on the current code
  shows the shape.
- Attached to a quest with no tool it becomes a "custom" tool, and must also define

      function meta(data, ctx) { return { objectives: [{ id, label, done, bonus?, detail? }], answer: "text for the decision log", output: "markdown or null" }; }

  meta runs in the browser, so objectives only refresh while the quest is open in the app.

## The kit

Classes: stack, row, wrap, between, grow, grid2, grid3, card, card done, card big, label,
label accent, title, muted, dim, small, input, area, chip, chip on, btn, badge, tick, sep, fade.
Helpers: ui.Input({value,onInput,placeholder,disabled}), ui.Area({...same, rows}) (grows with its
text), ui.Chips({options,value,onChange,multi,disabled}) with options as strings or
{value,label,color,hint}, ui.Tick(), ui.color(element) for an element's colour.
Inline style="" is fine for anything else. Dark theme; accent #93B0FF, done #34d399.

## Rules that keep it from breaking

- Give list items a stable key (an id, not a name the user is typing) or inputs lose focus.
- Do not put text inputs inside something that re-groups as you type.
- save_ui_code refuses code that does not parse. A runtime crash shows an error card with
  "Roll back" and never loses data. rollback_ui_code undoes a bad save.
- Always pass a note saying what changed; it is shown in the app's version list.
`;

export function registerCodeTools(server: McpServer) {
  server.registerTool(
    "ui_guide",
    { title: "How to write a live UI", description: "The contract, the styling kit and the rules for writing live UI code. Read this before save_ui_code.", inputSchema: z.object({}) },
    () => safe(async () => UI_GUIDE),
  );

  server.registerTool(
    "list_ui_code",
    { title: "List live UIs", description: "Every live UI kept in the database, its versions, and which quests use it.", inputSchema: z.object({}) },
    () =>
      safe(async () => {
        const [codes, quests] = await Promise.all([listCode(), listQuests()]);
        return codes.map((c) => ({ ...c, usedBy: quests.filter((q) => q.widget?.code === c.id).map((q) => q.id) }));
      }),
  );

  server.registerTool(
    "get_ui_code",
    {
      title: "Read a live UI's source",
      description: "The source of a live UI: the live version, or a specific one. Read it before editing so you change it instead of rewriting it.",
      inputSchema: z.object({ id: z.string(), version: z.number().int().optional() }),
    },
    ({ id, version }) =>
      safe(async () => {
        const found = await currentCode(id);
        if (!found) throw new Error(`No code called ${id}. list_ui_code shows what exists.`);
        const v = version == null ? found.cur : found.entry.versions.find((x) => x.v === version);
        if (!v) throw new Error(`${id} has no version ${version}`);
        return { id, title: found.entry.title, live: found.entry.current, version: v.v, note: v.note, source: v.source };
      }),
  );

  server.registerTool(
    "save_ui_code",
    {
      title: "Save a live UI (goes live at once)",
      description:
        "Save new source for a live UI as a new version. Every open copy of the app reloads it within a second or two, no deploy. Code that does not parse is refused. Read ui_guide first, send the whole file, and say what changed in `note`.",
      inputSchema: z.object({ id: z.string(), source: z.string(), note: z.string(), title: z.string().optional() }),
    },
    ({ id, source, note, title }) => safe(async () => ({ saved: true, ...(await saveCode(id, source, note, BY, title)) })),
  );

  server.registerTool(
    "rollback_ui_code",
    {
      title: "Roll a live UI back",
      description: "Make an earlier version of a live UI the live one. Nothing is deleted, so you can roll forward again the same way.",
      inputSchema: z.object({ id: z.string(), version: z.number().int() }),
    },
    ({ id, version }) => safe(async () => ({ rolledBack: true, ...(await rollbackCode(id, version, BY)) })),
  );

  server.registerTool(
    "attach_ui_code",
    {
      title: "Attach a live UI to a quest",
      description:
        "Point a quest at a live UI, or pass code=null to go back to its built-in tool. On a quest with a built-in tool only the interface changes. On a quest without one it becomes a custom tool (the code needs a meta function, see ui_guide).",
      inputSchema: z.object({ quest: z.string(), code: z.string().nullable() }),
    },
    ({ quest, code }) =>
      safe(async () => {
        if (code && !(await getCode(code))) throw new Error(`No code called ${code}. Save it first with save_ui_code.`);
        const q = await setQuestCode(quest, code, BY);
        return { quest: q.id, widget: q.widget ?? null };
      }),
  );
}
