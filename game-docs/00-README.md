# Project notes: pixel-splat creature RPG

Written 15 November 2026. The game has no title yet.

These files record what has been discussed, decided and built so far. Each one marks things as **Decided**, **Built**, **Planned** or **Open** so it is clear what is real.

## Files

| File | What it covers |
|---|---|
| `01-game-bible.md` | Only what is locked in. Start here. |
| `02-art-and-rendering.md` | The look, how it is made, display settings, grass, shadows, performance |
| `03-world-and-maps.md` | Fernhollow today, the Test Meadow, the coastal town, map structure, height, sky, ocean, day and night |
| `04-creature-framework.md` | The species sheet, body plans, movement styles, behaviour, player reactions, animation layers |
| `05-starters.md` | The three starter lines, the design rules, what is built for the bull line |
| `06-hero-and-cutscenes.md` | The player character, movement, camera, the intro |
| `07-tech-notes.md` | How the current build works inside, the model converter, test tools, where files live |
| `08-engine-decision.md` | Browser versus Godot, the reasoning, the test that decides it |
| `09-open-questions-and-backlog.md` | Unanswered questions, known issues, what is next |
| `10-decision-log.md` | Feedback and decisions in the order they happened |
| `11-story.md` | Story, tone, the awakening gimmick, world rules, cast, island structure |

## One-paragraph summary

A creature-collecting RPG in the spirit of Pokémon Fire Red, with its own world, story and about 100 original creatures. Its look is "pixel-art gaussian splats": everything is made of small soft discs placed on sculpted surfaces, then drawn at low resolution with a limited palette. Creatures roam the world visibly with their own personalities; there are no random tall-grass encounters. The setting is a tropical island region. Maps are linear but varied in height, in the style of Clair Obscur: Expedition 33.

## Live builds

| Build | What it is |
|---|---|
| Fernhollow Splat Town | The original flat town with a cottage interior, the hero, the intro cutscene and three roaming creatures |
| Test Meadow | Hills, a lake, the new grass and the three creatures. Loads in seconds, no intro |
| Creature and World Systems Plan | The readable planning page |
| Splat Cottage | The first single-cottage demo |

All four are private claude.ai artifacts on Jaedan's account.

## Where things stand

- The renderer, hero, intro, creature rig, creature animation and stylised grass work in the browser build.
- On Jaedan's Mac the Test Meadow runs at 120 fps with the pixel pass on.
- **The next step is a small Godot test** to see whether the look can be reproduced in a real engine. See `08-engine-decision.md`.
