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
CELL = 4.0                       # map cell size
PAD = 0.6                        # padding on each cell's bounds, as in the export
# the water's look: the shader uses the same numbers
WEXT = np.array([1.9, 0.62, 0.30])    # absorption per unit depth: red goes first
WFOG = 0.75
WSC1 = np.array([0.07, 0.60, 0.80])  # light scattered back in the shallows
WSC2 = np.array([0.02, 0.14, 0.42])  # and in deep water

rng = np.random.default_rng(20261116)


def hexc(h):
    return np.array([(h >> 16) & 255, (h >> 8) & 255, h & 255]) / 255.0


SAND1, SAND2 = hexc(0xE9D2A2), hexc(0xD9BB89)
WATER1, WATER2 = hexc(0x86D6D2), hexc(0x2F86AD)
BED_WEED, BED_DARK = hexc(0x4F8A5A), hexc(0xA89A76)
ROCKS = [hexc(0x8C8F96), hexc(0x767A86), hexc(0xA39E94)]
CORALS = [hexc(0xF07A9A), hexc(0xB884E0), hexc(0xF7A650), hexc(0xF2D060), hexc(0xE86A5A), hexc(0xF4B6C8)]
PLANTS = [(hexc(0x2E7D4A), hexc(0x8FD46A)), (hexc(0x2A6E5E), hexc(0x6FD0A0)), (hexc(0x5C7A2C), hexc(0xC2D45A))]


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
    c = mixc(c, BED_DARK[None], sm(0.25, 1.4, d) * 0.5)
    w = n2(x * 0.9 + 40, z * 0.9 + 17)
    c = np.where(((w < 0.34) & (d > 0.18))[:, None], mixc(c, BED_WEED[None], sm(0.34, 0.24, w) * 0.7), c)
    ripple = 0.5 + 0.5 * np.sin(x * 9 + 2.2 * np.sin(z * 3.1)) * np.sin(z * 7 + 1.7 * np.sin(x * 2.3))
    return c * (0.93 + 0.07 * ripple)[:, None]


def water_tint(c, wd):
    """What colour c looks like through wd of water. Mirrors water_tint() in the shader, without the moving parts."""
    wd = np.asarray(wd, dtype=float)[:, None]
    fog = 1 - np.exp(-wd * WFOG)
    thru = c * np.exp(-WEXT[None] * wd) * (1 - 0.7 * sm(1.2, 3.0, wd))
    return thru + (WSC1[None] + (WSC2 - WSC1)[None] * sm(0.3, 2.2, wd)) * fog


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
    n_pts = int(900 * r * r / 0.16)
    v = sphere_points(n_pts)
    v = v[v[:, 1] > -0.25]
    lump = 1 + 0.16 * np.sin(v[:, 0] * 5 + x) * np.sin(v[:, 2] * 4 + z) + 0.08 * np.sin(v[:, 1] * 9)
    p = v * rad[None] * lump[:, None] + np.array([x, base_y + rad[1] * 0.18, z])
    nrm = v / rad[None]
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True)
    c = ROCKS[rng.integers(len(ROCKS))]
    col = lit(nrm, np.repeat(c[None], len(p), 0)) * (0.92 + 0.16 * rng.random(len(p)))[:, None]
    # a little weed growing on the lower half
    low = (v[:, 1] < 0.15) & (rng.random(len(p)) < 0.35)
    col[low] = col[low] * 0.5 + BED_WEED * 0.5
    out.add(p, col, nrm, 0.075)


def add_coral(out, x, z, r, colour):
    """A cauliflower coral: a dome of small balls on a short stalk."""
    base_y = float(terr_h(x, z))
    balls = int(rng.integers(7, 13))
    for _ in range(balls):
        a, q = rng.uniform(0, 2 * np.pi), np.sqrt(rng.random()) * r * 0.8
        cx, cz = x + np.cos(a) * q, z + np.sin(a) * q
        cy = base_y + r * (0.55 + 0.5 * (1 - (q / r) ** 2)) * rng.uniform(0.8, 1.1)
        br = r * rng.uniform(0.3, 0.46)
        v = sphere_points(int(150 * (br / 0.1) ** 2))
        p = v * br + np.array([cx, cy, cz])
        tip = 0.5 + 0.5 * v[:, 1]
        col = lit(v, np.repeat(colour[None], len(p), 0), 0.55)
        col = col * (0.8 + 0.2 * tip)[:, None] + (0.12 * tip ** 3)[:, None]     # pale tips
        out.add(p, col, v, 0.05)
    # the stalk
    t = rng.random(int(140 * r / 0.25))
    a = rng.uniform(0, 2 * np.pi, len(t))
    sr = r * 0.28
    p = np.stack([x + np.cos(a) * sr, base_y - 0.02 + t * r * 0.6, z + np.sin(a) * sr], 1)
    nrm = np.stack([np.cos(a), np.full(len(t), 0.2), np.sin(a)], 1)
    out.add(p, lit(nrm, np.repeat((colour * 0.6)[None], len(p), 0), 0.5), nrm, 0.055)


