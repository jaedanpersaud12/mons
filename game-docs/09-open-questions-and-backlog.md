# Open questions and backlog

## Decisions still needed

| Question | Notes |
|---|---|
| Godot test: go, and where to run it? | See `08-engine-decision.md` |
| The game's title | None yet |
| The fire line's second type | Planned as Fire/Ground. Since called "fire rock" |
| The full type chart | Ours, not Pokémon's. Watch Fighting versus Dark in the starter triangle |
| Names for the creatures | None named |
| Names for the region, towns and the hero | Only "Fernhollow" exists, and it is being rebuilt |
| The story beyond the opening | Only the wake-up scene is written |
| How many creatures on screen | "Not too many". The real limit is unmeasured |
| How lava bull size reads | About 1.8 m at the hump. Smaller? |
| Carry the new grass into the town? | Approved in the meadow, not yet moved |

## Next up

1. **Godot test.** Meadow ground and grass, the calf, the pixel pass.
2. **Coastal town.** In whichever home the test picks.
3. **Sky, clouds, sun, moon, ocean.**
4. **Day and night,** which needs live lighting.
5. **Cliffs, walls, stairs.**
6. **Species sheets,** with the three bulls moved onto them.
7. **Needs and points of interest.**
8. **Battles:** turn-based combat, party, catching from a menu, the type chart.
9. **Procedural variants** by species, gender and location.
10. **More body plans** as models arrive: biped for the wader, flyer for the bat.

## Known issues

### Creatures

- Motion has only been checked in still frames.
- Lying down on a steep slope is unchecked.
- The calf and young bull have a second tail tuft on one flank.
- The young bull's model is frozen in a charging stance.
- The lava bull's ears are not rigged.
- Missing animations: drinking, eating, startle, swimming, sleep.
- Hand-rigging by position does not scale to 100 creatures.

### Hero and intro

- Walk and run timing judged from stills only.
- No ankle or finger joints.
- Sleeps fully dressed on top of the blanket.
- The intro was checked on a stand-in set, not the real bedroom.
- Mum has no model.

### World

- Fernhollow still has the old grass.
- Only one building has an interior.
- The interior only loosely matches the exterior.
- The background is a flat dark colour.
- No cliffs, walls, bridges or arches.

### Greenery

- Reed heads are too big and heavy.
- Flower bases read dark and reddish up close.
- The field may be too uniform. Gentle large-scale colour variation could be added.

### Engine

- Lighting is fixed at load.
- Everything is prepared in memory at load. No saving to disk.
- Hills will hide the player from the camera.
- Detail is still capped at half, from before the frame rate was measured.
- The workspace holding the converter and backups is temporary.

## Ideas raised and not yet decided

- Creature memory: getting used to a player who is gentle.
- Your party changing how wild creatures react.
- Creature-to-creature behaviour: the calf pestering the young bull, everything avoiding the lava bull.
- A creature "sheet" editor.
- Ankle joints and close-up camera shots for cutscenes.
- A pyjama and blanket version of the wake-up scene.
