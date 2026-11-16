#!/usr/bin/env python3
"""Build Fernhollow harbour, the home town, as splat data the game can load.

The buildings, trees and street furniture are assets (game/assets/*.splat), lifted from the
Fernhollow Splat Town artifact by tools/export_assets.py and placed here by position, turn and scale.
The land itself is generated: terrain, the bay, paths, grass, the harbour wall, the market, the pier and boats.
Light is baked in two flat tones (lit side, shaded side) plus cast shadows on the ground,
so shapes stay clean once the pixel pass snaps them to the palette.

Run from the game folder:   python3 tools/bake_fernhollow.py
Writes data/town_*.bin, data/town.json and data/town_palette.json. Needs numpy.
"""
import json
from pathlib import Path

import numpy as np

import bake_water as bw
from bake_water import Splats, hexc, mixc, n2, sm, sphere_points, tube_points, fit_palette, skinned_colours

DATA = Path(__file__).resolve().parent.parent / "data"
rng = np.random.default_rng(1116)
bw.rng = rng
WATER = 0.0
CELL, PAD = 4.0, 0.6
X0, X1, Z0, Z1 = -36.0, 36.0, -30.0, 30.0
SUN = np.array([0.35, 0.85, 0.4]); SUN = SUN / np.linalg.norm(SUN)

GRASS = [hexc(0x86C94A), hexc(0x6DB640), hexc(0x9AD658)]
GRASS_BLADE = (hexc(0x4E9A38), hexc(0xA8DC5C))
TALL_BLADE = (hexc(0x6FA83C), hexc(0xD8D878))
SAND = [hexc(0xEBD6A6), hexc(0xDCC08E)]
PATH = [hexc(0xD8B886), hexc(0xC6A272)]
PLASTER = [hexc(0xF2E6C8), hexc(0xE4D4B0)]
TIMBER = hexc(0x7A4A2A)
ROOF_RED = [hexc(0xD9603A), hexc(0xBC4C2E)]
ROOF_TEAL = [hexc(0x6E9A6A), hexc(0x587E5A)]      # mossy green slate, so it never reads as water
ROOF_BLUE = [hexc(0x4C78C4), hexc(0x385CA0)]
ROOF_THATCH = [hexc(0xC8743C), hexc(0xA85C30)]
STONE = [hexc(0xB8B2A6), hexc(0x9C968C), hexc(0xCAC4B6)]
WOOD = [hexc(0x9C6C44), hexc(0x80563A)]
WOOD_DARK = hexc(0x5E3E28)
LEAF = [hexc(0x3E8E3A), hexc(0x62B444), hexc(0x8ACC50)]
TRUNK = hexc(0x6A4630)
CREAM, RED, YELLOW, TEAL = hexc(0xF7EBD0), hexc(0xE8604C), hexc(0xF2C94C), hexc(0x58B4A8)
WINDOW = hexc(0xFFD27A)
LANTERN = hexc(0xFFA840)
ROCKS = bw.ROCKS


def shore(x):
    return 7.0 + 2.5 * np.sin(x * 0.11 + 0.6) + 1.2 * np.sin(x * 0.31)


# flat, walkable man-made ground: (x0, x1, z0, z1, height)
QUAY = (9.0, 28.0, -1.0, None, 1.0)          # z1 follows the shore, 1.5 past it
PIER = (1.2, 2.8, None, None, 0.7)           # from the beach out over the water
PIER_LEN = 10.0


def quay_mask(x, z):
    return (x > QUAY[0]) & (x < QUAY[1]) & (z > shore(x) - 5.0) & (z < shore(x) + 1.5)


def pier_mask(x, z):
    zs = shore(2.0)
    return (x > PIER[0]) & (x < PIER[1]) & (z > zs - 2.5) & (z < zs + PIER_LEN)


PADS = []        # level ground under each building: (x, z, radius, height)


def natural_h(x, z):
    """The land, levelled off around each building so none of them hangs over a slope."""
    x, z = np.asarray(x, float), np.asarray(z, float)
    h = base_h(x, z)
    for (px, pz, r, ph) in PADS:
        h = h + (ph - h) * sm(r + 3.0, r, np.hypot(x - px, z - pz))
    return h


def base_h(x, z):
    x, z = np.asarray(x, float), np.asarray(z, float)
    d = shore(x) - z                                              # distance inland (negative out to sea)
    beach = d * 0.11
    inland = 0.55 + (d - 5.0) * 0.07
    land = np.where(d < 5.0, beach, inland)
    land = land + 5.2 * np.exp(-((x + 21) ** 2 + (z + 19) ** 2) / 60.0)        # the windmill's bluff
    land = land + 2.4 * np.exp(-((x - 24) ** 2 + (z + 22) ** 2) / 90.0)
    land = land + sm(4.0, 9.0, d) * (0.3 * (n2(x * 0.14 + 3, z * 0.14 + 7) - 0.5) + 0.08 * (n2(x * 0.5, z * 0.5) - 0.5))
    sea = np.where(d > -9.0, d * 0.14, -1.26 + (d + 9.0) * 0.3)
    sea = np.maximum(sea, -3.4)
    return np.where(d > 0, land, sea)


def terr_h(x, z):
    """Where feet stand: the natural ground, or the quay and pier on top of it."""
    x, z = np.asarray(x, float), np.asarray(z, float)
    h = natural_h(x, z)
    q = quay_mask(x, z)
    ramp = sm(QUAY[0] - 2.5, QUAY[0], x) * ((z > shore(x) - 5.0) & (z < shore(x) + 1.5))
    h = np.where(x <= QUAY[0], np.maximum(h, h + (QUAY[4] - h) * ramp * (z > shore(x) - 5.0) * (z < shore(x) + 0.4)), h)
    h = np.where(q, QUAY[4], h)
    zs = shore(2.0)
    on_pier = pier_mask(x, z)
    pier_h = np.minimum(PIER[4], 0.25 + (z - (zs - 2.5)) * 0.3)                 # a short ramp up from the sand
    h = np.where(on_pier, np.maximum(h, pier_h), h)
    return h


bw.terr_h = lambda x, z, hole=True: natural_h(x, z)


def terr_n(x, z):
    e = 0.08
    nx = -(natural_h(x + e, z) - natural_h(x - e, z)) / (2 * e)
    nz = -(natural_h(x, z + e) - natural_h(x, z - e)) / (2 * e)
    n = np.stack([nx, np.ones_like(nx), nz], 1)
    return n / np.linalg.norm(n, axis=1, keepdims=True)


def lit(n, base, lo=0.66):
    k = n @ SUN
    return base * np.where(k > 0.2, 1.0, lo)[:, None]


def grid(a, b, diam, k=0.5):
    """Evenly spread points over an a by b rectangle, each nudged a little: full cover with no holes (plain random points leave gaps)."""
    nu, nv = max(2, int(np.ceil(a / (k * diam)))), max(2, int(np.ceil(b / (k * diam))))
    u, v = np.meshgrid(np.arange(nu), np.arange(nv))
    u = (u.ravel() + rng.random(nu * nv)) / nu * a; v = (v.ravel() + rng.random(nu * nv)) / nv * b
    return u, v


def rot(p, yaw):
    c, s = np.cos(yaw), np.sin(yaw)
    q = np.array(p, float)
    x, z = q[..., 0].copy(), q[..., 2].copy()
    q[..., 0], q[..., 2] = c * x + s * z, -s * x + c * z
    return q


def blocks(p, size=0.45, tones=STONE, seed=0.0):
    """Stone-wall colouring: each block gets one of a few flat tones."""
    row = np.floor(p[:, 1] / (size * 0.6))
    u = np.floor((p[:, 0] + p[:, 2] + row * size * 0.5) / size)
    k = (bw.h3(u + seed, row, 3) * len(tones)).astype(int) % len(tones)
    return np.array(tones)[k]


ASSETS = Path(__file__).resolve().parent.parent / "assets"
_asset_cache = {}


def load_asset(name):
    if name not in _asset_cache:
        b = (ASSETS / f"{name}.splat").read_bytes()
        n = int(np.frombuffer(b[:4], np.uint32)[0]); o = 4
        pos = np.frombuffer(b[o:o + n * 12], "<f4").reshape(n, 3); o += n * 12
        col = np.frombuffer(b[o:o + n * 4], np.uint8).reshape(n, 4); o += n * 4
        misc = np.frombuffer(b[o:o + n * 4], np.uint8).reshape(n, 4); o += n * 4
        nrm = np.frombuffer(b[o:o + n * 4], np.int8).reshape(n, 4)
        _asset_cache[name] = (pos, col, misc, nrm)
    return _asset_cache[name]


