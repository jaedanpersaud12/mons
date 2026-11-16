# Creature framework

Every system here is meant to work for all 100 creatures. A species is a **sheet** that the engine reads. A new creature should mean filling in a sheet and adding two or three signature moves.

Status: the sheet system is **Planned**. The three bulls run on a hand-written early version of it.

## The species sheet

| Section | What it holds | Example: young bull |
|---|---|---|
| Body plan | Which rig and movement family | Quadruped |
| Movement style | The numbers that make its walk its own | Heavy, low head, stiff stride |
| Temperament | Curiosity, aggression, skittishness, sociability, energy, territoriality (0 to 1) | Low curiosity, high aggression, high territoriality |
| Needs | Hunger, thirst, rest, comfort, social, and what satisfies each | Grazes, drinks, rests in the open |
| Habitat and schedule | Where, when, and weather it likes | Volcanic slopes, daytime, avoids water |
| Social structure | Solitary, pair, herd, parent with young, swarm | Solitary |
| Relationships | Predator, prey, rival, ignores | Gives the lava bull space |
| Signature actions | Two or three moves only it does | One-leg stomp, scrape, horn toss |

Evolution stages share a sheet with shifted numbers. Variants nudge the numbers so two of a kind differ.

## Body plans

| Body plan | Examples | Gets around by | Status |
|---|---|---|---|
| Quadruped | The bulls | Walk, trot, gallop, bound | Rig built |
| Biped | The wader | Walk, strut, run, hop | Planned |
| Flyer | The bat | Perch, flap, glide, land, hang | Planned |
| Swimmer | Fish | Swim, surface, dive | Planned |
| Amphibious | Wader, frogs | Wade, swim, come ashore | Planned |
| Crawler | Snakes, lizards, bugs | Low to the ground, climbs steep slopes | Planned |
| Floater | Spirits | Ignores terrain | Planned |
| Burrower | Moles, crabs | Sinks in, surfaces elsewhere | Planned |

## Movement styles within a body plan

"Quadruped" is only the skeleton. Two quadrupeds can move nothing alike.

### Gait library

A gait is the order and timing of footfalls.

| Gait | Pattern | Feel | Status |
|---|---|---|---|
| Walk | Four separate beats | Heavy, steady | Built (both bulls) |
| Trot | Diagonal pairs together | Bouncy | Built (calf) |
| Gallop | Hind pair, then front pair, then airborne | Fast, back flexing | Built as a speed blend |
| Pace or amble | Same-side legs together | Rolling, swaying | Planned |
| Bound or hop | Hind pair pushes, front pair lands | Rabbits, frogs | Planned |
| Pronk | All four at once, stiff-legged | Springy, playful | Planned |

Speed picks the gait and the engine blends between them.

### Style numbers

| Number | Low | High |
|---|---|---|
| Weight | Light and quick | Heavy, slow to start and stop |
| Stride length | Short patter | Long lope |
| Bounce | Glides level | Bobs |
| Knee lift | Shuffle | Prance |
| Spine flex | Rigid | Whip-like |
| Stance width | Legs under the body | Sprawled |
| Sway | Straight | Waddle or slither |
| Head carriage | Low, steady | High, bobbing |
| Tail behaviour | Limp | Active counterbalance |
| Limb proportions | Even | Big haunches or big shoulders |

### Example styles on one skeleton

Heavy plodder (bulls, bears). Stubby trotter (the calf, piglets). Springer (deer, goats). Stalker (cats, foxes). Hopper (rabbits). Sprawler (lizards). Scurrier (mice, crabs). Loper (wolves, horses).

Other body plans need the same treatment: bipeds strut, waddle, hop or sprint; flyers flap, soar, flutter or hover; swimmers sweep, paddle, jet or undulate.

## Behaviour

### Needs (Planned)

Meters that fill over time. The highest decides what the creature does next, so it walks to the pond because it is thirsty, not to a random point.

Hunger, thirst, rest, curiosity, comfort, social.

### Points of interest (Planned)

| Thing | What creatures do there |
|---|---|
| Water's edge | Drink, wade, fish |
| Tall grass, flowers | Graze, sniff, hide |
| Trees | Shade, rub, roost, pick fruit |
| Rocks, ledges | Bask, scrape horns, climb, keep watch |
| Fences, signs | The curious sniff them |
| Paths, buildings | The shy avoid them |
| High ground | The territorial claim it |

### Habitat, time, weather (Planned)

Where it lives, when it is active, and how its element reacts. Fire types avoid water and rain. Water types come out in it. The bat sleeps by day.

### Each other (Planned)

Herds move together with one on watch. Young stay near a parent. Rivals posture. Prey keeps away from predators. Type matchups can drive this. Alarm spreads.

## Reacting to the player

**Stages (Built in a first form):** unaware, notice, watch, react, lose interest.

- Awareness builds over a moment, faster when you are close or running.
- The head turns to look before the body turns.
- The reaction depends on temperament: flee, hide, approach, warn, bluff-charge, attack, or ignore.

**Planned:** memory (a creature gets used to you), your party affecting reactions, attack starting a battle.

## Animation layers

Layers add together so two things can happen at once and nothing pops.

| Layer | What it does | Status |
|---|---|---|
| Movement | The gait for the current speed, turning, leaning | Walk, trot, gallop built |
| Always-on drift | Breathing, small shifts, a tail swish that never visibly loops | Built |
| Body action | One at a time: stomp, bow, look, sniff, shake, lie down | Built |
| Secondary action | On top of anything: snort, tail lash, ear flick, wag | Built |
| Look-at | Head tracks what it is interested in | Built for the player |
| Slope alignment | Body tilts to the ground | Built |
| Effects | Flames, steam, smoke, embers | Fire set built |

**Rules learned from feedback**

- No fixed repeating clocks. Actions are picked at random with random gaps.
- Every action eases in and out.
- Actions that belong together should be able to overlap (stomp and snort).
- Different creatures need different moves, not the same move at different sizes.
- Idle animation matters as much as reactions.

**Still missing:** drinking, eating properly, startle, swimming, walking up and down slopes with adjusted stride, sleep as distinct from lying down.

## Scale and performance (Decided direction)

- Few creatures on screen.
- A herd of one species shares its data.
- Distant creatures use fewer splats and simpler behaviour.
- The real limit has not been measured.
