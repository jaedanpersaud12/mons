# The game (Godot 4.6)

This started as a port test with one question: can the pixel-art splat look from the browser build be reproduced in Godot, and how fast does it run? It is now the game.

This scene has the Test Meadow's ground, grass, trees and lake, the player (walk, run, jump, idle), the bull calf, and the pixel pass.

## Run it

1. Open Godot 4.6 (4.3 or newer should work).
2. Import this folder (`project.godot`).
3. Press Play (F5).

The project uses the **Compatibility** renderer.

## Run it without Godot

`build\Mons.exe` is a single-file Windows build. It is not committed (it is about 150 MB), so it only exists where it has been built or copied.

To rebuild it after a change, double-click `build_windows.bat`. That needs Godot 4.6 with its export templates installed; the script's first lines say how to point it at Godot. The export settings are in `export_presets.cfg`.

Windows will warn about an unknown publisher the first time, because the file is not signed. Choose **More info**, then **Run anyway**.

## Controls

| Key | Action |
|---|---|
| W A S D or arrows | Walk |
| Shift | Run |
| Space | Jump |
| Q, E | Turn the camera |
| Mouse wheel | Zoom |
| 1, 2 | World detail: half, full (turns auto off) |
| G | Auto detail on or off |
| B | Soft blend or opaque splats |
| P | Palette on or off |
| 3 | New water or the old flat water |
| 4 | Caustics on or off |
| 5 | Foam and glints on or off |

The top-left readout shows frame rate, frame time, detail, blend mode, splats drawn and draw calls.

## What to check

- **Look:** does it match the browser Test Meadow?
- **Speed:** what frame rate do you get?
- **Flicker:** any black dots or shimmer in the swaying grass?

## How it works

| Piece | File | What it does |
|---|---|---|
| Shared splat code | `shaders/splat.gdshaderinc` | Wind sway, contact shadows, bones and effects, disc shape, depth |
| Depth prepass | `shaders/*_prepass.gdshader` | Writes each splat's depth, pushed back slightly. Leaves colour untouched |
| Blend pass | `shaders/*_add.gdshader` | Lays each splat over the view with a soft-edged alpha, only where it is close to the front surface |
| Opaque pass | `shaders/*_depth.gdshader` | Opaque mode only: one pass, colour written directly |
| Pixel pass | `shaders/post.gdshader` | Divides blended colour by coverage, fills pinholes, snaps to the 28-colour palette with dither |
| Scene | `main.gd` | Loads the data, builds the meshes, runs the player, the calf and the camera |

**One low-resolution view.** The world is drawn at 400 lines into a transparent floating-point view. rgb ends up as blended colour times coverage and alpha as coverage; the pixel pass divides one by the other. (The first version used two views and drew everything four times; this draws it twice.)

**Splats are points.** Each map cell is two meshes of points: the first half of its splats and the second half. Godot culls cells outside the camera's view. Per-splat data rides in three custom vertex attributes as floats.

**Detail.** Half detail hides the second mesh of every cell and enlarges the rest to cover. Switching is instant. With auto detail on, the game drops to half if it cannot hold 55 fps and returns to full when it has clear headroom.

**The calf and the player** each use 16 bone matrices passed to the shader. Every splat belongs to one bone and blends toward that bone's parent, so joints bend.

## Water

The lake is drawn by the same splats as everything else. Each water splat stores the colour of the lakebed under it and the depth there, and the shader works out what that looks like through the water.

| Part | What it does |
|---|---|
| Depth colour | Red light is absorbed first, so pale sand turns turquoise in the shallows and deep blue in the hole |
| Lakebed | Sand at the shore, then rock, weed and a few corals, visible through shallow water |
| Caustics | Moving light lines on the bed, fading with depth |
| Foam | A solid line where the water meets the sand and a broken one behind it. The waterline moves in and out, leaving wet sand |
| Glints | A few splats flash white along the bright bands |
| Wading | Rings spread from the player while standing in water |

The water code is the `g == 5.0` block in `shaders/splat.gdshaderinc`. `tools/bake_water.py` is the one-off script that rewrote the lake's splats, dug the deep hole and refitted the palette; it has already been run on the data in this folder.

Not there yet: reflections, a sky to reflect, waves that move the surface, splashes, and anything for the open sea.

## Data (`data/`)

Exported from the browser build.

| File | Contents |
|---|---|
| `world_pos.bin` | Splat positions, three floats each |
| `world_col.bin` | Colour and glow flag, four bytes each. For water splats the colour is the lakebed's |
| `world_misc.bin` | Sway, group, size, phase, four bytes each. For water splats the sway slot holds depth |
| `world_nrm.bin` | Facing direction and shape code, four signed bytes each |
| `world.json` | Map cells, palette, ground height grid, water level |
| `calf.bin`, `calf.json` | The calf's splats, bones and joint positions |
| `hero.bin`, `hero.json` | The player's splats, bones, joint positions and bone parents |
| `palette.json` | 28 colours fitted to the world, the characters and the water together |

## Known gaps

- Only the calf, and only part of its behaviour. No other creatures.
- The player does not blink (the eyes are part of the head's surface) and has no ankle or finger joints.
- Lighting is still baked into the splat colours.
- Tested only with a software renderer. Real frame rate is unknown until it runs on a GPU.
- Found on the way: byte-packed custom vertex attributes only delivered one channel in the Compatibility renderer, so the data is sent as floats.
