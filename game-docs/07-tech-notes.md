# Tech notes

How the current browser build works. Written for whoever picks this up next, including a future engine port.

## Shape of the build

- One HTML page. Raw WebGL2. No libraries.
- Creature data is embedded in the page as encoded binary.
- Page size: about 135 KB before creatures, about 2.9 MB with three.
- The Test Meadow is the same file with one flag set (`window.WILD = true`).

## Order of things in the file

1. Page layout and controls
2. Maths helpers and noise
3. Shape primitives
4. Asset builders (buildings, trees, props, furniture, the hero, greenery)
5. Colours
6. Terrain: height, paths, ground colour, pond
7. Baking an asset into splats
8. Lighting
9. Splat buffers
10. Town layout and placement
11. Building fade
12. Culling cells
13. Scenes and the interior
14. World build
15. Player movement
16. Hero skeleton and gait
17. Creatures
18. Palette
19. Shaders and drawing
20. Cutscenes and the intro
21. Controls and start-up

## What one splat stores

| Field | Contents |
|---|---|
| Position | x, y, z |
| Colour | Red, green, blue, and a glow flag |
| Misc | Sway (or effect code for creatures), group, size, phase (or bone blend weight for creatures) |
| Normal | Facing direction, plus a shape code: round, blade sliver, or leaf |
| Object id | For fading whole buildings |

## Groups

The group number tells the shader how a splat moves.

| Group | Behaviour |
|---|---|
| 0 | Static |
| 1 | Weather vane |
| 2 | Chimney smoke |
| 3 | Fireflies |
| 4 | Lamp flicker |
| 5 | Water |
| 11 | Windmill sails |
| 12 | Old player shadow. Now hidden |
| 20 to 33 | Hero bones |
| 34 and up | Creature bones, 16 per creature |

## Bones

- Each bone is a 4 by 4 matrix, rebuilt every frame.
- 62 in total: 14 for the hero, 16 for each of three creatures.
- Creature splats blend between their bone and its parent using a stored weight.
- Parent rules: lower leg to upper leg; tail tip to tail; ears to head; hind legs and tail to hindquarters; everything else to the chest.

## Creature effect codes

Stored where static splats keep their sway value.

| Code | Effect |
|---|---|
| 1 to 99 | Flame. Higher means nearer the tip, so it moves more |
| 100 to 127 | Slow billow (the smoke mane) |
| 128 to 159 | Snort steam, triggered per creature |
| 160 to 191 | Rising smoke |
| 192 to 255 | Embers |

## Model converter

Runs outside the game, in Python.

1. Read the model file: positions, normals, texture coordinates, triangles, texture.
2. Pick random points on the surface, weighted by triangle area.
3. Thin them to an even spacing.
4. Take each point's colour from the texture.
5. Assign bones and blend weights by position rules written per model.
6. Mark glowing splats by colour (bright orange and yellow).
7. Mark flame, mane and other effect regions.
8. Remove parts that are replaced by live effects (the frozen steam puffs and smoke wisps).
9. Apply simple baked lighting.
10. Pack 13 bytes per splat and embed in the page.

**Per-model inputs:** scale, knee and hip heights, leg radius, head and tail regions, ear region, pelvis range, mane rule, flame rule, nostril and vent positions.

**Why this does not scale:** steps 5 to 8 are hand-tuned for each model. Models that arrive with a skeleton would remove most of it.

## Shadows under characters

Four ovals are sent to the shader each frame: the player and three creatures. Ground and grass splats inside an oval, and near its ground height, are darkened.

## Scenes

A scene is a snapshot of all splat buffers plus its own height function, blocked-area function, camera settings, exits and name. Switching scenes swaps the buffers.

## Test tools

The work is checked with a headless browser using a software renderer, at about one frame a second.

- **Hero test scene:** just the hero, a floor and a bed block. Bakes in seconds.
- **Frame stepping:** drawing can be turned off so the game can be stepped at a fixed rate and captured as a filmstrip.
- **Creature filmstrips:** poses, gait frames and action frames captured as sheets.

**Limit:** motion can only be judged from stills. Timing, feel and flicker are invisible to this. The black dot bug was found by Jaedan, not by testing.

**A trap to remember:** stepping frames in a loop queues extra real frames, which made a creature appear to run across the map. That was a test artefact, not a game bug.

## Files in the workspace

| Path | Contents |
|---|---|
| `splat-town/index.html` | Current Fernhollow build |
| `splat-town/index.v1.html` to `index.v25.html` | Backups at each stage |
| `splat-town/patch22.py` to `patch27.py` | The scripts that produced each version from the one before |
| `splat-town/crit3.js` | Current creature code |
| `meadow/index.html` | Current Test Meadow build |
| `conv/` | Model converter and rig scripts |
| `glb_in/`, `glb_in3/` | The three bull models |
| `views/` | The concept sheets cut into per-view images |
| `plan/index.html` | The plan page |

This workspace is temporary. The published pages are the durable copies of the builds. The converter scripts and backups are not saved anywhere else.

## Artifact ids

| Artifact | Id |
|---|---|
| Fernhollow Splat Town | `8d008150-140a-4133-baf2-752a49420714` |
| Test Meadow | `44183047-b532-4906-be73-0d741d932336` |
| Creature and World Systems Plan | `40d485e6-9769-4c70-a0e4-2b94be99c3cd` |
| Splat Cottage | `330cb479-ce83-461d-b87a-2dc7d81bccd8` |