# what each building stops and shades: (local x, local z, half width, half depth, height), and where its door opens
FOOT = {
    "home": {"boxes": [(0, 0, 4.45, 2.95, 5.0), (0.1, 3.55, 2.6, 0.75, 3.6)], "door": (1.1, 4.9), "pad": 6.2},
    "cabin": {"boxes": [(0, 0, 3.25, 2.65, 4.0), (0, 3.2, 1.5, 0.85, 2.6)], "door": (0.0, 4.6), "pad": 5.0},
    "hall": {"boxes": [(0, 0, 5.45, 3.25, 5.4), (0, 3.6, 1.8, 0.9, 3.0), (6.4, 0.3, 1.4, 1.6, 2.6)], "door": (0.0, 5.0), "pad": 7.6},
    "mill": {"boxes": [(0, 0, 1.6, 1.6, 6.4)], "door": (0.0, 2.6), "pad": 3.0},
}


# ---------------- shapes ----------------
class World:
    def __init__(self):
        self.out = Splats()
        self.boxes = []      # things that cast shadows and stop the player: (x, z, half w, half d, yaw, height)
        self.balls = []      # tree crowns for shadows: (x, y, z, r)
        self.solid_c = []    # round things that stop the player: (x, z, r)
        self.lights = []
        self.places = {}

    def add(self, p, col, nrm, diam, **kw):
        self.out.add(p, col, nrm, diam, **kw)

    def place(self, name, x, z, yaw=0.0, scale=1.0, keep=1.0, y=None, solid=None, crown=None):
        """Put an asset in the world. keep < 1 thins it out and enlarges what is left to cover, for the big buildings."""
        pos, col, misc, nrm = load_asset(name)
        y = float(natural_h(x, z)) if y is None else y
        sel = np.ones(len(pos), bool) if keep >= 1.0 else rng.random(len(pos)) < keep
        sel &= misc[:, 1] != 11                                                     # the mill's sails are a moving part, added separately
        p = rot(pos[sel].astype(float) * scale, yaw) + np.array([x, y, z])
        m = misc[sel].copy(); n = nrm[sel].copy(); c = col[sel]
        m[:, 2] = np.clip(np.round(m[:, 2] * scale / np.sqrt(min(keep, 1.0))), 1, 255)
        g = m[:, 1]; smoke = g == 2
        g[(g == 1) | (g == 4)] = 0                                                  # weather vane and lamp flames: still, for now
        g[smoke] = 8                                                                # chimney smoke
        nv = rot(n[:, :3].astype(float), yaw); n[:, :3] = np.round(nv)
        self.out.pos.append(p.astype(np.float32)); self.out.col.append(c); self.out.misc.append(m); self.out.nrm.append(n)
        base = name.split("_")[0]
        if base in FOOT:
            for (lx, lz, hw, hd, top) in FOOT[base]["boxes"]:
                o = rot(np.array([lx, 0, lz]) * scale, yaw)
                self.boxes.append((x + o[0], z + o[2], hw * scale, hd * scale, yaw, top * scale))
            d = rot(np.array([FOOT[base]["door"][0], 0, FOOT[base]["door"][1]]) * scale, yaw)
            return [round(float(x + d[0]), 2), round(float(z + d[2]), 2)]
        if solid: self.solid_c.append((x, z, solid * scale))
        if crown: self.balls.append((x, y + crown[0] * scale, z, crown[1] * scale))
        return None

    def lamp(self, x, z, yaw=0.0):
        self.place("lamp", x, z, yaw, solid=0.2)
        o = rot(np.array([0.42, 0, 0.0]), yaw)
        self.lights.append([float(x + o[0]), float(terr_h(x, z)) + 0.1, float(z + o[2])])

    def box(self, c, size, yaw, colour, diam=0.11, top=True, tones=None, lo=0.66, faces="xz", glow=0):
        """An upright box sitting on y = c[1]. colour is one colour or a function of local points."""
        w, h, d = size
        parts = []
        for ax, sg in (("x", 1), ("x", -1), ("z", 1), ("z", -1)):
            if ax not in faces: continue
            a, b = (d, h) if ax == "x" else (w, h)
            u, v = grid(a, b, diam); u = u - a / 2; n = len(u)
            if ax == "x": p = np.stack([np.full(n, sg * w / 2), v, u], 1); nr = np.tile([sg, 0, 0], (n, 1))
            else: p = np.stack([u, v, np.full(n, sg * d / 2)], 1); nr = np.tile([0, 0, sg], (n, 1))
            parts.append((p, nr.astype(float)))
        if top:
            u, v = grid(w, d, diam); n = len(u)
            p = np.stack([u - w / 2, np.full(n, h), v - d / 2], 1)
            parts.append((p, np.tile([0.0, 1.0, 0.0], (n, 1))))
        p = np.vstack([q[0] for q in parts]); nr = np.vstack([q[1] for q in parts])
        col = colour(p) if callable(colour) else np.repeat(np.asarray(colour)[None], len(p), 0)
        pw, nw = rot(p, yaw) + np.asarray(c, float), rot(nr, yaw)
        self.add(pw, col if glow else lit(nw, col, lo), nw, diam, glow=glow)

    def tube(self, a, b, ra, rb, colour, diam=0.09, lo=0.66, sway=0.0):
        a, b = np.asarray(a, float), np.asarray(b, float)
        ln = np.linalg.norm(b - a)
        n = max(8, int(2 * np.pi * (ra + rb) / 2 * ln / (0.5 * diam) ** 2))
        p, nr, _t = tube_points(a, b, ra, rb, n)
        col = colour(p) if callable(colour) else np.repeat(np.asarray(colour)[None], len(p), 0)
        self.add(p, lit(nr, col, lo), nr, diam, sway=sway)

    def disc(self, c, r, colour, diam=0.1, normal=(0, 1, 0)):
        n = max(6, int(np.pi * r * r / (0.5 * diam) ** 2))
        a, q = rng.uniform(0, 2 * np.pi, n), np.sqrt(rng.random(n)) * r
        p = np.stack([np.cos(a) * q, np.zeros(n), np.sin(a) * q], 1) + np.asarray(c, float)
        nr = np.tile(np.asarray(normal, float), (n, 1))
        self.add(p, lit(nr, np.repeat(np.asarray(colour)[None], n, 0)), nr, diam)

    def gable_roof(self, c, w, d, rise, yaw, tones, over=0.45, diam=0.12, sag=0.12):
        """Two sloping sides with rows of shingles, plus the triangles under them. The ridge runs along local x."""
        hw, hd = w / 2 + over, d / 2 + over
        slope = np.hypot(hd, rise)
        for sg in (1, -1):
            u, v = grid(2 * hw, slope, diam); u = u - hw; v = v / slope; n = len(u)
            dip = sag * np.sin(v * np.pi) + 0.06 * np.sin(u * 2.2)                 # a little sag, so it is not a ruler-straight roof
            p = np.stack([u, rise * (1 - v) - dip + 0.0, sg * hd * v], 1)
            row = np.floor(v * slope / 0.34)
            k = (bw.h3(np.floor((u + row * 0.21) / 0.42), row, 9) * 2.3).astype(int) % 2
            col = np.array(tones)[k] * np.where(row % 2 == 0, 1.0, 0.93)[:, None]
            nr = np.tile([0.0, hd, sg * rise], (n, 1)); nr /= np.linalg.norm(nr, axis=1, keepdims=True)
            pw, nw = rot(p, yaw) + np.asarray(c, float), rot(nr, yaw)
            self.add(pw, lit(nw, col, 0.7), nw, diam)
        for sg in (1, -1):                                                         # gable ends, in plaster
            t, v = grid(2.0, 1.0, 0.11 / max(d / 2, rise)); t = (t - 1.0); keep = np.abs(t) <= v + 0.03; t, v = t[keep], v[keep]; n = len(v)
            p = np.stack([np.full(n, sg * w / 2), rise * (1 - v), t * d / 2], 1)
            nr = np.tile([float(sg), 0, 0], (n, 1))
            pw, nw = rot(p, yaw) + np.asarray(c, float), rot(nr, yaw)
            self.add(pw, lit(nw, np.repeat(PLASTER[0][None], n, 0)), nw, 0.11)

    def cone(self, c, r, h, tones, diam=0.12, r_top=0.0):
        a, v = grid(2 * np.pi * max(r, r_top), np.hypot(r - r_top, h), diam); a = a / max(r, r_top); v = v / np.hypot(r - r_top, h); n = len(a)
        rr = r + (r_top - r) * v
        p = np.stack([np.cos(a) * rr, h * v, np.sin(a) * rr], 1) + np.asarray(c, float)
        nr = np.stack([np.cos(a) * h, np.full(n, r - r_top), np.sin(a) * h], 1); nr /= np.linalg.norm(nr, axis=1, keepdims=True)
        row = np.floor(v * h / 0.3)
        k = (bw.h3(np.floor(a * rr / 0.4), row, 5) * 2.3).astype(int) % 2
        col = (np.array(tones)[k] if len(tones) == 2 else blocks(p - np.asarray(c, float), tones=tones)) * np.where(row % 2 == 0, 1.0, 0.94)[:, None]
        self.add(p, lit(nr, col, 0.68), nr, diam)

    def window(self, c, yaw, w=0.7, h=0.8):
        """A lit pane with a dark frame. The pane glows at night."""
        c = np.asarray(c, float) + rot(np.array([0, 0, 0.1]), yaw)                  # stand proud of the wall, or the two blend into speckle
        self.box(c, (w, h, 0.1), yaw, WINDOW, diam=0.13, top=False, faces="z", glow=255)
        for dx in (-w / 2, w / 2, 0.0):
            self.box(c + rot(np.array([dx, 0, 0.04]), yaw), (0.08, h, 0.12), yaw, TIMBER, diam=0.07, top=False)
        for dy in (0.0, h):
            self.box(c + rot(np.array([0, dy - 0.03, 0.04]), yaw), (w + 0.12, 0.08, 0.12), yaw, TIMBER, diam=0.07)

    def house(self, x, z, yaw, w, d, wall, rise, roof, door_side=1, chimney=True, timber=True):
        y = float(natural_h(x, z)) - 0.05
        c = np.array([x, y, z])
        self.box(c, (w, wall, d), yaw, lambda p: mixc(PLASTER[0][None], PLASTER[1][None], n2(p[:, 0] * 1.3 + p[:, 2], p[:, 1] * 1.3) > 0.62), top=False)
        self.box(c, (w + 0.12, 0.45, d + 0.12), yaw, lambda p: blocks(p), top=False, diam=0.1)        # stone footing
        if timber:
            for sx in (-1, 1):
                for sz in (-1, 1):
                    self.box(c + rot(np.array([sx * w / 2, 0, sz * d / 2]), yaw), (0.2, wall, 0.2), yaw, TIMBER, diam=0.08, top=False)
            for sz in (-1, 1):
                self.box(c + rot(np.array([0, wall - 0.2, sz * d / 2]), yaw), (w, 0.18, 0.14), yaw, TIMBER, diam=0.08)
                self.box(c + rot(np.array([0, wall * 0.5, sz * d / 2]), yaw), (w, 0.14, 0.12), yaw, TIMBER, diam=0.08)
            for sx in (-1, 1):
                self.box(c + rot(np.array([sx * w / 2, wall - 0.2, 0]), yaw), (0.14, 0.18, d), yaw, TIMBER, diam=0.08)
        self.gable_roof(c + np.array([0, wall, 0]), w, d, rise, yaw, roof)
        # door and windows on the front (local +z), windows on the sides
        front = d / 2 + 0.04
        self.box(c + rot(np.array([door_side * w * 0.18, 0, front + 0.1]), yaw), (0.85, 1.55, 0.12), yaw, WOOD_DARK, diam=0.1, top=False)
        self.window(c + rot(np.array([-door_side * w * 0.22, wall * 0.42, front]), yaw), yaw)
        self.window(c + rot(np.array([0, wall * 0.42, -front]), yaw), yaw + np.pi)
        self.window(c + rot(np.array([w / 2 + 0.04, wall * 0.42, 0]), yaw), yaw + np.pi / 2)
        self.window(c + rot(np.array([0, wall + rise * 0.3, front + 0.0]), yaw), yaw, 0.5, 0.5) if False else None
        if chimney:
            cc = c + rot(np.array([-w * 0.28, wall + rise * 0.35, -d * 0.12]), yaw)
            self.box(cc, (0.6, rise * 0.95, 0.6), yaw, lambda p: blocks(p, 0.3), diam=0.09)
            self.places.setdefault("smoke", []).append([float(cc[0]), float(cc[1] + rise * 0.95), float(cc[2])])
        self.boxes.append((x, z, w / 2 + 0.1, d / 2 + 0.1, yaw, wall + rise * 0.55))
        door = c + rot(np.array([door_side * w * 0.18, 0, d / 2 + 0.75]), yaw)
        self.places.setdefault("doors", []).append([round(float(door[0]), 2), round(float(door[2]), 2)])
        return c

    def tree(self, x, z, h=4.2, r=2.2, leaves=24000):
        y = float(natural_h(x, z))
        top = np.array([x + rng.uniform(-0.3, 0.3), y + h, z + rng.uniform(-0.3, 0.3)])
        self.tube([x, y - 0.1, z], top, 0.34, 0.2, TRUNK, diam=0.1)
        blobs = [(top + np.array([0, r * 0.25, 0]), r)] + [(top + np.array([np.cos(a) * r * 0.75, rng.uniform(-0.3, 0.5) * r * 0.5, np.sin(a) * r * 0.75]), r * rng.uniform(0.5, 0.7)) for a in rng.uniform(0, 2 * np.pi, 5)]
        for cc, rr in blobs:
            self.tube(top - np.array([0, 0.5, 0]), cc - np.array([0, rr * 0.4, 0]), 0.12, 0.06, TRUNK, diam=0.08)
            n = int(leaves * rr * rr / sum(b[1] ** 2 for b in blobs))
            v = sphere_points(n) * (rng.random((n, 1)) ** 0.25)
            p = v * np.array([rr, rr * 0.8, rr]) + cc
            lightness = np.clip((v @ SUN) * 0.5 + 0.5 + 0.25 * (rng.random(n) - 0.5), 0, 1)
            col = np.array(LEAF)[np.digitize(lightness, [0.42, 0.72])]
            self.add(p, col, None, 0.085, sway=0.35 + 0.3 * rng.random(n), shape=2)
            self.balls.append((cc[0], cc[1], cc[2], rr))
        self.solid_c.append((x, z, 0.5))

    def barrel(self, x, z, y=None, r=0.3, h=0.7):
        y = float(terr_h(x, z)) if y is None else y
        self.tube([x, y, z], [x, y + h, z], r, r, lambda p: np.where((np.abs(((p[:, 1] - y) / h) - 0.25) < 0.06)[:, None] | (np.abs(((p[:, 1] - y) / h) - 0.75) < 0.06)[:, None], WOOD_DARK[None], WOOD[0][None]), diam=0.08)
        self.disc([x, y + h, z], r, WOOD[1], 0.08)
        self.solid_c.append((x, z, r + 0.1))

    def crate(self, x, z, s=0.55, y=None, yaw=0.0):
        y = float(terr_h(x, z)) if y is None else y
        self.box([x, y, z], (s, s, s), yaw, lambda p: np.where((np.abs(np.abs(p[:, 0]) - s / 2 + 0.05) < 0.05)[:, None] | (np.abs(p[:, 1] - s / 2) > s / 2 - 0.07)[:, None], WOOD_DARK[None], WOOD[0][None]), diam=0.08)
        self.solid_c.append((x, z, s * 0.6))

    def lantern(self, x, z, h=2.3):
        y = float(terr_h(x, z))
        self.tube([x, y, z], [x, y + h, z], 0.06, 0.05, WOOD_DARK, diam=0.06)
        self.tube([x, y + h, z], [x + 0.35, y + h, z], 0.035, 0.035, WOOD_DARK, diam=0.05)
        c = [x + 0.35, y + h - 0.42, z]
        self.box(c, (0.2, 0.28, 0.2), 0.0, LANTERN, diam=0.09, glow=255)
        self.box([c[0], c[1] + 0.28, c[2]], (0.26, 0.07, 0.26), 0.0, WOOD_DARK, diam=0.06)
        self.lights.append([float(c[0]), float(y + 0.1), float(c[2])])
        self.solid_c.append((x, z, 0.18))

    def fence(self, pts, h=0.75):
        pts = [np.array([p[0], float(terr_h(p[0], p[1])), p[1]]) for p in pts]
        for a, b in zip(pts[:-1], pts[1:]):
            n = max(1, int(np.linalg.norm(b - a) / 1.3))
            for i in range(n + 1):
                q = a + (b - a) * i / n; q[1] = float(terr_h(q[0], q[2]))
                self.tube(q, q + [0, h, 0], 0.07, 0.06, WOOD[1], diam=0.07)
            for hh in (0.3, 0.62):
                self.tube(a + [0, hh * h / 0.75, 0], b + [0, hh * h / 0.75, 0], 0.04, 0.04, WOOD[0], diam=0.06)
            mid = (a + b) / 2
            self.boxes_thin = getattr(self, "boxes_thin", [])
            self.boxes_thin.append((mid[0], mid[2], np.linalg.norm(b - a) / 2, 0.15, -np.arctan2(b[2] - a[2], b[0] - a[0])))

    def stall(self, x, z, yaw, c1, c2=CREAM, goods=(RED, YELLOW)):
        """A market stall: counter, four posts and a striped canopy that moves in the wind."""
        y = float(terr_h(x, z)); c = np.array([x, y, z])
        self.box(c, (1.9, 0.8, 0.9), yaw, WOOD[0], diam=0.09)
        for sx in (-1, 1):
            for sz in (-1, 1):
                q = c + rot(np.array([sx * 1.0, 0, sz * 0.6]), yaw)
                self.tube(q, q + [0, 2.0 + 0.25 * (sz < 0), 0], 0.05, 0.05, WOOD_DARK, diam=0.06)
        u, v = grid(2.4, 1.7, 0.1); u = u - 1.2; v = v - 0.85; n = len(u)
        p = np.stack([u, 2.12 - 0.15 * v - 0.08 * np.cos(u * 2.6) * 0 + 0.0, v], 1)
        col = np.where((np.floor((u + 1.2) / 0.3) % 2 == 0)[:, None], np.asarray(c1)[None], np.asarray(c2)[None])
        nr = np.tile([0.0, 1.0, 0.15], (n, 1))
        self.add(rot(p, yaw) + c, lit(rot(nr, yaw), col, 0.8), None, 0.1, sway=0.12 * (0.5 + 0.5 * np.abs(v) / 0.85))
        for i, g in enumerate(goods * 2):                                          # heaps of goods on the counter
            q = c + rot(np.array([-0.6 + 0.4 * i, 0.8, 0.05]), yaw)
            v3 = sphere_points(160); v3 = v3[v3[:, 1] > -0.1]
            self.add(v3 * [0.17, 0.13, 0.17] + q, lit(v3, np.repeat(np.asarray(g)[None], len(v3), 0), 0.75), v3, 0.07)
        self.boxes_thin = getattr(self, "boxes_thin", [])
        self.boxes_thin.append((x, z, 1.05, 0.55, yaw))

    def boat(self, c, yaw, hull=RED, local=False):
        """A rowing boat. Returns its splats in local coordinates when local=True (so the game can rock it)."""
        u, a = grid(2.0, np.pi, 0.042); u = u - 1.0; n = len(u)
        wid = 0.55 * (1 - np.abs(u) ** 2.6) + 0.04
        p = np.stack([u * 1.35, -np.sin(a) * 0.36 * (1 - 0.2 * np.abs(u)) + 0.3, np.cos(a) * wid], 1)
        nr = np.stack([u * 0.2, -np.sin(a), np.cos(a)], 1); nr /= np.linalg.norm(nr, axis=1, keepdims=True)
        col = np.where((p[:, 1] > 0.22)[:, None], CREAM[None], np.asarray(hull)[None])
        inner = p * [0.96, 1, 0.9] + [0, 0.04, 0]
        seats = []
        for sx in (-0.5, 0.3):
            m = 400; q = np.stack([sx + rng.uniform(-0.09, 0.09, m), np.full(m, 0.2), rng.uniform(-0.45, 0.45, m)], 1); seats.append(q)
        st = np.vstack(seats)
        P = np.vstack([p, inner, st]); N = np.vstack([nr, -nr, np.tile([0.0, 1, 0], (len(st), 1))])
        C = np.vstack([lit(nr, col), lit(-nr, np.repeat(WOOD[0][None], n, 0), 0.75), np.repeat(WOOD[1][None], len(st), 0)])
        if local:
            s = Splats(); s.add(P, C, N, 0.085); return s.arrays()
        self.add(rot(P, yaw) + np.asarray(c, float), C, rot(N, yaw), 0.085)
        self.solid_c.append((c[0], c[2], 0.8))


