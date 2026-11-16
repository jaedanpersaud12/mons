#!/usr/bin/env python3
"""Splat budget gate.

Every baked scene has a ceiling on how many splats it may hold (tests/budget.json).
Going over fails the build, so an island cannot quietly grow until it runs badly.

  python3 tools/budget.py
"""
import json, os, sys
from pathlib import Path

GAME = Path(__file__).resolve().parent.parent


def main():
    budget = json.loads((GAME / "tests" / "budget.json").read_text())
    rows, over = [], False
    for scene, limit in budget["scenes"].items():
        meta = json.loads((GAME / "data" / f"{scene}.json").read_text())
        n = int(meta["n"])
        on_disk = (GAME / "data" / f"{scene}_pos.bin").stat().st_size // 12
        if on_disk != n:
            sys.exit(f"{scene}: {scene}.json says {n} splats but {scene}_pos.bin holds {on_disk}. Re-run the bake.")
        bad = n > limit; over |= bad
        rows.append((scene, n, limit, bad))
        print(f"{'OVER ' if bad else 'ok   '} {scene:8s} {n / 1e6:5.2f}M of {limit / 1e6:.2f}M  ({n * 100 // limit}%)")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write("### Splat budget\n\n| scene | splats | budget | used |\n|---|---|---|---|\n")
            for scene, n, limit, bad in rows:
                f.write(f"| {scene} | {n / 1e6:.2f}M | {limit / 1e6:.2f}M | {n * 100 // limit}%{' OVER' if bad else ''} |\n")
    if over:
        sys.exit("Over budget. Thin the scene or raise the limit in tests/budget.json on purpose.")


if __name__ == "__main__":
    main()
