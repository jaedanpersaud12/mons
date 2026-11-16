#!/usr/bin/env python3
"""Lift the buildings and props out of the Fernhollow Splat Town artifact as individual splat assets.

The artifact (the browser build of the town) bakes each building from sculpted shapes into splats when it loads.
This script opens it in headless Chrome, asks it to emit each asset once at the origin, lit by this game's sun,
and saves the result as game/assets/<name>.splat plus a manifest.

Run:   python3 tools/export_assets.py /path/to/fernhollow-splat-town.html
Needs playwright and Chrome. The exported files are committed, so this only has to be re-run if the artifact changes.

File format (.splat): uint32 count, then float32 pos[count*3], uint8 col[count*4], uint8 misc[count*4], int8 nrm[count*4],
the same four arrays the game's world files use.
"""
import asyncio, base64, json, sys
from pathlib import Path

import numpy as np
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parent.parent / "assets"
SUN = [0.35, 0.85, 0.4]
# name in the game, asset in the artifact, roof or leaf tint
WANT = [("home", "home", None), ("cabin_red", "cabin", "red"), ("cabin_blue", "cabin", "blue"), ("hall", "hall", "hall"), ("mill", "mill", "mill"),
        ("oak", "oak", None), ("oak_gold", "oak", "oak2"), ("oak_blossom", "oak", "blossom"), ("pine", "pine", "pine"),
        ("bush0", "bush0", None), ("bush1", "bush1", None), ("bush2", "bush2", None), ("lamp", "lamp", None), ("fence", "fence", None), ("well", "well", None),
        ("sign", "sign", None), ("mailbox", "mailbox", None), ("bench", "bench", None), ("rocks", "rocks", None), ("gate", "gate", None), ("dock", "dock", None)]

JS = """([asset, tint, sun]) => {
  const l = Math.hypot(...sun), L = sun.map(v => v / l), A = AS[asset];
  resetBuild(A.n + 64); INDOOR = false; curObj = 0;
  emit({A, x: 0, y: 0, z: 0, rot: 0, sc: 1, L, tint: tint ? TINT[tint] : null});
  const b64 = a => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
  return {n: N, R: A.R, H: A.H, vane: A.vane || null, mill: A.mill || null,
          pos: b64(pos.subarray(0, N * 3)), col: b64(col.subarray(0, N * 4)), misc: b64(misc.subarray(0, N * 4)), nrm: b64(nrm.subarray(0, N * 4))};
}"""


async def main(html):
    OUT.mkdir(exist_ok=True)
    manifest = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 640, "height": 400})
        await pg.goto(Path(html).resolve().as_uri())
        for _ in range(150):
            await pg.wait_for_timeout(2000)
            keys = await pg.evaluate("(()=>{try{return Object.keys(AS)}catch(e){return []}})()")
            if "dock" in keys: break
        await pg.wait_for_timeout(3000)
        for name, asset, tint in WANT:
            r = await pg.evaluate(JS, [asset, tint, SUN])
            n = r["n"]
            pos = np.frombuffer(base64.b64decode(r["pos"]), "<f4").reshape(n, 3).copy()
            col = np.frombuffer(base64.b64decode(r["col"]), np.uint8).reshape(n, 4).copy()
            misc = np.frombuffer(base64.b64decode(r["misc"]), np.uint8).reshape(n, 4).copy()
            nrm = np.frombuffer(base64.b64decode(r["nrm"]), np.int8).reshape(n, 4).copy()
            keep = misc[:, 1] != 12                                    # group 12 is hidden in the artifact
            pos, col, misc, nrm = pos[keep], col[keep], misc[keep], nrm[keep]
            with open(OUT / f"{name}.splat", "wb") as f:
                f.write(np.uint32(len(pos)).tobytes()); f.write(pos.astype("<f4").tobytes()); f.write(col.tobytes()); f.write(misc.tobytes()); f.write(nrm.tobytes())
            g, cnt = np.unique(misc[:, 1], return_counts=True)
            manifest[name] = {"n": int(len(pos)), "radius": round(r["R"], 3), "height": round(r["H"], 3), "min": [round(float(v), 3) for v in pos.min(0)], "max": [round(float(v), 3) for v in pos.max(0)],
                              "groups": {int(a): int(c) for a, c in zip(g, cnt)}, "vane": r["vane"], "mill": r["mill"], "glow": int((col[:, 3] > 127).sum())}
            print(name, manifest[name]["n"], manifest[name]["min"], manifest[name]["max"], manifest[name]["groups"])
        await b.close()
    (OUT / "assets.json").write_text(json.dumps(manifest, indent=1))


asyncio.run(main(sys.argv[1]))