def polyline_dist(x, z, pts):
    d = np.full(x.shape, 1e9)
    for (ax, az), (bx, bz) in zip(pts[:-1], pts[1:]):
        vx, vz = bx - ax, bz - az
        t = np.clip(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1)
        d = np.minimum(d, np.hypot(x - ax - t * vx, z - az - t * vz))
    return d


PATHS = [
    ([(-10.9, 0.2), (-5.0, 1.6), (0.0, 3.0), (2.0, 4.0)], 1.0),                      # cottage to the dock
    ([(0.0, 3.0), (5.0, 2.4), (8.0, 2.6), (10.0, 3.2)], 1.0),                         # along the shore to the quay
    ([(-5.0, 1.6), (-3.0, -5.0), (-1.0, -10.5), (2.8, -15.0), (4.0, -21.0), (4.5, -29.0)], 1.1),   # the road out, past the hall, to the gate
    ([(-1.0, -10.5), (6.0, -8.0), (12.0, -5.6), (17.0, -3.4), (21.5, -1.6)], 0.9),    # into the houses
    ([(12.0, -5.6), (12.5, -2.0), (13.0, 1.0)], 0.8),                                 # down to the market
    ([(-1.0, -10.5), (-8.0, -13.4), (-14.0, -15.0), (-20.6, -15.8)], 0.7),            # up to the windmill
]


