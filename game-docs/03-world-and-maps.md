# World and maps

## Fernhollow, as it exists today (Built)

The first walkable town. Original, though inspired by the idea of a Pokémon starter town.

- A flat island about 48 by 40 units with a raised rim.
- The hero's cottage (with a weather vane), two neighbour cabins, a workshop hall, a windmill on a low hill.
- A pond with a dock, a well, a gate to the north, lamps, fences, signs, mailboxes, a bench, rocks, bushes, a ring of oaks and pines.
- Sandy paths, a tall-grass field, a garden patch, flower beds, fireflies.

### The cottage interior (Built)

Bigger inside than outside, as in Pokémon. One 18 by 13 room divided into four:

- Your bedroom
- Your parents' bedroom
- Living room
- Kitchen

Entering and leaving is an instant scene switch with a quick fade. Only this one building has an interior.

### Known problems

- Still uses the old grass.
- The interior only loosely matches the exterior.
- **Fixed:** the door trigger used to fire anywhere north of the doorstep in a strip as wide as the door, so trees, bushes and the back of the house sent you inside.

## Test Meadow (Built)

A simpler world for testing creatures and terrain. Loads in seconds.

- Rolling hills up to about 3.5 m, one steeper knoll.
- A lake you can wade into. Deep water stops you.
- Scattered oaks, pines, rocks and bushes. The new grass, flower clusters and reeds.
- The calf by the lake, the young bull on the east hill, the lava bull on the west hill.
- Creatures tilt to match the slope under them. Fire creatures will not enter water.

## The coastal town (Decided, not built)

Fernhollow will be rebuilt as a coastal town on a slope, based on two reference paintings:

**Painting 1: the harbour.** A thatched cottage with a striped awning and fruit stall. A windmill on a grassy bluff. A blue-roofed tower with a flag. A cluster of red-roofed houses, a market with striped canopies, a stone harbour wall, a wooden dock with a rowing boat, a beach, clear turquoise water, a stone aqueduct and mountains behind.

**Painting 2: the road out.** A winding dirt path leaving town between cottages. Tall wind-blown grass. Rock shelves capped with grass. A wooden signpost. Rolling hills to a rocky peak on the horizon.

Uses existing assets plus new ones drawn from these.

## Map structure (Decided)

Modelled on **Clair Obscur: Expedition 33**:

- Linear routes, not open world.
- Branches, side paths and optional areas.
- Strong changes in height.
- Creative placement of buildings.
- Larger and freer than a Pokémon tile grid.
- Free movement, no one-way ledges.

A useful side effect: each area is self-contained, so only one loads at a time.

## Height (Planned)

| Feature | Difficulty | Approach |
|---|---|---|
| Rolling hills | Easy. **Done in the meadow** | Sculpt the ground height |
| Distant mountains | Easy | A backdrop you cannot reach |
| Buildings on different levels | Medium | Flatten a pad under each, add a stone foundation |
| Cliffs and rock shelves | Medium | Rock-wall pieces along steep edges, grass on top |
| Terraces and retaining walls | Medium | The same wall pieces, with stairs or ramps |
| Walking rules | Medium | Steep slopes block you, cliff edges stop you |
| Beach, shallows, sea | Medium. **Wading done** | Sand into water, wading depth, deep water |
| Bridges, arches, aqueducts | Hard | Two walkable surfaces stacked |

**Knock-on problems**

- Hills and cliffs will hide the player. The building fade must extend to terrain, or the camera must lift.
- A bigger world means loading areas as you go.

## Sky, ocean, day and night (Decided, not built)

Right now the background is a flat dark colour.

| Feature | Planned approach |
|---|---|
| Sky | A colour gradient drawn behind everything |
| Sun and moon | Discs that move across the sky |
| Clouds | A few large soft layers far away. Not true volumetrics |
| Ocean | One flat animated surface out to the horizon, with foam at the shore |
| Day and night | Needs lighting calculated while playing |

All must be cheap. The ocean must look endless without drawing endless detail.

## Biomes (Decided so far)

| Biome | Who lives there |
|---|---|
| Coastal starter region | Early common creatures. No starters |
| Volcanic mountains | The fire bull line |
| Others | To be designed alongside the creature list |

## Region theme (Decided)

A tropical island chain with Caribbean inspiration, kept light. Creatures and places should feel like they belong to a fictional world.
