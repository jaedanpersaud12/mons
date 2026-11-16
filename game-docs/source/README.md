# Source snapshot

Small working files copied out of the temporary workspace on 15 November 2026, so they are not lost.

## converter/
- `insp.py`: prints what is inside a model file (meshes, textures, skeleton, animations).
- `conv.py`: reads a model and scatters evenly spaced, texture-coloured points over its surface.
- `rig2.py`: assigns bones, blend weights and effect codes per creature, then packs the result for the game. The per-creature rules are in the `SPEC` table at the top.

## game/ (removed)
The browser build's creature code, patch scripts and screenshot scripts lived here. They were removed on 16 November 2026 when the Godot project in `/game` replaced the browser build. They are still in this repo's git history (last present in commit `0354d4e`).

Not included: the full game pages (they are the published artifacts) and the three model files (about 80 MB each; Jaedan has the originals).
