"""Moves the saved type picks to main/secondary. Safe to re-run."""
import json, sys
docs = sys.argv[1]
p = f"{docs}/notes.json"
n = json.load(open(p))
entry = n.setdefault("types", {"overall": "", "notes": []})
d = entry.get("data") or {}
types = d.get("types", [])
sec = d.get("secondary", [])
origins = d.get("origins", {})
# Jaedan's examples: deep water mons are Water/Dark, mountain flyers are Lightning/Flying.
for x, frm in [("Dark", "Deep water, caves, night"), ("Flying", "Cliffs, peaks, open sky")]:
    if x not in types: types.append(x)
    if x not in sec: sec.append(x)
    origins.setdefault(x, frm)
if "Rock" not in types: types.insert(types.index("Ground") + 1 if "Ground" in types else len(types), "Rock")
d.update(types=types, secondary=sec, origins=origins, sources=[s for s in d.get("sources", []) if s not in sec])
entry["data"] = d
json.dump(n, open(p, "w"), indent=2)
q = json.load(open(f"{docs}/quests.json"))
for x in q["quests"]:
    if x["id"] == "types" and x["status"] == "open":
        x["prompt"] = "Split the types in two. Main types are real-world elements a mon absorbs. Secondary types come from where it lives inside its biome. Then mark the 12 mains that get an island."
    if x["id"] == "fire-second-type" and x.get("widget") and x["status"] == "open":
        f = x["widget"]["fields"][0]
        f["label"] = "The fire bull line's second type"
        f["hint"] = "The volcano is where fire meets stone, so a second main type fits. A secondary would say how it lives there instead."
        f["options"] = [
            {"label": "Rock", "hint": "Second main: fire meets stone. You've been calling them fire rock bulls"},
            {"label": "Ground", "hint": "Second main: the original plan"},
            {"label": "Beast", "hint": "Secondary: big herd animal"},
            {"label": "Armored", "hint": "Secondary: the lava bull's rock plates"},
            {"label": "Stays pure Fire"},
        ]
json.dump(q, open(f"{docs}/quests.json", "w"), indent=2)
print("types:", d["types"]); print("secondary:", d["secondary"])
