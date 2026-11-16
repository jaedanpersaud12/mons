#!/usr/bin/env python3
"""Rebake the lake for the new water.

The exported world stores every water splat as a flat, pre-mixed blue. The new
water shader needs two things per splat instead: the colour of the lakebed
under it and how deep the water is there. This script rewrites those splats,
digs a deep hole in the middle of the lake, and refits the 28-colour palette
so it has room for the water.

Run once from the game folder:   python3 tools/bake_water.py
Needs numpy. It refuses to run twice (world.json gets "water_v": 2).
"""
import json
import sys
from pathlib import Path

import numpy as np

DATA = Path(__file__).resolve().parent.parent / "data"
WATER = -0.2
WDMAX = 3.0                      # deepest depth a splat can store (shader uses the same number)
POND = (7.0, 6.0, 7.5, 5.0)      # lake centre x, z and radii
HOLE = (0.42, 0.10, 2.1)         # the deep hole: starts at this pond radius, full depth by this one, extra depth
WEXT = np.array([2.6, 0.75, 0.55])  # absorption per channel: red goes first (the shader uses the same numbers)
WSC1 = np.array([0.10, 0.66, 0.70])
WSC2 = np.array([0.02, 0.14, 0.42])


def hexc(h):
    return np.array([(h >> 16) & 255, (h >> 8) & 255, h & 255]) / 255.0


SAND1, SAND2 = hexc(0xE9D2A2), hexc(0xD9BB89)
WATER1, WATER2 = hexc(0x86D6D2), hexc(0x2F86AD)
BED_ROCK, BED_WEED, BED_DARK = hexc(0x7C8A8F), hexc(0x2F7A5A), hexc(0x9A8A6A)
CORAL = np.stack([hexc(0xE8799A), hexc(0xB07AD6), hexc(0xF2A45A), hexc(0x6FD0C0)])


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


def terr_h(x, z, hole):
    def g(cx, cz, a, q):
        return a * np.exp(-((x - cx) ** 2 + (z - cz) ** 2) / q)

    h = (g(-12, -7, 3.4, 46) + g(13, -10, 2.6, 38) + g(-10, 12, 1.7, 30) + g(17, 9, 2.0, 26) + g(1, -15, 1.3, 60)
         + g(3.5, -6.5, 1.5, 7) + 0.45 * (n2(x * 0.16 + 3, z * 0.16 + 7) - 0.5) + 0.12 * (n2(x * 0.6, z * 0.6) - 0.5))
    p = pond_f(x, z)
    h = np.where(p < 1.5, h + (-0.75 - h) * sm(1.5, 0.55, p), h)
    if hole:
        h = np.where(p < HOLE[0], h - HOLE[2] * sm(HOLE[0], HOLE[1], p), h)
    return h


def mixc(a, b, t):
    return a + (b - a) * np.asarray(t)[:, None]


def bed_col(x, z, d):
    """Lakebed colour: pale sand at the shore, then rock, weed and a few corals."""
    c = mixc(SAND1[None], SAND2[None], n2(x * 2, z * 2))
    c = mixc(c, BED_DARK[None], sm(0.25, 1.2, d) * 0.6)
    r = n2(x * 0.7 + 11, z * 0.7 + 3)
    w = n2(x * 1.1 + 40, z * 1.1 + 17)
    inner = d > 0.12
    c = np.where((inner & (r > 0.62))[:, None], mixc(c, BED_ROCK[None], sm(0.62, 0.7, r)), c)
    c = np.where((inner & (w < 0.3) & (d > 0.2))[:, None], mixc(c, BED_WEED[None], sm(0.3, 0.2, w) * 0.85), c)
    hx, hz = np.floor(x * 3.2), np.floor(z * 3.2)
    hv = h3(hx, 7, hz)
    fx, fz = x * 3.2 - hx - 0.5, z * 3.2 - hz - 0.5
    coral = inner & (d < 1.1) & (r > 0.66) & (hv < 0.3) & (fx * fx + fz * fz < 0.16)
    c = np.where(coral[:, None], CORAL[np.floor(hv * 13.3).astype(int) & 3], c)
    return c