def path_dist(x, z):
    d = np.full(np.shape(x), 1e9)
    for pts, w in PATHS:
        d = np.minimum(d, polyline_dist(x, z, pts) - w)
    return d


def shadowed(W, p):
    """True where the sun is blocked by a building or a tree crown."""
    out = np.zeros(len(p), bool)
    for (bx, bz, hw, hd, yaw, top) in W.boxes:
        base = float(natural_h(bx, bz))
        q = rot(p - np.array([bx, base, bz]), -yaw); L = rot(SUN[None], -yaw)[0]
        t0, t1 = np.zeros(len(p)), np.full(len(p), 60.0)
        for ax, lo, hi in ((0, -hw, hw), (1, -1.0, top), (2, -hd, hd)):
            a, b = (lo - q[:, ax]) / L[ax], (hi - q[:, ax]) / L[ax]
            t0, t1 = np.maximum(t0, np.minimum(a, b)), np.minimum(t1, np.maximum(a, b))
        out |= (t1 > t0 + 0.05)
    for (cx, cy, cz, r) in W.balls:
        oc = p - np.array([cx, cy, cz])
        b = oc @ SUN
        out |= (b < 0) & ((oc * oc).sum(1) - b * b < (r * 0.92) ** 2)
    return out


def build():
    W = World()
    P = W.places
    # ---------- buildings: the assets from the Fernhollow artifact ----------
    SITES = [("home", -13.0, -4.5, 0.25, 0.6), ("cabin_blue", 8.0, -16.8, -0.1, 0.5), ("cabin_red", 14.2, -10.4, 0.1, 0.5), ("cabin_red", 21.4, -6.6, -0.15, 0.5),
             ("cabin_red", 27.6, -11.2, 0.3, 0.5), ("hall", -5.5, -19.0, 0.2, 0.45), ("mill", -21.0, -19.0, 0.0, 1.0)]
    for (nm, x, z, yaw, keep) in SITES:
        PADS.append((x, z, FOOT[nm.split("_")[0]]["pad"], float(base_h(x, z)) + 0.05))
    doors = [W.place(nm, x, z, yaw, keep=keep) for (nm, x, z, yaw, keep) in SITES]
    P["doors"] = [doors[0], doors[1], doors[2], doors[3], doors[4], doors[2], doors[5]]     # 0 home, 1 the blue cabin, 2-5 red cabins, 6 the hall
    P["home_door"] = doors[0]; P["hall_door"] = doors[5]; P["smoke"] = []
    HOME = lambda lx, lz: [round(float(v), 2) for v in (rot(np.array([lx, 0, lz]), 0.25) + np.array([-13.0, 0, -4.5]))[[0, 2]]]
    W.solid_c.append((-21.0, -19.0, 1.9))
    hub = [-21.0, float(natural_h(-21.0, -19.0)) + 4.75, -19.0]
    # the tower (generated: the artifact has none)
    tx, tz = 21.0, -14.0; ty = float(natural_h(tx, tz)) - 0.1
    W.cone([tx, ty, tz], 1.9, 6.4, STONE, r_top=1.7)
    W.cone([tx, ty + 6.4, tz], 2.5, 3.0, ROOF_BLUE)
    W.tube([tx, ty + 9.3, tz], [tx, ty + 11.0, tz], 0.04, 0.03, WOOD_DARK, diam=0.05)
    n = 900; u, v = rng.random(n), rng.random(n)
    W.add(np.stack([tx + 0.05 + u * 1.2, ty + 10.3 + v * 0.55 * (1 - 0.35 * u), np.full(n, tz)], 1), np.repeat(RED[None], n, 0), None, 0.09, sway=0.9 * u)
    for a in (0.8, 2.6, 4.4):
        W.window([tx + np.sin(a) * 1.86, ty + 4.2, tz + np.cos(a) * 1.86], a, 0.5, 0.7)
    W.boxes.append((tx, tz, 1.9, 1.9, 0.0, 8.0)); W.solid_c.append((tx, tz, 2.0))
    # the gate on the road out, with its signpost
    W.place("gate", 4.2, -24.4); W.solid_c.append((2.5, -24.4, 0.45)); W.solid_c.append((5.9, -24.4, 0.45))
    W.place("sign", 6.8, -22.2, -0.3, solid=0.3); W.place("sign", 0.6, 1.2, 0.5, solid=0.3)
    P["gate"] = [4.2, -25.0]
    # ---------- the quay, the harbour wall, the market ----------
    x, y = grid(QUAY[1] - QUAY[0], QUAY[4] + 1.4, 0.12); x = x + QUAY[0]; y = y - 1.4; n = len(x); zs = shore(x) + 1.5
    for face in range(2):
        if face == 0:
            p = np.stack([x, y, zs], 1); nr = np.tile([0.0, 0, 1], (n, 1))
        else:
            z, y = grid(6.5, QUAY[4] + 0.6, 0.12); m = len(z); z = z - 5.0 + shore(np.full(m, QUAY[1])); y = y - 0.6
            p = np.stack([np.full(m, QUAY[1]), y, z], 1); nr = np.tile([1.0, 0, 0], (m, 1))
        W.add(p, lit(nr, blocks(p, 0.55)), nr, 0.12)
    for bx in np.arange(QUAY[0] + 1.5, QUAY[1], 3.4):                               # bollards along the edge
        bz = float(shore(bx)) + 1.15
        W.tube([bx, QUAY[4], bz], [bx, QUAY[4] + 0.45, bz], 0.13, 0.1, STONE[1], diam=0.08); W.solid_c.append((bx, bz, 0.2))
    stalls = [(12.0, RED, (RED, YELLOW)), (15.6, YELLOW, (hexc(0x8ACC50), RED)), (19.2, TEAL, (hexc(0xC0D8E8), hexc(0x8AA8C0))), (22.8, RED, (YELLOW, hexc(0xE89040)))]
    P["stalls"] = []
    for sx, c1, goods in stalls:
        sz = float(shore(sx)) - 2.6
        W.stall(sx, sz, 0.0, c1, goods=goods); P["stalls"].append([sx, sz + 1.3])
    for (bx, bz) in [(10.6, 0.3), (11.1, 0.9), (24.6, -0.4), (17.4, -2.4)]:
        W.barrel(bx, float(shore(bx)) + bz - 1.0)
    for (cx, cz, s) in [(14.0, 0.6, 0.6), (14.5, 0.1, 0.5), (21.0, 0.4, 0.55), (25.6, -1.6, 0.6), (26.0, -1.0, 0.5)]:
        W.crate(cx, float(shore(cx)) + cz - 0.8, s, yaw=rng.uniform(0, 1))
    # a well in the little square between the houses and the market
    wx, wz = 16.8, -2.4
    W.place("well", wx, wz, 0.2, solid=1.0); P["well"] = [wx, wz + 1.5]
    # ---------- the pier ----------
    zs2 = float(shore(2.0)); cxp = (PIER[0] + PIER[1]) / 2
    x, z = grid(1.7, PIER_LEN + 2.5, 0.1); x = x + PIER[0] - 0.05; z = z + zs2 - 2.5; n = len(x)
    plank = np.floor(z / 0.32)
    col = np.array(WOOD)[(bw.h3(plank, 1, 2) * 2.4).astype(int) % 2] * np.where(np.abs(z / 0.32 - plank - 0.5) > 0.44, 0.7, 1.0)[:, None]
    W.add(np.stack([x, terr_h(x, z) + 0.01, z], 1), col, np.tile([0.0, 1, 0], (n, 1)), 0.1)
    for pz in np.arange(zs2 - 0.5, zs2 + PIER_LEN + 0.1, 2.1):
        for px in (PIER[0] - 0.1, PIER[1] + 0.1):
            W.tube([px, float(natural_h(px, pz)) - 0.2, pz], [px, PIER[4] + 0.45, pz], 0.13, 0.11, WOOD_DARK, diam=0.08)
    W.barrel(PIER[0] + 0.35, zs2 + 6.0, y=PIER[4]); W.crate(PIER[1] - 0.4, zs2 + 3.0, 0.5, y=PIER[4])
    P["pier_end"] = [cxp, zs2 + PIER_LEN - 1.0]; P["pier_head"] = [cxp, zs2 - 1.5]
    boat_at = [PIER[1] + 1.2, 0.02, zs2 + PIER_LEN - 2.6]
    W.tube([PIER[1] + 0.1, PIER[4] + 0.3, zs2 + PIER_LEN - 2.1], [boat_at[0] - 0.4, 0.3, boat_at[2] + 0.9], 0.025, 0.025, hexc(0xD8C8A0), diam=0.05)
    # boats pulled up on the sand, nets drying, a fish rack
    W.boat([-4.5, float(natural_h(-4.5, 5.6)) + 0.05, 5.6], 0.5, hull=TEAL)
    W.boat([6.0, float(natural_h(6.0, 6.3)) + 0.05, 6.3], -0.35, hull=hexc(0x4C78C4))
    for i, nx_ in enumerate((-1.6, -0.2)):
        py = float(natural_h(nx_, 4.9)); W.tube([nx_, py, 4.9], [nx_, py + 1.7, 4.9], 0.05, 0.05, WOOD_DARK, diam=0.06)
    n = 1500; u, v = rng.random(n), rng.random(n); py = float(natural_h(-0.9, 4.9))
    W.add(np.stack([-1.6 + 1.4 * u, py + 1.65 - 0.9 * v - 0.25 * np.sin(u * np.pi), np.full(n, 4.9) + 0.05 * np.sin(u * 9)], 1), np.repeat(hexc(0x6C8C94)[None], n, 0) * np.where((np.floor(u * 14) + np.floor(v * 9)) % 2 == 0, 1, 0.8)[:, None], None, 0.07, sway=0.25 * v)
    P["nets"] = [-0.9, 4.0]
    # ---------- home: the fruit stall under its awning, the garden, the washing line ----------
    st = HOME(6.2, 1.2)
    W.stall(st[0], st[1], 0.25 + np.pi / 2, RED, goods=(RED, YELLOW, hexc(0x8ACC50)))
    P["fruit_stall"] = HOME(7.8, 1.4)
    b1, b2 = HOME(3.6, 4.3), HOME(6.0, -1.2)
    W.barrel(b1[0], b1[1]); W.barrel(b2[0], b2[1], r=0.26, h=0.6)
    mb = HOME(-1.6, 4.6); W.place("mailbox", mb[0], mb[1], 0.25, solid=0.25)
    for (mx_, mz_, yw) in [(10.4, -12.0, -0.1), (16.6, -5.6, 0.1)]: W.place("mailbox", mx_, mz_, yw, solid=0.25)
    W.fence([(-19.6, 0.4), (-17.6, 2.6), (-13.0, 3.2)])
    # trees and bushes: the artifact's oaks, pines and shrubs
    for (nm, x, z, sc) in [("oak", -20.6, -0.6, 0.8), ("oak_blossom", 9.6, -7.0, 0.5), ("oak", 30.0, -3.4, 0.7), ("oak_gold", -27.5, -9.0, 0.75), ("oak", -1.6, -26.0, 0.65),
                           ("oak_gold", 23.5, -21.5, 0.7), ("oak", 15.8, -20.5, 0.62), ("oak", -8.6, -11.4, 0.5), ("oak_blossom", -17.5, -11.5, 0.5)]:
        W.place(nm, x, z, rng.uniform(0, 6.28), sc, solid=0.5, crown=(5.0, 2.7))
    for (x, z, sc) in [(-27.0, -16.0, 1.0), (-16.0, -25.0, 0.9), (-26.0, -24.0, 1.1), (31.0, -18.0, 1.0), (-31.0, -3.0, 0.9), (12.0, -25.0, 1.0), (-11.5, -26.0, 0.95)]:
        W.place("pine", x, z, rng.uniform(0, 6.28), sc, solid=0.4, crown=(3.2, 1.5))
    for i, (x, z, sc) in enumerate([(-18.8, -8.6, 1.0), (-7.2, -1.2, 0.8), (-16.4, 3.4, 0.8), (5.0, -12.6, 0.9), (11.0, -13.6, 0.9), (18.2, -12.6, 1.0), (24.6, -4.6, 0.8), (30.6, -8.0, 1.0),
                                    (-0.6, -15.4, 0.8), (-12.6, -15.4, 1.0), (1.6, -25.6, 1.0), (7.4, -25.4, 1.0), (-24.0, -13.5, 0.9), (26.0, -17.0, 0.9), (-2.4, -4.6, 0.7), (12.2, -3.6, 0.7)]):
        W.place(f"bush{i % 3}", x, z, rng.uniform(0, 6.28), sc, solid=0.55)
    a, b = np.array([-17.0, float(natural_h(-17.0, -9.6)) + 1.9, -9.6]), np.array([-14.4, float(natural_h(-14.4, -12.4)) + 2.0, -12.4])
    W.tube([a[0], a[1] - 1.9, a[2]], a, 0.05, 0.05, WOOD_DARK, diam=0.06); W.tube([b[0], b[1] - 2.0, b[2]], b, 0.05, 0.05, WOOD_DARK, diam=0.06)
    W.tube(a, b, 0.012, 0.012, CREAM, diam=0.04)
    for i, cc in enumerate((CREAM, RED, hexc(0x7CA8D8), CREAM, YELLOW)):                # washing on the line
        t = 0.15 + 0.17 * i; q = a + (b - a) * t; m = 420; u, v = rng.random(m), rng.random(m)
        d = (b - a) / np.linalg.norm(b - a)
        W.add(q[None] + d[None] * (u[:, None] - 0.5) * 0.5 + np.array([0, -1, 0])[None] * v[:, None] * 0.62, np.repeat(np.asarray(cc)[None], m, 0) * (0.9 + 0.1 * (v[:, None] < 0.5)), None, 0.08, sway=0.55 * v)
    P["washing"] = [-15.4, -10.2]
    # the pen beside the hall, where the warden keeps rescues
    W.fence([(-10.6, -12.6), (-6.4, -11.6), (-6.0, -8.6), (-10.2, -9.0), (-10.6, -12.6)], h=0.85)
    P["pen"] = [-8.4, -10.6]; P["pen_gate"] = [-5.2, -10.2]
    W.barrel(0.6, -12.4); W.crate(1.2, -13.0, 0.6); W.crate(0.7, -13.6, 0.45, yaw=0.5)
    # benches and lamps, from the artifact. The eight lamps light the ground at night
    for (bx, bz, yw) in [(14.8, -4.4, 0.2), (-3.0, 2.6, 0.3), (19.0, -1.2, 2.9)]:
        W.place("bench", bx, bz, yw, solid=0.6); P.setdefault("benches", []).append([bx, bz])
    for (lx, lz, yw) in [(-9.0, 1.2, 0.0), (-1.0, 3.6, 0.0), (3.6, 3.2, 3.14), (11.0, -5.0, 0.0), (15.0, None, 0.0), (22.0, None, 3.14), (-2.0, -13.8, 0.0), (3.0, -20.0, 3.14)]:
        W.lamp(lx, float(shore(lx)) - 4.2 if lz is None else lz, yw)
    # rocks on the shore and in the shallows
    for _ in range(46):
        x = rng.uniform(-33, 33); z = float(shore(x)) + rng.uniform(-1.0, 7.0)
        if quay_mask(np.array(x), np.array(z - 1.5)) or abs(x - 2.0) < 2.4 or path_dist(np.array(x), np.array(z)) < 0.6: continue
        r = rng.uniform(0.22, 0.6); bw.add_rock(W.out, x, z, r, rng.uniform(0.55, 0.9))
        if z < shore(x) + 2.0: W.solid_c.append((x, z, r * 0.9))
    for _ in range(26):                                                                # corals and sea plants further out
        x = rng.uniform(-30, 30); z = float(shore(x)) + rng.uniform(4.0, 12.0)
        if abs(x - 2.0) < 2.2 or (QUAY[0] - 1 < x < QUAY[1] + 1 and z < shore(x) + 3.0): continue
        k = rng.integers(3)
        if k == 0: bw.add_branch_coral(W.out, x, z, rng.uniform(0.3, 0.55), bw.BRANCH[rng.integers(4)])
        elif k == 1: bw.add_brain_coral(W.out, x, z, rng.uniform(0.25, 0.45), bw.BRAIN[rng.integers(2)])
        else: bw.add_plants(W.out, x, z, 0.5, 26, 0.7, bw.PLANTS[rng.integers(3)])

    # ---------- the ground ----------
    def ground(spacing, diam, region):
        xs = np.arange(X0, X1, spacing); zs_ = np.arange(Z0, Z1, spacing)
        x, z = np.meshgrid(xs, zs_); x = x.ravel() + rng.uniform(-0.5, 0.5, x.size) * spacing; z = z.ravel() + rng.uniform(-0.5, 0.5, z.size) * spacing
        keep = region(x, z); return x[keep], z[keep]
    x, z = ground(0.068, 0.17, lambda x, z: (shore(x) - z > -0.5) | quay_mask(x, z))
    inside = np.zeros(len(x), bool)
    for (bx, bz, hw, hd, yaw, top) in W.boxes:
        q = rot(np.stack([x - bx, np.zeros(len(x)), z - bz], 1), -yaw); inside |= (np.abs(q[:, 0]) < hw - 0.25) & (np.abs(q[:, 2]) < hd - 0.25)
    x, z = x[~inside], z[~inside]
    d = shore(x) - z; q = quay_mask(x, z); pd = path_dist(x, z)
    y = np.where(q, QUAY[4], natural_h(x, z)); ramp = (x <= QUAY[0]) & (x > QUAY[0] - 2.5) & (d > 0) & (d < 5.0); y = np.where(ramp, terr_h(x, z), y)
    nr = terr_n(x, z); nr[q] = [0, 1, 0]
    g = n2(x * 0.35 + 9, z * 0.35 + 2); gk = np.digitize(g + 0.25 * (n2(x * 1.7, z * 1.7) - 0.5), [0.42, 0.66])
    col = np.array(GRASS)[gk]
    sand = d < 4.3 + 1.3 * (n2(x * 0.5, z * 0.5) - 0.5)
    col[sand] = np.array(SAND)[(n2(x[sand] * 1.6, z[sand] * 1.6) > 0.55).astype(int)]
    onpath = (pd < 0.25 * (n2(x * 1.3, z * 1.3) - 0.5)) & ~sand
    col[onpath] = np.array(PATH)[(n2(x[onpath] * 2.2 + 5, z[onpath] * 2.2) > 0.6).astype(int)]
    P_ = np.stack([x, y, z], 1)
    col[q] = blocks(np.stack([x[q], np.zeros(q.sum()), z[q] * 1.0], 1) * [1, 1, 0.0] + np.stack([np.floor(z[q] / 0.6) * 0.3, np.zeros(q.sum()), np.zeros(q.sum())], 1), 0.6, [hexc(0xC6C0B2), hexc(0xBAB4A6)])
    col[ramp] = np.array(PATH)[0]
    sh = shadowed(W, P_ + np.array([0, 0.05, 0])); col = col * np.where(sh, 0.7, 1.0)[:, None]
    W.add(P_, col, nr, 0.17)
    ground_shadow = lambda px, pz: shadowed(W, np.stack([px, natural_h(px, pz) + 0.05, pz], 1))
    # grass blades, flowers and the tall grass by the road out
    xb, zb = ground(0.085, 0.26, lambda x, z: (shore(x) - z > 5.2) & ~quay_mask(x, z))
    pdb = path_dist(xb, zb); keep = (pdb > 0.35) & (rng.random(len(xb)) < 0.72)
    for (bx, bz, hw, hd, yaw, top) in W.boxes:
        q2 = rot(np.stack([xb - bx, np.zeros(len(xb)), zb - bz], 1), -yaw); keep &= ~((np.abs(q2[:, 0]) < hw + 0.2) & (np.abs(q2[:, 2]) < hd + 0.2))
    xb, zb = xb[keep], zb[keep]
    tall = (zb < -17.0) & (np.abs(xb - 4.0) > 1.5) & (n2(xb * 0.2 + 4, zb * 0.2) > 0.38)
    hgt = np.where(tall, rng.uniform(0.55, 0.95, len(xb)), rng.uniform(0.12, 0.3, len(xb)))
    shb = ground_shadow(xb, zb)
    for t in (0.35, 0.8):
        dark, light = np.where(tall[:, None], TALL_BLADE[0][None], GRASS_BLADE[0][None]), np.where(tall[:, None], TALL_BLADE[1][None], GRASS_BLADE[1][None])
        m = np.ones(len(xb), bool) if t < 0.5 else (tall | (rng.random(len(xb)) < 0.6))
        colb = (dark + (light - dark) * t)[m] * np.where(shb[m], 0.72, 1.0)[:, None]
        W.add(np.stack([xb[m], natural_h(xb[m], zb[m]) + hgt[m] * t, zb[m]], 1), colb, None, np.where(tall[m], 0.2, 0.24), sway=np.where(tall[m], 0.75, 0.45) * t, shape=1)
    fl = (rng.random(len(xb)) < 0.012) & ~tall
    fcol = np.array([hexc(0xFFFFFF), hexc(0xF8D848), hexc(0xF07898), hexc(0xF8A0C0)])[rng.integers(0, 4, fl.sum())]
    W.add(np.stack([xb[fl], natural_h(xb[fl], zb[fl]) + 0.3, zb[fl]], 1), fcol, None, 0.12, sway=0.3)
    # flower beds by the cottage and sunflowers by the arch
    for (fx, fz, k) in [(-15.5, 1.2, 60), (-9.4, 2.2, 50), (6.8, 0.6, 30), (-1.2, -14.4, 40), (11.6, -6.6, 40)]:
        a, r_ = rng.uniform(0, 2 * np.pi, k), np.sqrt(rng.random(k)) * 1.0
        px, pz = fx + np.cos(a) * r_, fz + np.sin(a) * r_
        fcol = np.array([hexc(0xF07898), hexc(0xFFFFFF), hexc(0xF8D848), hexc(0xE85870)])[rng.integers(0, 4, k)]
        for t, c_ in ((0.5, None), (1.0, fcol)):
            W.add(np.stack([px, natural_h(px, pz) + 0.42 * t, pz], 1), np.repeat(GRASS_BLADE[0][None], k, 0) if c_ is None else c_, None, 0.1 if c_ is None else 0.14, sway=0.35 * t, shape=1 if c_ is None else 0)
    # ---------- the seabed and the surface layer ----------
    for spacing, diam, lo, hi in ((0.105, 0.2, -0.6, 14.0), (0.3, 0.55, 14.0, 34.0)):
        xs_, zs_ = ground(spacing, diam, lambda x, z: (z - shore(x) > lo) & (z - shore(x) <= hi) & ~(quay_mask(x, z) & (z < shore(x) + 1.3)))
        ys = natural_h(xs_, zs_)
        colb = np.array(SAND)[(n2(xs_ * 2, zs_ * 2) > 0.55).astype(int)]
        weed = (n2(xs_ * 0.45 + 31, zs_ * 0.45 + 7) > 0.66) & (ys < -0.5)
        colb[weed] = bw.BED_WEED
        W.add(np.stack([xs_, ys, zs_], 1), colb, terr_n(xs_, zs_), diam, sway=weed.astype(float), group=6)
    for dens, lo, hi in ((95.0, -0.3, 1.6), (14.0, 1.6, 13.0)):
        m = int(dens * (X1 - X0) * (hi - lo)); xs_ = rng.uniform(X0, X1, m); zs_ = shore(xs_) + rng.uniform(lo, hi, m)
        ok = ~(quay_mask(xs_, zs_) & (zs_ < shore(xs_) + 1.4)); xs_, zs_ = xs_[ok], zs_[ok]
        dep = np.clip(WATER - natural_h(xs_, zs_), 0, 3.0)
        W.add(np.stack([xs_, np.full(len(xs_), WATER), zs_], 1), np.repeat(bw.WATER1[None], len(xs_), 0), np.tile([0.0, 1, 0], (len(xs_), 1)), 0.16, sway=np.sqrt(dep / 3.0), group=5)

    # ---------- things the game moves: the windmill's sails and the boat at the pier ----------
    mp, mc, mm, mn = load_asset("mill"); sl = mm[:, 1] == 11
    sm_ = mm[sl].copy(); sm_[:, 1] = 0
    sails_arrays = ((mp[sl] - np.array([0, 4.75, 0], np.float32)).astype(np.float32), mc[sl], sm_, mn[sl])
    # smoke from the chimneys: loose splats the shader lifts and thins (group 8)
    for (cx, cy, cz) in P["smoke"][:5]:
        m = 46
        W.add(np.tile([cx, cy + 0.1, cz], (m, 1)) + rng.normal(0, 0.06, (m, 3)), np.repeat(hexc(0xE8E4DC)[None], m, 0) * rng.uniform(0.86, 1.0, (m, 1)), None, 0.3, group=8)
    # ---------- who lives here ----------
    D = P["doors"]            # 0 home, 1 teal house, 2-5 red houses, 6 the hall
    q = lambda x, dz=-1.0: [round(float(x), 2), round(float(shore(x)) + dz, 2)]      # a spot on the quay, dz from the water's edge
    zs2 = float(shore(2.0))
    P["npcs"] = [
        {"id": "seller", "home": D[0], "scale": 1.12, "speed": 1.4, "top": [0.86, 0.36, 0.30], "bot": [0.36, 0.30, 0.42], "hair": [0.20, 0.13, 0.10],
         "loop": [HOME(7.6, 1.3) + [16, "work", -1.4], HOME(4.6, 4.6) + [5, "stand", 2.0], HOME(7.6, 1.3) + [12, "work", -1.4], HOME(8.4, 3.6) + [4, "stand", 0.6]],
         "lines": ["Morning. The fruit's fresh, and the little thief knows it.", "Your mum says today's the day you walk to the gate."]},
        {"id": "fisher", "home": D[1], "scale": 1.18, "speed": 1.5, "top": [0.30, 0.46, 0.62], "bot": [0.30, 0.24, 0.18], "hair": [0.55, 0.52, 0.48],
         "loop": [[2.0, zs2 + 8.6, 22, "fish", 0.0], [2.0, zs2 - 2.0, 0, "stand", 0], [-0.9, 3.9, 10, "work", 0.2], [2.0, zs2 - 2.0, 0, "stand", 0]],
         "lines": ["Water's clear today. You can see right down to the weed.", "Grey dust on the boats again this morning. Third time this month."]},
        {"id": "sweeper", "home": D[3], "scale": 1.1, "speed": 1.2, "top": [0.78, 0.72, 0.52], "bot": [0.34, 0.40, 0.30], "hair": [0.30, 0.18, 0.10],
         "loop": [q(11.5) + [7, "sweep", 0.4], q(15.0, -0.4) + [7, "sweep", -0.3], q(18.5) + [7, "sweep", 0.5], q(23.0, -0.6) + [7, "sweep", -0.4], q(18.5, -1.6) + [5, "sweep", 0.0]],
         "lines": ["Sweep it at dawn and it's back by noon.", "It isn't sand. Sand doesn't smear."]},
        {"id": "chat_a", "home": D[2], "scale": 1.1, "speed": 1.4, "top": [0.52, 0.34, 0.58], "bot": [0.24, 0.22, 0.30], "hair": [0.12, 0.10, 0.10],
         "loop": [[15.5, -1.6, 26, "talk", 1.2], [14.8, -3.4, 9, "stand", 2.6]],
         "lines": ["Another one came in to the warden last night. From further out than the last.", "Somebody's been asking after the elders, I heard."]},
        {"id": "chat_b", "home": D[4], "scale": 1.16, "speed": 1.4, "top": [0.92, 0.78, 0.40], "bot": [0.40, 0.28, 0.20], "hair": [0.42, 0.24, 0.12],
         "loop": [[18.2, -1.5, 30, "talk", -1.6], [19.4, -2.6, 6, "stand", 3.1]],
         "lines": ["The well's never run low. Not once in my life.", "You're up early. Off to the gate?"]},
        {"id": "warden", "home": D[6], "scale": 1.2, "speed": 1.5, "top": [0.34, 0.52, 0.40], "bot": [0.30, 0.26, 0.22], "hair": [0.24, 0.16, 0.10],
         "loop": [[-5.2, -10.0, 14, "work", -1.6], [-1.6, -12.6, 7, "work", 2.4], [-5.2, -10.0, 10, "stand", -1.6], [P["hall_door"][0], P["hall_door"][1] + 0.4, 5, "stand", 0.3]],
         "lines": ["Easy near the pen. The calf's only been here a week.", "He's a long way from home. They all are."]},
        {"id": "kid", "home": D[0], "scale": 0.82, "speed": 3.3, "top": [0.95, 0.60, 0.25], "bot": [0.28, 0.44, 0.60], "hair": [0.16, 0.10, 0.08],
         "loop": [[-6.0, 3.2, 1.5, "stand", 0], [-2.0, 5.0, 1, "stand", 0], [4.6, 5.6, 2.5, "stand", 0], [-3.0, 2.2, 1, "stand", 0], [-11.0, 3.6, 3, "stand", 0]],
         "lines": ["Can't stop! He took a whole mango!", "Race you to the dock!"]},
        {"id": "trader", "home": D[5], "scale": 1.14, "speed": 1.4, "top": [0.30, 0.56, 0.58], "bot": [0.44, 0.32, 0.22], "hair": [0.70, 0.66, 0.60],
         "loop": [[15.6, float(shore(15.6)) - 3.6, 18, "work", 0.0], [14.2, float(shore(14.2)) - 0.9, 6, "work", 1.5], [15.6, float(shore(15.6)) - 3.6, 14, "stand", 0.0]],
         "lines": ["Nets, rope, lamp oil. Nothing you'd need for a walk to the gate.", "Boats from the outer islands are late again."]},
        {"id": "elder", "home": D[1], "scale": 1.08, "speed": 0.95, "top": [0.62, 0.60, 0.66], "bot": [0.36, 0.34, 0.40], "hair": [0.86, 0.86, 0.84],
         "loop": [[-2.6, 3.2, 24, "stand", 0.4], [-4.6, 0.8, 0, "stand", 0], [-2.6, -5.6, 4, "stand", 0], [-0.6, -10.6, 8, "stand", 2.2], [-2.6, -5.6, 0, "stand", 0], [-4.6, 0.8, 0, "stand", 0]],
         "lines": ["Off to the gate at last? Mind the tall grass.", "I've sat on this bench forty years. The sea was never this colour grey at dawn."]},
    ]
    P["strays"] = [
        {"id": "sleeper", "kind": "sleeper", "x": q(10.9, -0.5)[0], "z": q(10.9, -0.5)[1], "scale": 0.5, "fur": [0.46, 0.50, 0.58]},
        {"id": "thief", "kind": "thief", "x": -3.0, "z": 3.4, "scale": 0.46, "fur": [0.80, 0.70, 0.50], "stall": HOME(8.2, 0.2)},
    ]
    props = {"sails": (sails_arrays, {"at": hub, "yaw": 0.0}), "boat": (W.boat(None, 0, local=True), {"at": boat_at, "yaw": 1.45})}
    return W, props


