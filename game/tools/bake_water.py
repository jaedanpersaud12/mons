#!/usr/bin/env python3
"""Rebuild the lake so the water is see-through.

The exported world has one flat sheet of blue splats where the lake is and
nothing underneath. This script replaces that with:

  * a real lakebed (sand, with darker and weedy patches) that follows the terrain,
    including a deep hole dug in the middle of the lake
  * rocks, corals and sea plants standing on the bed
  * a thin layer of surface splats that the shader only shows as foam or glints

The water itself is no longer drawn. The shader tints everything that is below
the waterline by how deep it is, so the bed and whatever stands on it show through.

It also refits the 28-colour palette so it has room for the water.

Run from the game folder on the ORIGINAL export:   python3 tools/bake_water.py
Needs numpy. It refuses to run on data it has already rebuilt (world.json gets "water_v": 3).
The original export is in git: commit 74c9132, game/data.
"""
import json
import sys
from pathlib import Path

import numpy as np

DATA = Path(__file__).resolve().parent.parent / "data"
WATER = -0.2
WDMAX = 3.0                      # deepest depth a surface splat can store
POND = (7.0, 6.0, 7.5, 5.0)      # lake centre x, z and radii
ZONE = 1.5                       # the shader treats pond radius below this as lake
HOLE = (0.42, 0.10, 2.6)         # the deep hole: starts at this pond radius, full depth by this one, extra depth
SHELF = (1.08, 0.78, 0.3)        # the shelf around the hole is lowered a little so things on the bed have room: from, to, extra depth
CELL = 4.0                       # map cell size
PAD = 0.6                        # padding on each cell's bounds, as in the export
# the water's look: the shader uses the same numbers
WSHALLOW = np.array([0.20, 0.74, 0.80])   # the colour of the water itself in the shallows
WDEEP = np.array([0.02, 0.13, 0.40])      # and in deep water
WVEIL = (0.16, 0.5, 0.8)                 # how much of that colour lies over things: at the surface, extra at depth, rate

rng = np.random.default_rng(20261116)


def hexc(h):
    return np.array([(h >> 16) & 255, (h >> 8) & 255, h & 255]) / 255.0


SAND1, SAND2 = hexc(0xE9D2A2), hexc(0xD9BB89)
WATER1, WATER2 = hexc(0x86D6D2), hexc(0x2F86AD)
BED_WEED, BED_DARK = hexc(0x6FA06A), hexc(0xC9B98E)
ROCKS = [hexc(0x6E6A7C), hexc(0x5C5868), hexc(0x7A7684)]            # the same purple-grey as the rocks on land
# Under water the palette only has room for two coral colours, a pink and a lilac, so everything living is one of those two families.
BRANCH = [hexc(0xFF5E8A), hexc(0xB45CF0), hexc(0xFF6F9E), hexc(0x9A6CF2)]
BRAIN = [(hexc(0xC8507E), hexc(0xFFB3CC)), (hexc(0x7E56C8), hexc(0xD2B8F8))]
TUBES = [hexc(0x9B4DE0), hexc(0xF0508A), hexc(0x7A5CE8)]
STARS = [hexc(0xFF4F7A), hexc(0xF23A6A)]
# The lake gets eight palette colours of its own. The tint is tuned so that what is under water lands on these.
WATER_PAL = [hexc(0x082C68), hexc(0x146096), hexc(0x2C5468), hexc(0x348C96), hexc(0x68C4BA), hexc(0xA0DECC), hexc(0x9682BE), hexc(0xD68496)]
LAND_COLOURS = 24
PLANTS = [(hexc(0x1F6B3A), hexc(0x6FCF4A)), (hexc(0x1E5E52), hexc(0x4FC08A)), (hexc(0x4A6A1E), hexc(0xA8C83A))]


# ---- the browser build's hash and noise, bit for bit ----
def h3(x, y, z):
    x = np.asarray(x, dtype=np.int64).astype(np.uint32)
    y = np.asarray(y, dtype=np.int64).astype(np.uint32)
    z = np.asarray(z, dtype=np.int64).astype(np.uint32)
    with np.errstate(over="ignore"):
        h = x * np.uint32(374761393) + y * np.uint32(668265263) + z * np.uint32(1274126177)
        h = (h ^ (h >> np.uint32(13))) * np.uint32(1274126177)
        h = h ^ (h >> np.uint32(16))
    return h.astype(np.float64) / 4294967296.0