def add_fan(out, x, z, h, colour):
    """A fan coral: a flat, veined fan standing up from the bed."""
    base_y = float(terr_h(x, z))
    yaw = rng.uniform(0, np.pi)
    n_pts = int(700 * h / 0.4)
    u = rng.uniform(-1, 1, n_pts)
    v = rng.random(n_pts) ** 0.7
    keep = np.abs(u) < 0.25 + 0.85 * np.sin(v * np.pi * 0.62)
    u, v = u[keep], v[keep]
    vein = 0.5 + 0.5 * np.sin(u * 22 / (0.4 + v)) * np.sin(v * 17)
    keep = vein > 0.25
    u, v, vein = u[keep], v[keep], vein[keep]
    w = u * h * 0.62
    p = np.stack([x + np.cos(yaw) * w, base_y + v * h, z + np.sin(yaw) * w], 1)
    col = np.repeat(colour[None], len(p), 0) * (0.7 + 0.3 * vein)[:, None] * (0.75 + 0.25 * v)[:, None]
    out.add(p, col, None, 0.05, sway=0.12 * v)


def add_plants(out, x, z, r, blades, height, pal):
    """A clump of sea grass: thin blades that sway with the water."""
    dark, light = pal
    for _ in range(blades):
        a, q = rng.uniform(0, 2 * np.pi), np.sqrt(rng.random()) * r
        bx, bz = x + np.cos(a) * q, z + np.sin(a) * q
        base_y = float(terr_h(bx, bz))
        h = height * rng.uniform(0.55, 1.0)
        h = min(h, max(0.08, (WATER - base_y) - 0.06))          # stay under the surface
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

    # 1. the lakebed, where the water sheet used to be
    bn = terr_n(wx, wz)
    bed = bed_col(wx, wz, d_new) * shade[:, None] * (0.8 + 0.2 * bn[:, 1])[:, None]
    new.add(np.stack([wx, WATER - d_new, wz], 1), bed, bn, 0.17)
    # the hole's walls are steep, so they need more splats than a flat sheet gives them
    n_extra = 26000
    a, q = rng.uniform(0, 2 * np.pi, n_extra), np.sqrt(rng.uniform(0.04, HOLE[0] + 0.06, n_extra))
    ex, ez = POND[0] + np.cos(a) * POND[2] * q, POND[1] + np.sin(a) * POND[3] * q
    ed = WATER - terr_h(ex, ez)
    en = terr_n(ex, ez)
    new.add(np.stack([ex, WATER - ed, ez], 1), bed_col(ex, ez, ed) * (0.8 + 0.2 * en[:, 1])[:, None], en, 0.19)

    # 2. the surface layer: only ever drawn as foam or glints. Depth goes in the sway slot (square root keeps the shallows precise)
    keep = (d_new < 0.24) | (rng.random(len(wx)) < 0.09)
    surf_code = np.sqrt(np.minimum(d_new[keep], WDMAX) / WDMAX)
    new.add(np.stack([wx[keep], np.full(keep.sum(), WATER), wz[keep]], 1), np.ones((keep.sum(), 3)),
            np.repeat([[0.0, 1.0, 0.0]], keep.sum(), 0), 0.16, sway=np.maximum(surf_code, 1 / 255), group=5)

    # 3. things on the bed
    taken = []
    for (x, z) in place(7, 0.80, 1.12, 0.55, taken):           # big rocks near the shore, some breaking the surface
        add_rock(new, x, z, rng.uniform(0.42, 0.62), rng.uniform(0.75, 1.15))
    for (x, z) in place(22, 0.38, 1.0, 0.3, taken):
        add_rock(new, x, z, rng.uniform(0.18, 0.34), rng.uniform(0.6, 0.9))
    for (x, z) in place(46, 0.42, 1.0, 0.2, taken):
        add_coral(new, x, z, rng.uniform(0.14, 0.26), CORALS[rng.integers(len(CORALS))])
    for (x, z) in place(18, 0.42, 0.98, 0.18, taken):
        add_fan(new, x, z, rng.uniform(0.28, 0.44), CORALS[rng.integers(len(CORALS))])
    for (x, z) in place(60, 0.36, 1.1, 0.12, taken):
        add_plants(new, x, z, rng.uniform(0.18, 0.4), int(rng.integers(14, 30)), rng.uniform(0.25, 0.5), PLANTS[rng.integers(len(PLANTS))])
    for (x, z) in place(10, 0.1, 0.4, 0.3, taken):               # tall kelp on the walls of the hole
        add_plants(new, x, z, rng.uniform(0.3, 0.5), int(rng.integers(18, 30)), rng.uniform(0.9, 1.6), PLANTS[0])

    npos, ncol, nmisc, nnrm = new.arrays()

    # 4. rebuild every map cell: old splats minus the lake's water sheet, plus the new ones, reshuffled so half detail stays an even sample
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

    # 5. palette: the same world and character colours as before, plus what the lake looks like through the water
    lake = (pond_f(pos[:, 0], pos[:, 2]) < ZONE) & (pos[:, 1] < WATER) & (misc[:, 1] == 0)
    land = ~lake & (misc[:, 1] == 0)
    land_c, lake_c = col[land, :3] / 255.0, col[lake, :3] / 255.0
    lake_t = water_tint(lake_c, WATER - pos[lake, 1])
    parts = [land_c[rng.choice(len(land_c), 12000, replace=False)], lake_t[rng.choice(len(lake_t), 4200, replace=False)]]
    for name, cnt in (("hero", 2600), ("calf", 1400)):
        c = skinned_colours(name)
        parts.append(c[rng.choice(len(c), cnt, replace=False)])
    parts.append(np.repeat(np.array([[0.97, 0.99, 1.0]]), 80, axis=0))
    pal_path = DATA / "palette.json"
    old_pal = json.loads(pal_path.read_text())
    pal = fit_palette(np.vstack(parts), int(old_pal["cols"]))

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
