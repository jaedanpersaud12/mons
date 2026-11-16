# Bible Quest

A gamified tracker for the mons game bible. It reads and writes `../game-docs/quests.json`, and every quest you lock in is added to `../game-docs/10-decision-log.md`.

## Run it

```bash
cd bible-quest
npm install
npm run dev
```

Open http://localhost:4321.

## How it works

- **Layers** unlock in order: Rules, Skeleton, then Islands and cast alongside Systems, then Content. Locked layers are parked so you only see what you can work on. Tick "Work ahead" to ignore locks.
- **Quests** are decisions (write your answer) or sheets (create the file from `game-docs/_templates/`, fill it in, then lock the quest).
- **Hold to lock it in** saves the answer, awards XP and writes a line to the decision log. Done quests can be reopened.
- **Ranks** go from Villager to Stormholder. Badges and a daily streak track progress.

## Deployed, with live sync

Bible Quest runs in two modes:

- **Files** (no `DATABASE_URL`): reads and writes `../game-docs`. Good for working offline.
- **Database** (`DATABASE_URL` set): everything lives in Neon Postgres, so every machine sees the same bible. This is what the Vercel deployment uses.

Live sync uses [Neon Realtime](https://neon.com/docs/realtime/overview). Every write bumps a row in a small `revisions` table. Each open copy of the app subscribes to that table over one WebSocket and refetches whatever another device changed: the quest list, the quest you have open, the doc in the writer. The green **Live** dot in the header shows it's connected. Your own edits are tagged with a per-tab id, so a tab never reloads its own changes.

If both devices edit the same doc at once, the second save is caught and asks whether to load the other version or overwrite.

### Environment variables

See `.env.example`. On Vercel, set all four:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `NEON_REALTIME_URL` | Neon Console → Postgres database → Realtime |
| `NEON_REALTIME_SECRET` | Same page, "Copy secret". Server only, never in the browser |
| `APP_PASSCODE` | The passcode for the site. Anyone with the URL can't get in without it |

### First deploy from the command line

With the Vercel CLI logged in and `.env.local` filled in, run `bash scripts/vercel-setup.sh` from `bible-quest/`. It seeds the database from `../game-docs`, links a Vercel project called `bible-quest`, copies the variables into Vercel and deploys. After that, `npx vercel deploy --prod` redeploys.

### Moving data in and out

- `npm run db:seed` copies `../game-docs` into the database. It refuses to overwrite a database that already has quests unless you add `-- --force`.
- `npm run db:export` writes the database back out to `../game-docs`, so you can commit a readable copy to git.

New database? Run `scripts/schema.sql` once, on Postgres 18 with Realtime enabled.

## Each quest has its own tool

Quests aren't a text box on top of a doc. Each one opens the tool that fits it, and the markdown is generated from what you do there.

| Tool | Used for | What it writes |
|---|---|---|
| **Type picker** | Main types (elements) and secondary types (where a mon lives), then the 12 island elements | `world/types.md` |
| **Chart** | Click cells to set matchups; built from your type list | `world/type-chart.md` |
| **Island board** | 13 slots laid out like the route: home (no stone) plus 12 source islands, each with element, biome, stone and mons relationship | `world/islands-skeleton.md` |
| **Choices** | Decisions with real options: pick cards, assign rows, add your own | The decision log |
| **Review** | Read a doc and note items in place | The decision log |
| **Sheet** | Long-form writing from a template | The sheet itself |

Every quest has its own **objectives**. Required ones unlock the lock button; bonus ones add +25 XP each. The footer always names the next thing to do. Progress saves as you go to `notes.json`, so you can leave a quest half done (it shows an amber dot in the list).

Tools are defined per quest under `widget` in `quests.json`; `scripts/add-widgets.py` sets them up and is safe to re-run. A "Choices" tool is just a list of fields (`choice`, `multi`, `text`, `assign`), so new decision quests need no code.

## Reading and writing

- **Quest workspace.** Opening a quest shows exactly what you need to read on the left, pulled from the bible docs, and what you do on the right: a decision box, or the sheet itself with autosave. "Preview your sheet" renders what you've written so far.
- **Rendering** is ported from the Markdown Reader artifact (`lib/markdown.ts`, the `.md` styles in `app/globals.css`): markdown-it with footnotes, DOMPurify, task checkboxes, `[!NOTE]`-style callouts, wrapped tables and code bars.
- **Writer** (`/write`): every `.md` in `game-docs`, editor plus live preview, autosaves, ⌘S, ⌘B, ⌘I, ⌘K, and asks before overwriting a file changed elsewhere.

### Notes on the reading

Hover any bullet, table row or paragraph in a quest's reading and press **Note**. Pick Keep, Change, Question or Note (⌘1 to ⌘4), type if you want, and press Enter. The note sits under that exact item and in the list on the right. Click a note in the list to jump back to it.

Notes save as you go to `game-docs/notes.json`. When you lock the quest, they become the answer: a one-line tally, then one line per note naming the section and the item. That whole block goes into the decision log.

### What a quest reads

Each quest has a `context` list in `quests.json`:

- `"11-story.md#Act 1"`: that heading and everything under it (matches the start of the heading text)
- `"11-story.md?match=Default"`: only the lines, list items and table rows that mention "Default", under their headings
- `"03-world-and-maps.md"`: the whole file

If a heading gets renamed, the workspace says so instead of failing.

## Adding quests

Edit `game-docs/quests.json`. Each quest needs `id`, `title`, `layer` (`1`, `2`, `3a`, `3b` or `4`), `xp`, `kind` (`decision` or `sheet`), `prompt` and `status`. Sheets also take `file` (relative to `game-docs`) and `template` (`island`, `species`, `character` or `system`). Any quest can take `context`.

## Components

UI micro-interactions are copied from [interior.dev](https://interior.dev) (MIT) into `components/interior/`: drawer, hold to confirm, loading button, progress bar, segmented control, task steps, tooltip group, value flash.

Set `BIBLE_DIR` to point at a different docs folder.

## MCP server

`/api/mcp` is an MCP server (Streamable HTTP) so Claude can read and write the bible directly. Every write shows up live in open tabs.

Tools: `bible_overview`, `list_quests`, `get_quest`, `list_docs`, `read_doc`, `search_docs`, `write_doc`, `edit_doc`, `add_note`, `remove_note`, `set_overall`, `set_quest_data`, `create_sheet`, `lock_quest`, `reopen_quest`, `add_quest`, `update_quest`.

Auth: `MCP_TOKEN` (falls back to `APP_PASSCODE`), sent as `Authorization: Bearer <token>` or `?key=<token>`.

- Claude Code: `claude mcp add --transport http bible https://<url>/api/mcp --header "Authorization: Bearer <token>"`
- claude.ai: Settings → Connectors → Add custom connector → `https://<url>/api/mcp?key=<token>`

## Live UI: change a quest's interface without deploying

A quest's tool can be drawn by code kept in the database instead of code in this repo. Save new source through the MCP server and every open copy of the app swaps it in within a second or two.

- **Where it lives:** one entry per UI under `code-<id>` in the `kv` table (or `game-docs/code-<id>.json` in files mode), with up to 30 versions.
- **How it runs:** inside a sandboxed iframe with no network, no cookies and no access to the app. It can only draw and call `save()`. Source is plain JavaScript using [htm](https://github.com/developit/htm) on Preact, so there is no build step.
- **What it can replace:** on a quest with a built-in tool it swaps the interface only; the data shape, objectives and generated doc stay as coded in `lib/widgets.ts`. On a quest with no tool it becomes a `custom` tool and supplies its own objectives through a `meta` function.
- **When it breaks:** code that does not parse is refused at save. A runtime crash shows an error card with "Roll back" and "Use the built-in tool". Answers are never held by the code, so nothing is lost.
- **In the quest:** a "Live UI" bar shows the version and who saved it, with a version picker and a switch back to the built-in tool.

MCP tools: `ui_guide` (read first), `list_ui_code`, `get_ui_code`, `save_ui_code`, `rollback_ui_code`, `attach_ui_code`.

`ui/island-board.js` is the first one and ships with the app as v0. After editing anything in `ui/` or `ui-runtime/`, run `node scripts/build-ui.mjs` to regenerate `lib/ui-seeds.ts` and `lib/vendor/`.

Anyone holding the MCP token can change what these quests look like, so treat it like a password.