def n2(x, z):
    xi, zi = np.floor(x), np.floor(z)
    fx, fz = x - xi, z - zi
    ux, uz = fx * fx * (3 - 2 * fx), fz * fz * (3 - 2 * fz)
    a, b, c, d = h3(xi, 0, zi), h3(xi + 1, 0, zi), h3(xi, 0, zi + 1), h3(xi + 1, 0, zi + 1)
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz


def sm(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def pond_f(x, z):
    return ((x - POND[0]) / POND[2]) ** 2 + ((z - POND[1]) / POND[3]) ** 2


def terr_h(x, z, hole=True):
    x, z = np.asarray(x, dtype=float), np.asarray(z, dtype=float)

    def g(cx, cz, a, q):
        return a * np.exp(-((x - cx) ** 2 + (z - cz) ** 2) / q)

    h = (g(-12, -7, 3.4, 46) + g(13, -10, 2.6, 38) + g(-10, 12, 1.7, 30) + g(17, 9, 2.0, 26) + g(1, -15, 1.3, 60)
         + g(3.5, -6.5, 1.5, 7) + 0.45 * (n2(x * 0.16 + 3, z * 0.16 + 7) - 0.5) + 0.12 * (n2(x * 0.6, z * 0.6) - 0.5))
    p = pond_f(x, z)
    h = np.where(p < 1.5, h + (-0.75 - h) * sm(1.5, 0.55, p), h)
    if hole:
        h = h - SHELF[2] * sm(SHELF[0], SHELF[1], p)
        h = np.where(p < HOLE[0], h - HOLE[2] * sm(HOLE[0], HOLE[1], p), h)
    return h


def terr_n(x, z):
    e = 0.06
    nx = -(terr_h(x + e, z) - terr_h(x - e, z)) / (2 * e)
    nz = -(terr_h(x, z + e) - terr_h(x, z - e)) / (2 * e)
    n = np.stack([nx, np.ones_like(nx), nz], 1)
    return n / np.linalg.norm(n, axis=1, keepdims=True)


def mixc(a, b, t):
    return a + (b - a) * np.asarray(t)[:, None]


def bed_col(x, z, d):
    """Lakebed: pale sand, a little darker with depth, with patches of low weed."""
    c = mixc(SAND1[None], SAND2[None], n2(x * 2, z * 2))
    c = mixc(c, BED_DARK[None], sm(0.25, 1.4, d) * 0.4)
    w = n2(x * 0.9 + 40, z * 0.9 + 17)
    c = np.where(((w < 0.3) & (d > 0.25))[:, None], mixc(c, BED_WEED[None], sm(0.3, 0.2, w) * 0.45), c)
    ripple = 0.5 + 0.5 * np.sin(x * 9 + 2.2 * np.sin(z * 3.1)) * np.sin(z * 7 + 1.7 * np.sin(x * 2.3))
    return c * (0.93 + 0.07 * ripple)[:, None]


def water_tint(c, wd):
    """What colour c looks like through wd of water. Mirrors water_tint() in the shader, without the moving parts."""
    wd = np.asarray(wd, dtype=float)[:, None]
    c = c * np.concatenate([np.exp(-0.5 * wd), np.ones_like(wd), np.ones_like(wd)], 1)      # red fades first
    c = c * (1 - 0.45 * sm(0.9, 3.0, wd))
    body = WSHALLOW[None] + (WDEEP - WSHALLOW)[None] * sm(0.35, 2.6, wd)
    veil = WVEIL[0] + WVEIL[1] * (1 - np.exp(-wd * WVEIL[2]))
    return c + (body - c) * veil


class Splats:
    """A growing list of splats in the export's own format."""

    def __init__(self):
        self.pos, self.col, self.misc, self.nrm = [], [], [], []

    def add(self, pos, col, nrm, diam, sway=0.0, group=0, shape=0, glow=0):
        n = len(pos)
        pos = np.asarray(pos, dtype=np.float32)
        col4 = np.zeros((n, 4), np.uint8)
        col4[:, :3] = np.clip(np.round(np.asarray(col) * 255), 0, 255)
        col4[:, 3] = glow
        misc = np.zeros((n, 4), np.uint8)
        misc[:, 0] = np.clip(np.round(np.broadcast_to(sway, (n,)) * 255), 0, 255)
        misc[:, 1] = group
        misc[:, 2] = np.clip(np.round(np.broadcast_to(diam, (n,)) / 0.004), 1, 255)
        misc[:, 3] = rng.integers(0, 256, n)
        nr = np.zeros((n, 4), np.int8)
        if nrm is not None:
            v = np.asarray(nrm, dtype=float)
            v = v / np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-6)
            nr[:, :3] = np.round(v * 127)
        nr[:, 3] = shape
        self.pos.append(pos); self.col.append(col4); self.misc.append(misc); self.nrm.append(nr)

    def arrays(self):
        return np.vstack(self.pos), np.vstack(self.col), np.vstack(self.misc), np.vstack(self.nrm)


