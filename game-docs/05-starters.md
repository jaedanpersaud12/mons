# Starters

Three lines, three stages each. The concept sheets Jaedan generated and approved are the reference.

## Design rules (Decided)

These came from rejected rounds and apply to every creature.

1. **Light cultural touch.** Earlier designs were "too tied into Caribbean tropical culture". Do it the way Pokémon does.
2. **No man-made objects.** One design had a stove on its back. "How does an animal ever evolve to have an actual stove?"
3. **Type must read.** The water starter drifted "a little too red".
4. **One flyer only.** So the water bird is flightless.
5. **Evolutions add features.** Not "the same animal getting older".
6. **Final stages command respect or intimidate.** "Not cutesy."
7. **Identity.** A design must be recognisably its own thing. The armadillo was dropped for having none.
8. **Not goofy.** The poison dart frog was dropped for being bipedal and silly.

## Rejected along the way

- An agouti fire starter (looked the same at every stage)
- An armadillo (no identity)
- A poison dart frog (bipedal, goofy)
- A creature with a stove on its back

## Fire: the bull line

| Stage | Look | Added at this stage |
|---|---|---|
| Calf | Round red-brown calf, big eyes, floppy ears, glowing ember horn nubs | |
| Young bull | Charging stance, angry brow, dark smoke mane, flame-tipped horns, glowing hooves, steam from the nostrils | Smoke mane, burning horns, molten hooves |
| Lava bull | Huge, dark rock plates split by glowing lava cracks, great curved horns with glowing tips, a flame-tipped tail, smoke from the hump | Rock armour, lava cracks, flame tail |

- **Type:** Fire, with a second type later. Planned as Fire/Ground. Jaedan has since called them "fire rock bulls". **Open.**
- **Home:** volcanic mountains.
- **In game:** all three are built and roaming.

## Water: the wader line

| Stage | Look | Added at this stage |
|---|---|---|
| Chick | Round blue chick, teal curl crest, red mask around the eyes, red leg bands | |
| Duellist | Slender long-legged wader, curved red-tipped bill, fin-like wings, flowing teal tail plumes, leg spurs | Bill, tail plumes, spurs, fin wings |
| Final | Tall, layered blue-to-white plumage like breaking surf, a wave-shaped crest with spray, long blade feathers | Wave crest, wing blades, cloak of plumage |

- **Type:** Water, later Water/Fighting. Flightless.
- **In game:** not yet. No model.

## Plant: the bat line

| Stage | Look | Added at this stage |
|---|---|---|
| Pup | Big-eared brown bat pup wrapped in a leaf bud, sprout tail | |
| Mid | Leaf-shaped wings, leaf ears, a purple flower bud on its back, a curling thorned vine tail | Leaf wings, flower bud, thorn tail |
| Night king | Tall cloaked figure, antler branches with new leaves, a wide lily collar, glowing eyes, a cloak of layered leaves hiding glowing seed lanterns, clawed feet | Antlers, flower collar, lanterns, cloak |

- **Type:** Grass, later Grass/Dark. The only flyer.
- **In game:** not yet. No model.

## Type notes (Open)

- We write our own type chart.
- A known tension: if Fighting beats Dark, the water starter's final type beats the plant starter's. Check this when balancing the starter triangle.

## What is built for the bull line

### How the models got in

1. Jaedan generated 3D models from the concept sheets with an image-to-3D tool that takes several views.
2. The sheets were cut into front, side and back images, plus a mirrored side for the opposite view.
3. Each model arrived as a file of about 80 MB with 1.5 million triangles, a texture, and **no skeleton**.
4. A converter scatters splats over the surface and takes each splat's colour from the texture.
5. Because there was no skeleton, each model was split into bones by position.

### The rig

16 bones per creature:

- Chest, hindquarters
- Head
- Upper and lower leg, four times
- Tail and tail tip
- Two ears (calf and young bull)
- Mane (young bull)

Each splat belongs to one bone and blends toward that bone's parent, so joints bend instead of tearing.

### Effects

- **Young bull:** horn tips flicker slowly ("a cool fire"), a few embers drift up, the smoke mane billows, steam bursts from the nostrils on a snort.
- **Lava bull:** the tail flame flickers, smoke rises from the hump, steam on a snort.
- **All:** glowing parts pulse gently.

### Actions

| Creature | Calm | When it notices you |
|---|---|---|
| Calf | Look, head tilt, sniff, shake, rest a leg, hop, lie down | Jump, trot over, play-bow, fast tail wag, head tilt |
| Young bull | Look, rest a leg, shake, horn toss, scrape, lie down | Square up, stomp, scrape, snort, bluff-charge, horn toss |
| Lava bull | Slow head swing, rumble, rest a leg, lie down | One rear-and-slam or rumble, then ignores you |

### Known quirks

- The calf and young bull have a second tail tuft on one flank, because the front-view image showed the tail to the side.
- The young bull's model is frozen in a charging stance. A neutral pose would animate better.
- The lava bull's ears could not be separated from its horns.
- The lava bull stands about 1.8 m at the hump, taller than the hero.

### What to ask for in future models

- A neutral standing pose.
- A skeleton, and animation clips if the tool offers them.
- A check of the back and underside before sending.
- One file per stage.