def water_col(bed, d):
    d = np.asarray(d, dtype=float)[:, None]
    fog = 1 - np.exp(-d * 0.9)
    return bed * np.exp(-WEXT[None] * d) + (WSC1[None] + (WSC2 - WSC1)[None] * sm(0.3, 1.8, d)) * fog


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


def main():
    world_path = DATA / "world.json"
    world = json.loads(world_path.read_text())
    if world.get("water_v") == 2:
        sys.exit("already rebaked (world.json has water_v 2)")

    pos = np.fromfile(DATA / "world_pos.bin", dtype="<f4").reshape(-1, 3)
    col = np.fromfile(DATA / "world_col.bin", dtype=np.uint8).reshape(-1, 4)
    misc = np.fromfile(DATA / "world_misc.bin", dtype=np.uint8).reshape(-1, 4)

    # check the terrain port against the exported height grid before trusting it
    hg = world["hgrid"]
    gx, gz, d = int(hg["gx"]), int(hg["gz"]), float(hg["d"])
    X, Z = np.meshgrid(hg["x0"] + np.arange(gx) * d, hg["z0"] + np.arange(gz) * d)
    err = np.abs(terr_h(X.ravel(), Z.ravel(), False) - np.array(hg["h"])).max()
    if err > 2e-3:
        sys.exit(f"terrain port does not match the exported height grid (max error {err:.4f})")

    w = misc[:, 1] == 5
    x, z = pos[w, 0].astype(float), pos[w, 2].astype(float)
    d_old = np.maximum(WATER - terr_h(x, z, False), 0.0)
    d_new = np.maximum(WATER - terr_h(x, z, True), 0.0)

    # the old colour was mix(WATER1, WATER2, depth) x tree shadow: divide the mix back out to recover the shadow
    old = col[w, :3] / 255.0
    flat = mixc(WATER1[None], WATER2[None], np.clip(d_old / 0.38, 0, 1))
    shade = np.clip((old / flat).mean(1), 0.6, 1.0)

    bed = bed_col(x, z, d_new) * shade[:, None]
    col[w, :3] = np.clip(np.round(bed * 255), 0, 255).astype(np.uint8)
    misc[w, 0] = np.clip(np.round(np.sqrt(np.minimum(d_new, WDMAX) / WDMAX) * 255), 1, 255).astype(np.uint8)

    # palette: the same world and character colours as before, plus what the water will look like at every depth
    rng = np.random.default_rng(20261116)
    ground = col[~w, :3] / 255.0
    parts = [ground[rng.choice(len(ground), 12000, replace=False)]]
    for name, cnt in (("hero", 2600), ("calf", 1400)):
        c = skinned_colours(name)
        parts.append(c[rng.choice(len(c), cnt, replace=False)])
    depths = WDMAX * (np.arange(28) / 27.0) ** 2.2
    parts.append(np.repeat(water_col(np.repeat(SAND1[None], len(depths), 0), depths), 44, axis=0))
    parts.append(np.repeat(np.array([[0.97, 0.99, 1.0]]), 60, axis=0))
    pal_path = DATA / "palette.json"
    old_pal = json.loads(pal_path.read_text())
    pal = fit_palette(np.vstack(parts), int(old_pal["cols"]))

    hg["h"] = [round(float(v), 4) for v in terr_h(X.ravel(), Z.ravel(), True)]
    world["water_v"] = 2
    world["water_dmax"] = WDMAX
    col.tofile(DATA / "world_col.bin")
    misc.tofile(DATA / "world_misc.bin")
    world_path.write_text(json.dumps(world, separators=(",", ":")))
    pal_path.write_text(json.dumps({"cols": int(old_pal["cols"]), "pal": [round(float(v), 4) for v in pal.ravel()]}))
    print(f"water splats {int(w.sum())}, deepest {d_new.max():.2f}, terrain check {err:.5f}, palette {len(pal)} colours")
    print("palette:", (pal * 255).round().astype(int).tolist())


if __name__ == "__main__":
    main()
