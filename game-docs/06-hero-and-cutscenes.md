# Hero and cutscenes

## The hero (Built)

Sculpted by hand in code from Jaedan's concept sheet, 1.55 units tall, about 200,000 splats.

**Look:** green cap with a red and gold pin, spiky brown hair, brown eyes, red jacket with cream collar and cuffs and gold buttons, blue shorts, a yellow sash, fur-cuffed brown boots, a rolled backpack.

### How the design settled

It took many rounds. The feedback, in order:

- First attempt rejected outright.
- Face looked goofy; proportions were off from the reference; hair was in the wrong place.
- Eyes were solid black with no white. Hair poked through the cap brim.
- It was "trying too hard to look like the model". **Stylise it** so it fits the world.
- **Remove the mouth.** Give the eyes proper whites.

**Lessons**

- Small characters need far finer splats than buildings. Detail was tripled.
- Painted-on features turn to noise. Eyes and brows work better as raised shapes.
- Show character changes as an approval sheet before putting them in the game.

### Skeleton

14 bones: hips, torso, head, eyes, two bones per arm, two per leg, the pack and the sash.

## Movement (Built)

- WASD or arrow keys to walk, Shift to run, Space to hop, click the ground to walk there.
- Quick to start, a short slide to stop.
- Collides with buildings, props and creatures.

### Walk and run animation

The first version was a simple swing. The feedback: choppy, feet going outward, no bounce, arms wrong, not leaving the ground, bounce at the wrong moment.

The fix came from looking up how run cycles are animated:

- Four key poses: contact, down, push, peak.
- The body is lowest just after the foot lands and highest when airborne.
- A runner's arms are widest at the airborne high point.

Walk and run are now built from keyframes for the thigh, knee and body height, with smooth curves between. Legs angle slightly inward while moving.

**Unverified:** timing has only been judged from still frames. There are no ankle or finger joints.

## Camera (Built)

- Fixed distance, fairly close, looking down at an angle.
- Follows with a slight lead in the direction of travel and eases to a stop.
- Q and E or dragging turns it.
- Pulls back a little when running.
- Buildings in the way fade out whole.

## Cutscene system (Built)

A small script engine with these commands:

| Command | What it does |
|---|---|
| Say | A text box with a typewriter effect. Space, Enter or click advances |
| Wait | Pause |
| Fade | Fade the screen out or in |
| Walk to | Send the hero to a spot |
| Pose | Blend the hero into a preset pose over time |
| Snap camera | Jump the camera to a framing |

Poses are a set of adjustable values on top of normal animation: lying down, eyes closed, each arm and elbow, lean, crouch, head turn and nod, talking, and where the backpack is.

A Skip button is always available. The intro can be replayed.

## The intro (Built)

1. "Fernhollow. Early morning." The hero is asleep in bed.
2. **Mum:** "Rise and shine, sleepyhead! Breakfast is on the table."
3. **You:** "...Five more minutes..."
4. **Mum:** "You said you would walk to the gate today. Up you get!"
5. He sits up and gets out of bed.
6. "You get dressed." A fade. **Putting on clothes is not animated, by request.**
7. **You:** "Boots on, cap on. Just need my pack."
8. He picks the backpack up from the floor and swings it round his right side onto his back. **This is animated, by request.**
9. **You:** "There. Ready for anything."
10. Controls hint. The front door is through the living room.

### How the first version failed

- The hero was sunk halfway into the bed.
- Poses were static and lifeless.
- The backpack passed straight through his body with no real motion.

It was rebuilt with timed joint targets and a path for the pack that goes around the body. Jaedan's verdict: "It's fine I guess, gameplay is king right now."

### Known gaps

- Checked on a stand-in set, not in the real bedroom.
- He sleeps fully dressed on top of the blanket.
- Mum is a voice only. She has a concept sheet but no model.
- No close-up camera shots.
