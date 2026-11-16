# Art direction and rendering

## Where the look came from

A thread on X by Silicon Jungle about "pixel-art gaussian splats". The recipe:

1. Describe a shape as a signed distance field (a formula that says how far any point is from the surface).
2. Place splats on that surface.
3. Run a pixel-art pass over the result.

Everything is procedural code. No hand-modelled meshes, no textures.

## How our version works (Built)

**Sculpt.** Each asset (cottage, tree, bush, lamp, the hero) is built from simple solids: boxes, ellipsoids, capsules, cylinders, blended together. Each solid has a paint function that sets its colour.

**Bake.** The shape is sampled into a grid. Points are scattered and pulled onto the surface. Each point stores position, facing direction, colour, a sway amount and a size.

**Place.** An asset is baked once and stamped into the world many times. Each copy is lit separately: a bright side, a dark side, darkening in creases, and shadow.

**Draw.** Splats are flat discs angled to the surface they sit on. Two passes: first depth, then a soft blend where nearby splats mix their colours. This is what removes visible circles.

**Pixel pass.** The scene is drawn at low resolution and scaled up with hard pixels. Colours are snapped to a palette made from the scene itself, with dithering.

## Locked display settings (Decided)

| Setting | Value |
|---|---|
| Palette | Full colour only. Themes removed |
| Dither | On |
| Resolution | 400 lines |
| Outline | Off |
| Colours | 28 |

## Lighting (Built)

- **Outdoors:** one sun direction, sky fill, shadows cast by buildings and trees.
- **Indoors:** even fill plus point lights from lamps and the fireplace. Added after the interior looked wrong under outdoor sun.
- **Limit:** lighting is calculated once at load and stored in each splat's colour. It cannot change while playing. Day and night needs this rebuilt.

## Shadows under characters (Built)

The first version used a patch of dark splats under each character. It looked broken. Now the ground and grass under the player and each creature are darkened in a soft oval that follows them. The player's shrinks and fades during a jump.

## Grass (Built, in the Test Meadow)

Three attempts:

1. **Loose blades.** Thousands of thin slivers scattered at random, each lit the same. Read as noise next to the trees. Rejected.
2. **Sculpted tufts.** Clumps built and lit like bushes, scattered with bare ground between. Looked patchy and "all or nothing", with dark spots. Rejected.
3. **Stylised field.** The standard games approach, found by looking at published grass shaders. Accepted: "Holy smack this looks good."

**What the accepted version does**

- One dense, even field. Blade length varies smoothly; nothing is switched on or off.
- Each blade's root takes the colour of the ground under it and fades to a lighter tip.
- Blades are lit by the slope they stand on, not individually, so the field shades as one soft surface.
- Tree shadows are softened on grass and ground.
- Wind lightens and darkens the field in moving bands.
- Flower clusters and reeds are sculpted shapes, evenly lit.

**Still to carry into the main town.** Fernhollow still has the old loose blades.

## The black dot bug (Fixed)

Swaying grass showed flickering one-pixel black dots. A pixel covered only by the faint edge of a single blade was treated as empty and showed the background. Fix: every splat now contributes a small minimum amount, and stray empty pixels are filled from two neighbours instead of three. Isolated dark pixels in a test frame fell from 985 to 1.

## Seeing through buildings (Built)

When a building is between the camera and the player, the whole building fades with a dithered pattern. Interior walls facing away from the camera are hidden. Partition walls hide when the camera and player are on opposite sides.

## Performance

**Measured on Jaedan's Mac, Test Meadow:**

- **Pixel pass on: 120 fps.** Likely the screen's refresh limit, so the true figure is higher.
- **Pixel pass off: falls badly.** The same splats are drawn at full screen resolution.

**What keeps it fast (Built)**

- The world is cut into 4-unit cells. Cells outside the camera's view are skipped.
- By default only half the splats in each cell are drawn, enlarged to compensate. Introduced after earlier frame drops; at 120 fps there is room to raise this.
- If frames run long, detail drops automatically, then recovers.

**Rough splat counts**

| Thing | Splats |
|---|---|
| Hero | about 200,000 |
| Bull calf | about 42,000 |
| Young bull | about 51,000 |
| Lava bull | about 67,000 |
| Fernhollow town | about 4.1 million |
| Cottage interior | about 2.0 million |
| Test Meadow | about 2.3 million |

## Not yet built

- Sky, clouds, sun, moon
- Ocean
- Day and night
- Cliffs and rock walls
- Water with waves and shoreline foam
