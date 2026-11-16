# Engine decision

**Question:** keep building in JavaScript in the browser, or move to a game engine?

**Status:** recommendation made, test agreed in principle, not yet run.

## Recommendation

Move the real game to **Godot**. Keep the browser build as a sandbox for look and behaviour tests. Decide for certain with one small test.

## What we know

- **Speed is not the reason to move.** The Test Meadow runs at 120 fps on Jaedan's Mac with the pixel pass on, which is probably the screen's limit.
- **The pixel pass is what makes it fast.** Turning it off draws at full screen resolution and performance collapses. Since the pixel look is the game's look, this is acceptable.
- **The reason to move is the content pipeline** for 100 creatures.

## The comparison

| Need | Browser build | Engine |
|---|---|---|
| 100 rigged, animated creatures | Each rigged by hand with position rules | Imports a rigged model with its skeleton and clips |
| Animation blending and state machines | Hand-written per creature | Built in, with visual tools |
| Large levels | Everything prepared in memory at load | Saved to disk, loaded on demand |
| Day and night lighting | Lighting is fixed at load | Real-time lighting |
| Saves, audio, menus, controller, battle screens | All hand-built | Built in |
| Shipping to Steam or console | Needs a wrapper | Export |
| Model files | 80 MB each, shrunk into the page | A normal asset pipeline |

## What carries over

- Species sheets and behaviour design
- Gait and action maths
- The grass approach
- Shader logic (Godot's shader language is close)
- Splat data, which can be saved to files

## What does not carry over

- The splat renderer itself: the two-pass soft blend and the pixel pass. **This is the whole look, and the real risk.** Godot has no built-in equivalent; it would be a custom rendering pass.
- The page's controls and layout.

## The test

One scene in Godot:

- The meadow's ground and grass
- The calf
- The pixel pass

Nothing else.

| Outcome | What we do |
|---|---|
| Looks right, runs well | Move. Build the coastal town there from the start |
| Looks right, runs badly | Find out why before deciding |
| Cannot reproduce the look | Stay in the browser, knowing exactly what must be hand-built |

## Why test before building more

The next features are live lighting for day and night, sky, ocean and level loading. All of that is engine plumbing. Built in the browser and then moved, it gets built twice. Design work carries over either way.

So: do not rebuild Fernhollow in the browser first. It is the most enjoyable next step and the one most likely to be thrown away.

## Open practical point

It is not yet confirmed that Godot can be run from the assistant's workspace. If it cannot, the fallback is running it on Jaedan's Mac through the linked folder, which is slower to check visually.

## If we stay in the browser

It is technically possible to ship a game of this scope on the web. It would mean hand-building the asset pipeline, level loading, animation tooling, audio, saves, menus, controller support and packaging.
