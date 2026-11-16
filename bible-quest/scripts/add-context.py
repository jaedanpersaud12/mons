import json, sys
p = sys.argv[1]
d = json.load(open(p))
S = "11-story.md"
C = {
 "confirm-defaults": [S+"?match=Default"],
 "types": [S+"#What the rule explains", "03-world-and-maps.md#Biomes", "05-starters.md#Type notes", "01-game-bible.md#7. Battles and catching"],
 "type-chart": [S+"#What the rule explains", "05-starters.md#Type notes", "01-game-bible.md#6. Starters"],
 "region": ["01-game-bible.md#4. World", "03-world-and-maps.md#Region theme", "03-world-and-maps.md#The coastal town"],
 "island-skeleton": [S+"#10. Structure", S+"#9. The twelve awakening species", "03-world-and-maps.md#Biomes"],
 "starter-homes": [S+"#Home chapters", "05-starters.md#Fire: the bull line", "05-starters.md#Water: the wader line", "05-starters.md#Plant: the bat line"],
 "lost-element": [S+"#About 100 years ago", S+"#Now", S+"#Act 4"],
 "fire-second-type": ["05-starters.md#Fire: the bull line", "05-starters.md#Type notes"],
 "island-home": ["03-world-and-maps.md#The coastal town", S+"#Act 1", "06-hero-and-cutscenes.md#The intro"],
 "island-midpoint": [S+"#Act 2", S+"#8. The starters"],
 "island-reveal": [S+"#Act 3"],
 "island-ruined": [S+"#5. History", S+"#Act 4"],
 "people-and-mons": [S+"#What the rule explains", S+"#After the disaster", S+"#Tone rules"],
 "char-hero": ["01-game-bible.md#8. Player character", "06-hero-and-cutscenes.md#The hero", S+"#Act 1"],
 "char-mum": [S+"#6. Cast", "06-hero-and-cutscenes.md#The intro"],
 "char-warden": [S+"#6. Cast", S+"#8. The starters"],
 "char-rival": [S+"#7. The rival", S+"#8. The starters"],
 "char-heir": [S+"#2. Theme", S+"#5. History", S+"#Act 4"],
 "char-comic-duo": [S+"#6. Cast", S+"#Tone rules"],
 "char-elders": [S+"#After the disaster", S+"#Act 1"],
 "mum-secret": [S+"#6. Cast", "06-hero-and-cutscenes.md#The intro"],
 "sys-battle": ["01-game-bible.md#7. Battles and catching", S+"#11. Ideas taken from Clair Obscur"],
 "sys-bond": [S+"#Awakening rules in play", "04-creature-framework.md#Reacting to the player"],
 "sys-awakening": [S+"#Awakening (Decided", S+"#Awakening rules in play", S+"#Who can awaken"],
 "sys-catching": ["01-game-bible.md#7. Battles and catching", "01-game-bible.md#5. Creatures"],
 "sys-growth": [S+"#What the rule explains", "05-starters.md#Design rules"],
 "sys-trials": [S+"#Rules", S+"#What the player needs"],
 "sys-items": ["01-game-bible.md#7. Battles and catching", S+"#Awakening rules in play"],
 "sys-wild": ["04-creature-framework.md#Behaviour", "04-creature-framework.md#Reacting to the player", "01-game-bible.md#5. Creatures"],
 "sys-camp": [S+"#11. Ideas taken from Clair Obscur", S+"#Tone rules"],
 "sys-daynight": ["03-world-and-maps.md#Sky, ocean, day and night", "04-creature-framework.md#Habitat, time, weather"],
 "sys-boat": [S+"#10. Structure"],
 "roster": ["01-game-bible.md#5. Creatures", "05-starters.md#Design rules", "04-creature-framework.md#The species sheet"],
 "awakening-designs": [S+"#9. The twelve awakening species", "05-starters.md#Design rules"],
 "names": [S+"#13. Open questions"],
 "terms": [S+"#13. Open questions", S+"#The Current", S+"#The Long Storm"],
 "stolen-fate": [S+"#8. The starters", S+"#Act 2"],
 "heir-ending": [S+"#2. Theme", S+"#Act 4"],
 "surge-clock": [S+"#The Long Storm"],
 "raid-layer": [S+"#Later"],
 "act1-script": ["06-hero-and-cutscenes.md#The intro", S+"#Act 1"],
 "postgame": [S+"#Room to grow", S+"#Post-game"],
}
for q in d["quests"]:
    if q["id"] in C:
        q["context"] = C[q["id"]]
    elif q["id"].startswith("island-tier"):
        q["context"] = [S+"#Rules", S+"#9. The twelve awakening species", S+"#Tone rules"]
json.dump(d, open(p, "w"), indent=2)
print(sum(1 for q in d["quests"] if q.get("context")), "quests with context")
