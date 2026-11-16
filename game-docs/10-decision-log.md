# Decision log

In the order things happened. Quotes are Jaedan's words.

## 1. The spark

- Jaedan shared a thread on X about pixel-art gaussian splats and asked how hard it would be for a game.
- A first demo was built: his concept-art cottage, animated.
- Feedback on the tree: "still looks like a broccoli tree but better", then "Ok beautiful."

## 2. The town

- "Can you build a world in this style? Like a Pallet Town from Pokémon." → Fernhollow.
- "Up close I can see the low res quality and the individual circles." "I want this to be game ready." → blended surface splats.
- "Fixed zoom, decently close to player, and anything not in frame isn't rendered." → fixed camera, culling.
- "All you did was add colour themes, I feel like we need to double our resolution." → resolution raised. **Lesson: fix the thing asked for.**
- "Windows need work." "Why does our main house look so undetailed?" → asset detail pass.
- "Blur entire buildings, not just a hole." → whole-building fade.

## 3. Interiors

- "Let's test out interiors. Fast loading screens."
- "Looks pretty bad again. Low res, black spots." → finer interior splats, outline fix.
- "This is indoor. Lighting isn't supposed to look like this." → indoor lighting.
- "Interior way bigger than what it looks like. Bedrooms, kitchen. My own and my parents'." → four-room layout.

## 4. Display settings locked

- "Remove the themes. I only want full colour, dither, res at 400 and no outline."

## 5. The hero

- Eleven concept images supplied. First build: "YOO THAT'S SO BAD."
- Several rounds on face, proportions, hair, eyes.
- "This is trying too hard to look like the model. Stylise it."
- "No need to render the mouth." "Make the eyes look right."
- Agreed workflow: show an approval sheet before putting character changes in the game.

## 6. Animation

- "His running animation is so chopped. Also we've dropped to 30 to 45 fps."
- "Do some research on run animation keyframes." → keyframed walk and run.
- "Insane fps drops." → hero cut to about 200,000 splats, half-detail drawing.

## 7. The intro

- "User getting out of bed, getting dressed. Don't animate them putting on clothes, except the bag."
- "The player is halfway through the bed. Animations are so static and dead. The bag goes straight through." → rebuilt.
- "It's fine I guess, **gameplay is king** right now."

## 8. Direction set

- "We're basically making Pokémon Fire Red but re-skinned. Our own story, Pokémon etc."
- "Can we use the Pokémon engine?" → no. Build our own systems with original content.
- "I want **procedural monsters**. They run around, all in the wild, **no tall grass**. Unique traits per species, gender, location."

## 9. Starters

- Region: "tropical islandish."
- First designs rejected: too cultural, a stove on a creature's back, the same animal at every stage, final stages too cute.
- "We can't have two flying types. Make one a flightless bird."
- "Retry the poison dart but don't make him bipedal." "He also just looks goofy."
- Three sheets approved: flightless wader, leaf bat, fire bull.

## 10. Models into the game

- "If I get 3D models of this can you put him in game?" → yes, by scattering splats over the mesh.
- Sheets cut into views for the image-to-3D tool.
- Calf and young bull delivered, converted, roaming.
- "Can you rig them properly? I want the flames actually animated, and the steam." → jointed rig, live flames, steam. Lava bull added.
- "The whole horn shouldn't be burning, just the tips. Slow it down, it's more of a **cool fire**."
- "Animations feel unnatural in the way they keep happening. Timing is inorganic. Two animations can't play at the same time." → layered random actions.
- "Shadows are fucked for player and the animals." → soft ground shadows.
- "Bull animations snap between each other and are very similar. We need idle animations." → distinct sets, easing, idles.
- Bug: "Certain assets will trigger me to enter my house." → door trigger fixed.

## 11. Planning

- "They don't walk around naturally. Think about their personalities and how these animals might interact with the world and the player." "We plan right now."
- "All these things are **systems that other mons might use**."
- "I want **verticality**. Mountains, hills, elevations, buildings on different planes." Two reference paintings supplied.
- "Even in the quadrupeds there are going to be so many different styles of walking, running and hopping."
- The plan page was written.

## 12. Test Meadow

- "Create a test world, more basic. Grass, water, hills. Put the mons in there."
- "Improve the 2nd and 3rd gen. **The first gen feels great and feels real.** Try to emulate that."
  - What the calf had that the bulls lacked: ears, a reaction to the player, bounce, soft moving parts.

## 13. Grass

- "Grass looks so out of place compared to the trees."
- Sculpted tufts: "I don't like the flat pieces. Feels like all or nothing. Looks patchy. Too dark spots. **Look at how stylised grass looks.**"
- Stylised field built from research: "**Holy smack this looks good.**"
- Black one-pixel dots in swaying grass reported and fixed.

## 14. Scope and engine

- "They are fire rock bulls so they are probably living in the volcanic mountains."
- "We need a gigantic map. I plan to have **100 mons**."
- "Starter mons are rare, they aren't for our starting base."
- "Rebuild Fernhollow. We are making the **coastal town**."
- "A sky, volumetric clouds, an ocean, infinite ocean. Optimised greatly. The sun, the moon. **Day and night cycle.**"
- "Free roam." Map layout "almost exactly like **Clair Obscur**": linear, varied elevation.
- "Creatures can start battles depending on temperament. Most battles will be ones that you start."
- "Not too many creatures on screen." Herds, packs and schools wanted if possible.
- "Is it viable to continue building this in JavaScript in the browser, or should we move to an actual game engine?"
- Frame rate reported: "**120 when the pixelation is on**, once it's off we go down bad."
- Recommendation: test the look in Godot first, before building more.

## Working preferences

- Direct, fast answers.
- A visual learner; analogies help.
- Show before-and-after images.
- Say what is unverified.
- Plan when asked to plan; build when asked to build.

## Bible Quest

Decisions locked in with the Bible Quest tracker.
- 2026-11-15. **Confirm the Defaults in 11-story.md**: Overall awakening rules are good
  We need a little more cast, I want this world to feel ALIVE, let's add RDr2 to our concepts for reference.
  everything else is good
  - Tone rules (Default) › *The characters joke; the world doesn't. Mum, the rival, townsfolk and the creatures' pe…*: **Note**. We don't need to try too hard with humor. Maybe we can try some jokes and see how it feels.
  - Tone rules (Default) › *Show the serious side, don't announce it. A keeper who guards a stone and can't remembe…*: **Note**. Very important we show rather than tell. Story-telling 101
  - Tone rules (Default) › *The seriousness lands through creatures. The stolen starter's forced form is the moment…*: **Change**. Shouln't be stop smiling forever of course. its a moment to take it in but darker tones should be understood from the jump but not pushed you know. Like the real world. Thats just how things are.
  - Tone rules (Default) › *Nobody is evil for fun. The heir is grieving and certain. His crew believe him.*: **Change**. Sometimes there are just assholes.
  - 7. The rival (Default) › *The guilt makes them want a shortcut. Mid-game the heir's offer tempts them, and they s…*: **Change**. IDK
