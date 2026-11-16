#!/usr/bin/env python3
"""Still-frame check.

Renders the fixed cameras listed in tests/stills.json and compares each one with its
reference picture in tests/stills/. A changed roof, a wrong palette or a missing
building shows up as a changed picture.

  python3 tools/stills.py            render, compare, write build/stills/report.html, exit 1 on a change
  python3 tools/stills.py --update   render and save the results as the new references
  python3 tools/stills.py --only town-home-noon

Needs: a Godot 4.6 binary (GODOT env var, or `godot` on PATH), numpy, Pillow.
With no display it runs itself under xvfb-run.
"""
import argparse, html, json, os, shutil, subprocess, sys
from pathlib import Path

import numpy as np
from PIL import Image

GAME = Path(__file__).resolve().parent.parent
REFS = GAME / "tests" / "stills"
OUT = GAME / "build" / "stills"
PIXEL_TOL = 24          # a pixel counts as changed when any channel moves by more than this (0..255)


def godot_cmd():
    exe = os.environ.get("GODOT") or shutil.which("godot") or shutil.which("godot4")
    if not exe:
        sys.exit("No Godot binary: set GODOT=/path/to/godot")
    cmd = [exe]
    if not os.environ.get("DISPLAY") and shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a", "-s", "-screen 0 1280x720x24"] + cmd
    return cmd


def render(cfg, shot, path):
    w, h = cfg["width"], cfg["height"]
    args = godot_cmd() + ["--path", str(GAME), "--rendering-driver", "opengl3", "--resolution", f"{w}x{h}",
                          "--fixed-fps", str(cfg["fps"]), "--disable-vsync", "--",
                          f"--shot={path}", f"--frames={shot.get('frames', cfg['frames'])}", f"--scene={shot.get('scene', 'town')}"]
    if "at" in shot: args.append("--at=%s,%s" % tuple(shot["at"]))
    for k in ("yaw", "pitch", "dist", "tod"):
        if k in shot: args.append(f"--{k}={shot[k]}")
    if path.exists(): path.unlink()
    r = subprocess.run(args, capture_output=True, text=True, timeout=900)
    log = r.stdout + r.stderr
    bad = [l for l in log.splitlines() if "SCRIPT ERROR" in l or "Parse Error" in l or "SHADER ERROR" in l]
    if bad or not path.exists():
        print(log[-3000:])
        sys.exit(f"{shot['name']}: render failed" + (": " + bad[0] if bad else " (no picture written)"))


def compare(a_path, b_path, diff_path):
    a = np.asarray(Image.open(a_path).convert("RGB")).astype(np.int16)
    b = np.asarray(Image.open(b_path).convert("RGB")).astype(np.int16)
    if a.shape != b.shape:
        return 1.0
    changed = (np.abs(a - b).max(axis=2) > PIXEL_TOL)
    # the reference, greyed out, with every changed pixel in red
    grey = (b.mean(axis=2, keepdims=True) * 0.5 + 60).repeat(3, axis=2)
    grey[changed] = (255, 30, 60)
    Image.fromarray(grey.astype(np.uint8)).save(diff_path)
    return float(changed.mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--update", action="store_true", help="save the renders as the new references")
    ap.add_argument("--only", help="one shot name")
    a = ap.parse_args()
    cfg = json.loads((GAME / "tests" / "stills.json").read_text())
    shots = [s for s in cfg["shots"] if not a.only or s["name"] == a.only]
    OUT.mkdir(parents=True, exist_ok=True); REFS.mkdir(parents=True, exist_ok=True)
    rows, failed = [], []
    for s in shots:
        name = s["name"]; got = OUT / f"{name}.png"; ref = REFS / f"{name}.png"
        render(cfg, s, got)
        if a.update:
            shutil.copy(got, ref); print(f"saved  {name}"); continue
        if not ref.exists():
            failed.append(name); rows.append((name, None, "no reference yet")); print(f"NEW    {name}  (no reference)"); continue
        frac = compare(got, ref, OUT / f"{name}.diff.png")
        limit = s.get("max_changed", cfg["max_changed"])
        ok = frac <= limit
        if not ok: failed.append(name)
        rows.append((name, frac, "same" if ok else "CHANGED"))
        print(f"{'ok    ' if ok else 'CHANGED'} {name}  {frac * 100:.2f}% of pixels changed (limit {limit * 100:.1f}%)")
    if a.update: return
    # report: reference, new render and difference side by side
    cells = []
    for name, frac, verdict in rows:
        col = "#c0392b" if verdict != "same" else "#2e7d4f"
        pct = "" if frac is None else f" &middot; {frac * 100:.2f}% changed"
        ref_rel = os.path.relpath(REFS / f"{name}.png", OUT)
        cells.append(f"<h2 style='color:{col}'>{html.escape(name)} &mdash; {verdict}{pct}</h2><div class=r>"
                     f"<figure><img src='{ref_rel}'><figcaption>reference</figcaption></figure>"
                     f"<figure><img src='{name}.png'><figcaption>this build</figcaption></figure>"
                     f"<figure><img src='{name}.diff.png'><figcaption>changed pixels in red</figcaption></figure></div>")
    (OUT / "report.html").write_text(
        "<meta charset=utf-8><title>Still-frame check</title><style>body{font:14px system-ui;background:#16181d;color:#ddd;margin:24px}"
        ".r{display:flex;gap:8px}figure{margin:0;flex:1}img{width:100%;image-rendering:pixelated}figcaption{opacity:.6;padding:4px 0 18px}</style>"
        f"<h1>Still-frame check: {len(rows) - len(failed)} of {len(rows)} the same</h1>" + "".join(cells))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write("### Still-frame check\n\n| shot | result | pixels changed |\n|---|---|---|\n")
            for name, frac, verdict in rows:
                f.write(f"| {name} | {verdict} | {'' if frac is None else f'{frac * 100:.2f}%'} |\n")
    if failed:
        print(f"\n{len(failed)} picture(s) changed: {', '.join(failed)}\nIf the change is wanted, run: python3 tools/stills.py --update  (or put [stills] in the commit message)")
        sys.exit(1)
    print("\nall stills match")


if __name__ == "__main__":
    main()