def main():
    W, props = build()
    pos, col, misc, nrm = W.out.arrays()
    print("splats:", len(pos))
    # map cells, shuffled so the first half of each is an even sample
    cx, cz = np.floor(pos[:, 0] / CELL).astype(int), np.floor(pos[:, 2] / CELL).astype(int)
    order = np.lexsort((rng.random(len(pos)), cx, cz))
    pos, col, misc, nrm, cx, cz = pos[order], col[order], misc[order], nrm[order], cx[order], cz[order]
    key = cz * 10000 + cx; cuts = np.flatnonzero(np.diff(key)) + 1; starts = np.concatenate([[0], cuts]); ends = np.concatenate([cuts, [len(pos)]])
    chunks = [{"s": int(s), "c": int(e - s), "mn": [float(v) for v in pos[s:e].min(0) - PAD], "mx": [float(v) for v in pos[s:e].max(0) + PAD]} for s, e in zip(starts, ends)]
    P, C, M, N = [pos], [col], [misc], [nrm]; total = len(pos)
    for name, ((pp, pc, pm, pn), info) in props.items():
        chunks.append({"s": total, "c": len(pp), "mn": [float(v) for v in pp.min(0) - PAD], "mx": [float(v) for v in pp.max(0) + PAD], "prop": name, **info})
        P.append(pp); C.append(pc); M.append(pm); N.append(pn); total += len(pp)
    pos, col, misc, nrm = np.vstack(P), np.vstack(C), np.vstack(M), np.vstack(N)
    # the height grid the player walks on
    d = 0.25; gx, gz = int((X1 - X0) / d) + 1, int((Z1 - Z0) / d) + 1
    Xg, Zg = np.meshgrid(X0 + np.arange(gx) * d, Z0 + np.arange(gz) * d)
    hgrid = terr_h(Xg, Zg)
    # palette: fitted to the town and the characters, plus the water's own eight and two for lights
    lake = (misc[:, 1] == 5) | (misc[:, 1] == 6) | (col[:, 3] > 127)
    sample = col[~lake, :3] / 255.0
    sample = sample[rng.choice(len(sample), 60000, replace=False)]
    parts = [sample] + [skinned_colours(nm)[::2] for nm in ("hero", "calf")]
    pal = np.vstack([fit_palette(np.vstack(parts), 22), np.array(bw.WATER_PAL), WINDOW[None], LANTERN[None]])
    solid = [[float(v) for v in b[:5]] for b in W.boxes] + [[float(v) for v in b] for b in getattr(W, "boxes_thin", [])]
    world = {"n": int(len(pos)), "chunks": chunks, "bg": [0.043, 0.039, 0.078], "water": WATER, "sea": True,
             "hgrid": {"gx": gx, "gz": gz, "x0": X0, "z0": Z0, "d": d, "h": [round(float(v), 3) for v in hgrid.ravel()]},
             "bounds": [X0 + 1.5, X1 - 1.5, Z0 + 1.0, Z1 - 4.0], "solid": solid, "solid_c": [[round(float(v), 2) for v in c] for c in W.solid_c],
             "lights": W.lights[:8], "places": W.places, "pond": [0.0, 0.0, 4000.0, 4000.0], "pond_zone": 1.5,
             "crit": [{"kind": "calf", "x": W.places["pen"][0], "z": W.places["pen"][1]}]}
    pos.astype("<f4").tofile(DATA / "town_pos.bin"); col.tofile(DATA / "town_col.bin"); misc.tofile(DATA / "town_misc.bin"); nrm.tofile(DATA / "town_nrm.bin")
    (DATA / "town.json").write_text(json.dumps(world, separators=(",", ":")))
    (DATA / "town_palette.json").write_text(json.dumps({"cols": 32, "pal": [round(float(v), 4) for v in pal.ravel()]}))
    print("chunks:", len(chunks), "solids:", len(solid), len(W.solid_c), "lights:", len(W.lights))


if __name__ == "__main__":
    main()
