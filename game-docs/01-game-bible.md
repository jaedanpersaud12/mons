# Game bible

Only what has been decided. Anything still open is in `09-open-questions-and-backlog.md`.

## 1. What the game is

- A creature-collecting RPG. "Basically Pokémon Fire Red, re-skinned", with our own story, world and creatures.
- **Gameplay is king.** Visual polish follows working systems.
- About **100 creatures** are planned.
- No title yet.

## 2. Pillars

1. **Creatures live in the world.** They roam where you can see them. No random tall-grass encounters.
2. **Every creature is an individual.** Traits vary by species, gender and location: tails, colourings, sizes, weights.
3. **Creatures have personalities.** How they move, what they do and how they treat you depends on temperament.
4. **A painted, pixel-art world** built from splats, with real height.

## 3. Look

- **Pixel-art gaussian splats.** Sculpted shapes covered in soft discs, drawn at low resolution with a limited palette.
- **Locked display settings:** full colour only, dither on, 400 lines of resolution, no outline, no colour themes.
- The pixel pass is the game's look and also what makes it fast. Full-resolution "raw splats" is a debug view only.
- Reference paintings: a coastal village on a slope with a windmill on a bluff, rock shelves capped in grass, stone walls, a dock, and a winding path through hills.

## 4. World

- **Region:** a tropical island chain. Caribbean-inspired, but lightly. "Think about how Pokémon does it": real places inspire, they are not copied.
- **Starter town:** a **coastal town**. Fernhollow will be rebuilt as this, using existing assets plus new ones from the references.
- **Map structure:** like **Clair Obscur: Expedition 33**. Linear routes with branches and side paths, strong variation in height, creative building placement. Not open world. Not a tile grid.
- **Movement:** free roaming. No one-way ledge rules.
- **Height matters:** hills, mountains, elevation, buildings on different levels.
- **Environment:** a sky, clouds, sun and moon, an endless ocean, and a **day and night cycle**.
- **Biomes follow creatures.** The fire bulls live in **volcanic mountains**, not the starting area.

## 5. Creatures

- **Roaming, visible, touch or approach to engage.** Most battles are started by the player.
- **Aggressive temperaments can start a battle.** Timid ones flee. It depends on the creature.
- **Starters are rare** in the wild and do not appear around the starting town.
- **Only first-stage creatures** (and some second-stage) appear in a given area's wild population.
- **Few creatures on screen at once**, to protect performance. Herds, packs and schools are wanted if affordable.
- **Every system is built to be reused** by other creatures. A species is described by a sheet, not by custom code.
- Within one body type there are many movement styles (a bull plods, a deer springs, a rabbit hops). This must be designed for.

### Creature design rules

1. Not too tied to any real culture.
2. **No man-made objects** on creatures.
3. A creature's type must read at a glance. The water starter must look like water.
4. **Only one flying starter.** The water bird is flightless.
5. **Each evolution adds features.** It is never only bigger or older.
6. **Final stages command respect or intimidate.** Never cute.
7. No goofy designs. (The rejected frog was bipedal and silly.)

## 6. Starters

| Line | Stage 1 | Stage 2 | Stage 3 | Typing |
|---|---|---|---|---|
| Fire | Ember-horned bull calf | Young bull with a smoke mane and burning horn tips | Massive lava-cracked bull | Fire, later a second type |
| Water | Small blue wader chick | Slender duellist wader | Tall wave-crested wader with wing blades | Water, later Water/Fighting |
| Plant | Leaf-wrapped bat pup | Leaf-winged bat with a flower bud and thorn tail | Cloaked "night king" with antler branches and seed lanterns | Grass, later Grass/Dark |

The bat is the only flyer. The fire line's second type is open: it was planned as Fire/Ground, and has since been described as fire and rock.

### Bull line personalities

- **Calf:** curious, playful, friendly. Trots up to you. Bolts if you rush it, then returns.
- **Young bull:** territorial and proud. Warns in stages, then bluff-charges and stops short.
- **Lava bull:** ancient and calm. Barely notices you. One heavy warning if you come very close.

## 7. Battles and catching

- A Fire Red style system: turn-based battles, a party, catching, a type chart.
- **Our own type chart**, to be written and balanced later.
- **Catching is a menu action inside battle.** This is deliberate, to stay clear of patents on capturing creatures in the field.
- **Built from scratch.** We do not use the Fire Red decompilation or any Nintendo code or assets.

## 8. Player character

- A young villager in a green cap, red jacket with cream trim, blue shorts, fur-cuffed boots, a backpack and a yellow sash.
- Stylised rather than a literal copy of the concept sheet. No visible mouth. Brown eyes with whites and a highlight.
- Animations must be fleshed out: idle, walk, run, jump.

## 9. Story beats decided

- The game opens with the hero **waking up in bed** at home in the starter town, early morning.
- Mum calls him to breakfast. He gets dressed (a fade, not animated) and puts on his backpack (animated).
- He has promised to walk to the town gate today.

## 9b. Story, gimmick and structure (summary)

Full detail in `11-story.md`.

- **Tone:** light-hearted on the surface, serious underneath (the *Avatar* model).
- **Gimmick:** awakening, our version of Mega Evolution. 12 species in this region can do it. Needs that species' stone plus a deep bond. One per battle. Not legendaries: many of each exist, and anyone bonded can awaken one.
- **Why it works:** elemental energy (the Current) flows through the world like water. Creatures absorb it; types come from biomes; evolution is the body growing to hold more.
- **Story:** a once-a-century surge is due. A century ago a man forced creatures to hold it back and destroyed an island. His heir is about to repeat it. The hero restores the bond so the whole region can hold the surge together.
- **Starters:** the warden's rescues, carried home along the way.
- **Structure:** the sea is the overworld and your boat is the traversal. Fixed story islands with open tiers between them, any order. Keepers are the gym leaders, their stones are the badges, and they scale to stones held.

## 10. Technical direction

- Prototyped in the browser as a single page.
- **Recommended: move the real game to Godot**, keeping the browser build as a sandbox. A small test decides this. See `08-engine-decision.md`.
