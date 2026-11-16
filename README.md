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

Open http://localhost:4321. Without a `.env.local` it reads and writes `../game-docs`, so keep the two folders side by side. With the Neon variables from `bible-quest/.env.example` it uses the shared database instead, and syncs live with every other open copy.

## Deploy to Vercel

1. Import this repo in Vercel and set **Root Directory** to `bible-quest`.
2. Add the four environment variables from `bible-quest/.env.example`.
3. Deploy. Open the site on both machines and look for the green **Live** dot.

See `bible-quest/README.md` for how quests, tools, notes and the writer work.