def sphere_points(n):
    v = rng.normal(size=(n, 3))
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def lit(n, base, lo=0.62):
    """Simple baked light from above and a little to one side, like the rest of the world."""
    k = np.clip(n @ np.array([0.35, 0.85, 0.4]), -1, 1)
    return base * (lo + (1 - lo) * (0.5 + 0.5 * k))[:, None]


def add_rock(out, x, z, r, tall):
    base_y = float(terr_h(x, z))
    rad = np.array([r * rng.uniform(0.85, 1.25), r * tall, r * rng.uniform(0.85, 1.25)])
    v = sphere_points(int(1100 * r * r / 0.16))
    v = v[v[:, 1] > -0.25]
    lump = 1 + 0.16 * np.sin(v[:, 0] * 5 + x) * np.sin(v[:, 2] * 4 + z) + 0.08 * np.sin(v[:, 1] * 9)
    p = v * rad[None] * lump[:, None] + np.array([x, base_y + rad[1] * 0.18, z])
    nrm = v / rad[None]
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True)
    c = ROCKS[rng.integers(len(ROCKS))]
    col = lit(nrm, np.repeat(c[None], len(p), 0), 0.5) * (0.9 + 0.2 * rng.random(len(p)))[:, None]
    out.add(p, col, nrm, 0.075)


