# Source snapshot

Small working files copied out of the temporary workspace on 15 November 2026, so they are not lost.

## converter/
- `insp.py`: prints what is inside a model file (meshes, textures, skeleton, animations).
- `conv.py`: reads a model and scatters evenly spaced, texture-coloured points over its surface.
- `rig2.py`: assigns bones, blend weights and effect codes per creature, then packs the result for the game. The per-creature rules are in the `SPEC` table at the top.

## game/
- `crit3.js`: the current creature code: spawning, behaviour, actions, gaits and posing.
- `patch22.py` to `patch27.py`: the scripts that turned each version of the game page into the next. They show exactly what changed for creatures, shadows, the meadow and the grass.
- `critfilm.js`, `meadowshot.js`: the headless-browser scripts used to capture pose sheets and meadow screenshots.

Not included: the full game pages (they are the published artifacts) and the three model files (about 80 MB each; Jaedan has the originals).
