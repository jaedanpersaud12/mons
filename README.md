# mons

The game bible for the creature RPG, and Bible Quest, the app used to write it.

| Folder | What it is |
|---|---|
| `game-docs/` | The bible: story, world, creatures, decisions. `quests.json` and `notes.json` hold Bible Quest progress |
| `bible-quest/` | Next.js app that turns the bible into quests with their own tools |

## Run Bible Quest

```bash
cd bible-quest
npm install
npm run dev
```

Open http://localhost:4321. It reads and writes `../game-docs`, so keep the two folders side by side. Set `BIBLE_DIR` to point it somewhere else.

See `bible-quest/README.md` for how quests, tools, notes and the writer work.