def tube_points(a, b, ra, rb, n):
    """Points on the surface of a tapering tube from a to b, with outward normals."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    axis = b - a
    ln = np.linalg.norm(axis)
    axis = axis / ln
    side = np.cross(axis, [0.3, 0.1, 0.9]); side /= np.linalg.norm(side)
    up = np.cross(axis, side)
    t, ang = rng.random(n), rng.uniform(0, 2 * np.pi, n)
    ring = np.cos(ang)[:, None] * side[None] + np.sin(ang)[:, None] * up[None]
    rad = ra + (rb - ra) * t
    return a[None] + axis[None] * (t * ln)[:, None] + ring * rad[:, None], ring, t


def add_branch_coral(out, x, z, h, colour):
    """Staghorn coral: thick branches fanning up from one base, paler toward the tips."""
    base = np.array([x, float(terr_h(x, z)) - 0.02, z])
    tip_col = colour * 0.35 + 0.65
    for _ in range(int(rng.integers(6, 10))):
        a = rng.uniform(0, 2 * np.pi)
        out_k = rng.uniform(0.25, 0.75)
        d = np.array([np.cos(a) * out_k, 1.0, np.sin(a) * out_k]); d /= np.linalg.norm(d)
        ln = h * rng.uniform(0.6, 1.0)
        mid = base + d * ln * 0.55
        segs = [(base, mid, 0.07, 0.055, 0.0, 0.55)]
        bend = d + np.array([np.cos(a + 1.0) * 0.35, 0.1, np.sin(a + 1.0) * 0.35]); bend /= np.linalg.norm(bend)
        segs.append((mid, mid + bend * ln * 0.45, 0.055, 0.035, 0.55, 1.0))
        if rng.random() < 0.7:                                     # a fork
            fk = d + np.array([np.cos(a - 1.3) * 0.5, 0.0, np.sin(a - 1.3) * 0.5]); fk /= np.linalg.norm(fk)
            segs.append((mid, mid + fk * ln * 0.38, 0.05, 0.032, 0.55, 0.95))
        for (p0, p1, r0, r1, t0, t1) in segs:
            n = int(260 * np.linalg.norm(p1 - p0) / 0.25)
            p, nrm, t = tube_points(p0, p1, r0, r1, n)
            tt = t0 + (t1 - t0) * t
            col = lit(nrm, mixc(colour[None], tip_col[None], tt ** 2.2), 0.6)
            out.add(p, col, nrm, 0.05)
            cap = sphere_points(40) * r1 + p1                      # round off the tip
            out.add(cap, np.repeat(tip_col[None], 40, 0), cap - p1, 0.05)


def add_brain_coral(out, x, z, r, pal):
    """Brain coral: a low dome with a winding groove pattern."""
    dark, light = pal
    base_y = float(terr_h(x, z))
    v = sphere_points(int(1500 * r * r / 0.12))
    v = v[v[:, 1] > -0.1]
    p = v * np.array([r, r * 0.72, r]) + np.array([x, base_y + r * 0.05, z])
    groove = np.sin(13 * (v[:, 0] + 0.35 * np.sin(7 * v[:, 2] + 2 * v[:, 1])) + 3 * v[:, 1])
    col = lit(v, mixc(dark[None], light[None], sm(-0.25, 0.35, groove)), 0.62)
    out.add(p, col, v, 0.05)


def add_tubes(out, x, z, h, colour):
    """Tube sponges: a few upright tubes with dark mouths."""
    for _ in range(int(rng.integers(3, 6))):
        a, q = rng.uniform(0, 2 * np.pi), rng.uniform(0.0, 0.16)
        bx, bz = x + np.cos(a) * q, z + np.sin(a) * q
        base = np.array([bx, float(terr_h(bx, bz)) - 0.02, bz])
        hh, rr = h * rng.uniform(0.55, 1.0), rng.uniform(0.07, 0.1)
        top = base + np.array([np.cos(a) * 0.08, hh, np.sin(a) * 0.08])
        p, nrm, t = tube_points(base, top, rr * 0.8, rr, int(520 * hh / 0.4))
        col = lit(nrm, np.repeat(colour[None], len(p), 0), 0.58) * (0.8 + 0.3 * t)[:, None]
        out.add(p, col, nrm, 0.05)
        ang, q2 = rng.uniform(0, 2 * np.pi, 70), np.sqrt(rng.random(70)) * rr
        mouth = top[None] + np.stack([np.cos(ang) * q2, np.where(q2 > rr * 0.72, 0.0, -0.03), np.sin(ang) * q2], 1)
        mcol = np.where((q2 > rr * 0.72)[:, None], (colour * 0.5 + 0.5)[None], (colour * 0.18)[None])
        out.add(mouth, mcol, np.repeat([[0.0, 1.0, 0.0]], 70, 0), 0.05)


def add_starfish(out, x, z, r, colour):
    yaw = rng.uniform(0, 2 * np.pi)
    ang, q = rng.uniform(0, 2 * np.pi, 900), np.sqrt(rng.random(900))
    edge = 0.36 + 0.64 * np.abs(np.cos(2.5 * (ang - yaw))) ** 2.2      # five arms
    keep = q < edge
    ang, q, edge = ang[keep], q[keep], edge[keep]
    px, pz = x + np.cos(ang) * q * r, z + np.sin(ang) * q * r
    py = terr_h(px, pz) + 0.035 + 0.05 * (1 - q / edge) * (1 - q)
    spots = rng.random(len(px)) < 0.12
    col = np.where(spots[:, None], (colour * 0.4 + 0.6)[None], colour[None]) * (0.82 + 0.18 * (1 - q))[:, None]
    out.add(np.stack([px, py, pz], 1), col, np.repeat([[0.0, 1.0, 0.0]], len(px), 0), 0.055)


def add_plants(out, x, z, r, blades, height, pal):
    """A clump of sea grass or kelp: thin blades that sway with the water."""
    dark, light = pal
    for _ in range(blades):
        a, q = rng.uniform(0, 2 * np.pi), np.sqrt(rng.random()) * r
        bx, bz = x + np.cos(a) * q, z + np.sin(a) * q
        base_y = float(terr_h(bx, bz))
        h = height * rng.uniform(0.55, 1.0)
        h = min(h, max(0.08, (WATER - base_y) - 0.1))           # stay under the surface
        seg = max(4, int(h / 0.045))
        t = (np.arange(seg) + 0.5) / seg
        lean_a, lean = rng.uniform(0, 2 * np.pi), rng.uniform(0.02, 0.12)
        p = np.stack([bx + np.cos(lean_a) * lean * t ** 2, base_y + t * h, bz + np.sin(lean_a) * lean * t ** 2], 1)
        col = mixc(dark[None], light[None], t ** 1.3) * rng.uniform(0.88, 1.08)
        out.add(p, col, None, 0.085 - 0.03 * t, sway=0.55 * t ** 1.5, shape=1)


def fit_palette(samples, k):
    """k-means the way the browser build does it: farthest-point start, then passes with a luminance-weighted distance."""
    wgt = np.array([0.3, 0.59, 0.11])
    cen = np.zeros((k, 3))
    cen[0] = samples.mean(0)
    dist = np.full(len(samples), 9.0)
    for c in range(1, k):
        dist = np.minimum(dist, (((samples - cen[c - 1]) ** 2) * wgt).sum(1))
        cen[c] = samples[dist.argmax()]
    for _ in range(12):
        d2 = (((samples[:, None, :] - cen[None]) ** 2) * wgt).sum(2)
        lab = d2.argmin(1)
        for c in range(k):
            if (lab == c).any():
                cen[c] = samples[lab == c].mean(0)
    return cen[np.argsort(cen @ wgt)]


def skinned_colours(name):
    meta = json.loads((DATA / f"{name}.json").read_text())
    n = int(meta["n"])
    b = np.frombuffer((DATA / f"{name}.bin").read_bytes(), dtype=np.uint8)
    return b[n * 6:n * 10].reshape(n, 4)[:, :3] / 255.0


def place(count, p_lo, p_hi, min_gap, taken):
    """Pick spots on the lakebed between two pond radii, not too close to anything already placed."""
    out = []
    tries = 0
    while len(out) < count and tries < count * 400:
        tries += 1
        a = rng.uniform(0, 2 * np.pi)
        q = np.sqrt(rng.uniform(p_lo, p_hi))
        x, z = POND[0] + np.cos(a) * POND[2] * q, POND[1] + np.sin(a) * POND[3] * q
        if all((x - tx) ** 2 + (z - tz) ** 2 > (min_gap + tg) ** 2 for tx, tz, tg in taken):
            out.append((x, z))
            taken.append((x, z, min_gap))
    return out


def main():
    world_path = DATA / "world.json"
    world = json.loads(world_path.read_text())
    if "water_v" in world:
        sys.exit(f"this data has already been rebuilt (water_v {world['water_v']}). Start from the original export.")

    pos = np.fromfile(DATA / "world_pos.bin", dtype="<f4").reshape(-1, 3)
    col = np.fromfile(DATA / "world_col.bin", dtype=np.uint8).reshape(-1, 4)
    misc = np.fromfile(DATA / "world_misc.bin", dtype=np.uint8).reshape(-1, 4)
    nrm = np.fromfile(DATA / "world_nrm.bin", dtype=np.int8).reshape(-1, 4)

    # check the terrain port against the exported height grid before trusting it
    hg = world["hgrid"]
    gx, gz, d = int(hg["gx"]), int(hg["gz"]), float(hg["d"])
    X, Z = np.meshgrid(hg["x0"] + np.arange(gx) * d, hg["z0"] + np.arange(gz) * d)
    err = np.abs(terr_h(X.ravel(), Z.ravel(), False) - np.array(hg["h"])).max()
    if err > 2e-3:
        sys.exit(f"terrain port does not match the exported height grid (max error {err:.4f})")

    water = misc[:, 1] == 5
    in_lake = water & (pond_f(pos[:, 0], pos[:, 2]) < ZONE)
    wx, wz = pos[in_lake, 0].astype(float), pos[in_lake, 2].astype(float)
    d_old = np.maximum(WATER - terr_h(wx, wz, False), 0.0)
    d_new = np.maximum(WATER - terr_h(wx, wz, True), 0.0)

    # the old colour was mix(WATER1, WATER2, depth) x tree shadow: divide the mix back out to recover the shadow
    flat = mixc(WATER1[None], WATER2[None], np.clip(d_old / 0.38, 0, 1))
    shade = np.clip((col[in_lake, :3] / 255.0 / flat).mean(1), 0.6, 1.0)

    new = Splats()

    # 1. decide where everything on the bed goes first, so the bed can be shaded under it
    taken = []
    plan = []
    for (x, z) in place(6, 0.84, 1.1, 0.75, taken): plan.append(("rock", x, z, rng.uniform(0.5, 0.72), rng.uniform(0.95, 1.3)))   # big rocks near the shore: these break the surface
    for (x, z) in place(12, 0.4, 1.0, 0.5, taken): plan.append(("rock", x, z, rng.uniform(0.28, 0.42), rng.uniform(0.6, 0.85)))
    for (x, z) in place(15, 0.46, 0.98, 0.55, taken): plan.append(("branch", x, z, rng.uniform(0.45, 0.62), 0))
    for (x, z) in place(10, 0.46, 1.0, 0.5, taken): plan.append(("brain", x, z, rng.uniform(0.3, 0.42), 0))
    for (x, z) in place(9, 0.46, 0.98, 0.42, taken): plan.append(("tubes", x, z, rng.uniform(0.42, 0.6), 0))
    for (x, z) in place(12, 0.5, 1.05, 0.4, taken): plan.append(("star", x, z, rng.uniform(0.2, 0.28), 0))
    for (x, z) in place(34, 0.4, 1.1, 0.32, taken): plan.append(("grass", x, z, rng.uniform(0.2, 0.36), 0))
    for (x, z) in place(10, 0.1, 0.4, 0.35, taken): plan.append(("kelp", x, z, rng.uniform(0.3, 0.5), 0))
    reach = {"rock": 1.0, "branch": 0.5, "brain": 1.0, "tubes": 0.45, "star": 0.0, "grass": 0.0, "kelp": 0.0}

    def ground_shadow(x, z):
        """Darken the bed under and beside each thing standing on it, so it reads as sitting on the bottom."""
        k = np.ones(len(x))
        for kind, px, pz, size, _ in plan:
            r = size * reach[kind]
            if r <= 0: continue
            dist = np.hypot(x - px - 0.12, z - pz - 0.1)            # offset a little, away from the light
            k *= 1 - 0.42 * (1 - sm(r * 0.7, r * 1.7, dist))
        return k

    # 2. the lakebed, where the water sheet used to be
    bn = terr_n(wx, wz)
    bed = bed_col(wx, wz, d_new) * shade[:, None] * (0.8 + 0.2 * bn[:, 1])[:, None] * ground_shadow(wx, wz)[:, None]
    new.add(np.stack([wx, WATER - d_new, wz], 1), bed, bn, 0.17)
    # the hole's walls are steep, so they need more splats than a flat sheet gives them
    n_extra = 26000
    a, q = rng.uniform(0, 2 * np.pi, n_extra), np.sqrt(rng.uniform(0.04, HOLE[0] + 0.06, n_extra))
    ex, ez = POND[0] + np.cos(a) * POND[2] * q, POND[1] + np.sin(a) * POND[3] * q
    ed = WATER - terr_h(ex, ez)
    en = terr_n(ex, ez)
    new.add(np.stack([ex, WATER - ed, ez], 1), bed_col(ex, ez, ed) * (0.8 + 0.2 * en[:, 1])[:, None] * ground_shadow(ex, ez)[:, None], en, 0.19)

    # 3. the surface layer: only ever drawn as foam or glints. Depth goes in the sway slot (square root keeps the shallows precise)
    keep = (d_new < 0.24) | (rng.random(len(wx)) < 0.09)
    surf_code = np.sqrt(np.minimum(d_new[keep], WDMAX) / WDMAX)
    new.add(np.stack([wx[keep], np.full(keep.sum(), WATER), wz[keep]], 1), np.ones((keep.sum(), 3)),
            np.repeat([[0.0, 1.0, 0.0]], keep.sum(), 0), 0.16, sway=np.maximum(surf_code, 1 / 255), group=5)

    # 4. the things themselves
    for kind, x, z, size, extra in plan:
        if kind == "rock": add_rock(new, x, z, size, extra)
        elif kind == "branch": add_branch_coral(new, x, z, size, BRANCH[rng.integers(len(BRANCH))])
        elif kind == "brain": add_brain_coral(new, x, z, size, BRAIN[rng.integers(len(BRAIN))])
        elif kind == "tubes": add_tubes(new, x, z, size, TUBES[rng.integers(len(TUBES))])
        elif kind == "star": add_starfish(new, x, z, size, STARS[rng.integers(len(STARS))])
        elif kind == "grass": add_plants(new, x, z, size, int(rng.integers(14, 26)), rng.uniform(0.3, 0.55), PLANTS[rng.integers(len(PLANTS))])
        elif kind == "kelp": add_plants(new, x, z, size, int(rng.integers(18, 30)), rng.uniform(0.9, 1.6), PLANTS[0])

    npos, ncol, nmisc, nnrm = new.arrays()

    # 5. rebuild every map cell: old splats minus the lake's water sheet, plus the new ones, reshuffled so half detail stays an even sample
    cell_of = lambda p: (np.floor((p[:, 0] + 24) / CELL).astype(int), np.floor((p[:, 2] + 20) / CELL).astype(int))
    ncx, ncz = cell_of(npos)
    P, C, M, N, chunks = [], [], [], [], []
    start = 0
    for ch in world["chunks"]:
        s, c = int(ch["s"]), int(ch["c"])
        sl = slice(s, s + c)
        old_keep = ~in_lake[sl]
        cx, cz = cell_of(pos[sl])
        key = (np.bincount(cx - cx.min()).argmax() + cx.min(), np.bincount(cz - cz.min()).argmax() + cz.min())
        mine = (ncx == key[0]) & (ncz == key[1])
        p = np.vstack([pos[sl][old_keep], npos[mine]]); cc = np.vstack([col[sl][old_keep], ncol[mine]])
        mm = np.vstack([misc[sl][old_keep], nmisc[mine]]); nn = np.vstack([nrm[sl][old_keep], nnrm[mine]])
        order = rng.permutation(len(p))
        p, cc, mm, nn = p[order], cc[order], mm[order], nn[order]
        ncx[mine] = -999                                         # used
        chunks.append({"s": start, "c": len(p), "mn": [float(v) for v in p.min(0) - PAD], "mx": [float(v) for v in p.max(0) + PAD]})
        start += len(p)
        P.append(p); C.append(cc); M.append(mm); N.append(nn)
    if (ncx != -999).any():
        sys.exit(f"{int((ncx != -999).sum())} new splats fell outside every map cell")
    pos, col, misc, nrm = np.vstack(P), np.vstack(C), np.vstack(M), np.vstack(N)

    # 6. palette: 24 colours fitted to the land and the characters, plus the lake's own eight. 32 in all (the pixel pass's limit).
    lake = (pond_f(pos[:, 0], pos[:, 2]) < ZONE) & (pos[:, 1] < WATER)
    land_c = col[~lake & (misc[:, 1] == 0), :3] / 255.0
    parts = [land_c[rng.choice(len(land_c), 12000, replace=False)]]
    for name, cnt in (("hero", 2600), ("calf", 1400)):
        c = skinned_colours(name)
        parts.append(c[rng.choice(len(c), cnt, replace=False)])
    parts.append(np.repeat(np.array([[0.97, 0.99, 1.0]]), 80, axis=0))
    pal_path = DATA / "palette.json"
    old_pal = {"cols": LAND_COLOURS + len(WATER_PAL)}
    pal = np.vstack([fit_palette(np.vstack(parts), LAND_COLOURS), np.array(WATER_PAL)])

    hg["h"] = [round(float(v), 4) for v in terr_h(X.ravel(), Z.ravel())]
    world.update({"n": int(len(pos)), "chunks": chunks, "water_v": 3, "pond": list(POND), "pond_zone": ZONE})
    pos.astype("<f4").tofile(DATA / "world_pos.bin")
    col.tofile(DATA / "world_col.bin")
    misc.tofile(DATA / "world_misc.bin")
    nrm.tofile(DATA / "world_nrm.bin")
    world_path.write_text(json.dumps(world, separators=(",", ":")))
    pal_path.write_text(json.dumps({"cols": int(old_pal["cols"]), "pal": [round(float(v), 4) for v in pal.ravel()]}))
    print(f"lake rebuilt: {int(in_lake.sum())} sheet splats replaced by {len(npos)} (bed, surface, rocks, coral, plants). World is now {len(pos)} splats.")
    print(f"deepest {d_new.max():.2f}, terrain check {err:.5f}")
    print("palette:", (pal * 255).round().astype(int).tolist())


if __name__ == "__main__":
    main()
