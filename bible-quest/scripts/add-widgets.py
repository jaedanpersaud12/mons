"""Gives quests their own tools. Safe to re-run: never touches status, answers or XP earned."""
import json, sys
p = sys.argv[1]
d = json.load(open(p))

def o(label, hint=None):
    return {"label": label, **({"hint": hint} if hint else {})}
def choice(id, label, options, hint=None, custom=True, optional=False, multi=False, frm=None):
    f = {"id": id, "label": label, "type": "multi" if multi else "choice", "allowCustom": custom}
    if frm: f["optionsFrom"] = frm
    else: f["options"] = [x if isinstance(x, dict) else o(x) for x in options]
    if hint: f["hint"] = hint
    if optional: f["optional"] = True
    return f
def text(id, label, hint=None, lines=3, optional=False, placeholder=None):
    f = {"id": id, "label": label, "type": "text", "lines": lines}
    if hint: f["hint"] = hint
    if optional: f["optional"] = True
    if placeholder: f["placeholder"] = placeholder
    return f
def fields(*fs): return {"type": "fields", "fields": list(fs)}

TIERS = [o("Tier 1", "First islands"), o("Tier 2", "Mid-game"), o("Tier 3", "Late game")]
W = {
 "confirm-defaults": {"type": "review"},
 "culture-framework": {"type": "review"},
 "types": {"type": "types"},
 "type-chart": {"type": "chart"},
 "island-skeleton": {"type": "islands"},
 "region": fields(
   choice("layout", "How close are the islands?", [o("Close", "You can see the next island from the shore"), o("Spread out", "Open sea between every island"), o("Clusters", "Tight groups with long crossings between them")], custom=False),
   choice("inspiration", "What feeds the look, beyond a light Caribbean touch?", ["Caribbean", "Polynesia and the Pacific", "Southeast Asian archipelagos", "Mediterranean islands", "Galápagos"], multi=True),
   choice("sea", "What is the sea like?", [o("Calm and turquoise", "Sailing is a rest between islands"), o("Gets rougher by tier", "The sea itself is the difficulty curve"), o("Dangerous everywhere", "The sea is a place you survive")], custom=False),
   text("extra", "Anything else that defines the region", optional=True)),
 "starter-homes": fields(
   {"id": "homes", "label": "Where does each starter line live?", "type": "assign", "unique": True,
    "hint": "Each starter's home island is where it chooses you. Different tiers means each starter pays off at a different point.",
    "rows": [o("Water wader", "Coast, shallows"), o("Plant bat", "Forest"), o("Fire bull", "Volcanic mountains")], "options": TIERS},
   text("why", "Why this order?", optional=True, lines=2)),
 "lost-element": fields(
   choice("element", "Which element ran wild a century ago?", [], frm="types", hint="It decides what the wound looks like and what the lost species is."),
   text("symptoms", "What does the wound look like on other islands because of it?", lines=2, placeholder="Ash drifting, reefs bleaching…"),
   text("species", "First idea for the lost species", optional=True, lines=2)),
 "fire-second-type": fields(
   choice("type", "The fire bull line's second type", [o("Ground", "The original plan"), o("Rock", "You've been calling them fire rock bulls"), o("Stays pure Fire")]),
   choice("when", "When does it gain it?", ["At stage 2", "Only the final stage"], custom=False)),
 "true-antagonist": fields(
   choice("who", "Who is really behind the storm?", [
     o("Someone inside the heir's crew", "His adviser or backer, who taught him the forced method knowing it feeds the storm"),
     o("A disaster profiteer", "Outside money. Wants the islands wrecked so they can buy and rebuild them"),
     o("A power seeker", "Wants the ban broken for good so the strongest rule"),
     o("Someone at home", "An elder or keeper who has known all along")]),
   choice("why", "Why do they want it?", [o("Profit", "Own what's left"), o("Power", "Raw Current makes forced forms far stronger"), o("Belief", "They think the islands deserve it, or that the surge is natural and right"), o("Revenge", "An old grudge against the keepers or an island")], multi=True),
   choice("history", "Were they, or people like them, behind the first disaster too?", [o("Yes", "The same hand pushed the ancestor"), o("No", "This is new"), o("Leave it a mystery")], custom=False),
   choice("kind", "What kind of villain?", [o("Has reasons", "You understand them, even if you hate it"), o("Just a jerk", "Tone rule 5: sometimes there are just jerks")], custom=False),
   text("idea", "Any first image of them?", optional=True, lines=2)),
 "heir-switch": fields(
   choice("when", "When does the heir come over?", [o("At the Reveal island", "The natural spot: 'he is right' becomes 'he is being used'"), o("Earlier, at the Midpoint", "Right after the forced starter fight"), o("Late, on the ruined island", "He turns at the last moment")]),
   choice("how", "What turns him?", ["He learns he's been used", "He sees what forcing did to the stolen starter", "You beat him and spare him", "His own crew turns on him"], multi=True),
   choice("cost", "What does it cost him?", ["His crew splits", "The creature he forced is lost or won't trust him", "He can never awaken a creature himself", "His family's name stays cursed", "Nothing yet: he pays at the end"], multi=True),
   text("first", "What's the first thing he does on your side?", optional=True, lines=2)),
 "rival-arc": fields(
   choice("tempted", "Who tempts the rival, if anyone?", [o("The true antagonist", "After the heir switches, the shortcut comes from them"), o("The heir, before he switches", "The original plan"), o("Nobody", "They stay loyal and struggle in another way")]),
   choice("return", "What brings them back?", ["Their starter refuses to be forced", "They see what forcing does", "You talk them down", "They never leave"]),
   choice("drive", "What keeps them going after their starter is home?", ["Getting the stolen rescue back", "Guilt over the theft", "Proving themselves to the warden", "Not wanting you to do it alone"], multi=True),
   text("extra", "Anything else about them", optional=True, lines=2)),
 "mum-secret": fields(
   choice("knows", "How much does Mum know?", ["Everything", "A little, and she's scared of it", "Nothing"], custom=False),
   choice("dad", "Where is Dad?", [o("A keeper who left", "Ties to the old secret"), o("Lost at sea"), o("Just away", "Not part of the story")]),
   text("scene", "The moment you'd find out", optional=True, lines=2)),
 "stolen-fate": fields(
   choice("fate", "What happens to the stolen starter?", [o("Joins you"), o("Goes home"), o("Stays with the heir", "And becomes his properly bonded partner after the switch")]),
   text("scene", "The scene where it's settled", optional=True, lines=2)),
 "heir-ending": fields(
   choice("end", "How does his story end after the finale?", ["Becomes a keeper", "Leaves the islands", "Stays to rebuild the ruined island", "Doesn't survive it"]),
   text("line", "His last line or image", optional=True, lines=2)),
 "surge-clock": fields(
   choice("clock", "Does the player see the surge coming?", [o("Story clock", "It arrives when the plot says"), o("Visible signs", "Weather and the wound get worse as you earn stones"), o("A real countdown", "Days pass and it matters")], custom=False)),
 "raid-layer": fields(
   choice("raid", "Islands you put off get raided first?", [o("Later", "After the base game works"), o("Never"), o("Now", "Build it into the island sheets")], custom=False)),
 "names": fields(*[text(i, l, lines=1, optional=opt) for i, l, opt in [
   ("game", "The game", False), ("region", "The region", False), ("town", "The home town", False), ("hero", "The hero", False),
   ("rival", "The rival", False), ("warden", "The warden", False), ("heir", "The heir", False), ("ancestor", "The ancestor", True), ("villain", "The true antagonist", True)]]),
 "terms": fields(*[text(i, l, lines=1, placeholder=ph) for i, l, ph in [
   ("current", "The Current", "Keep, or your name for the energy"), ("awakening", "Awakening", "Your name for the mega forms"),
   ("storm", "The Long Storm", "The once-a-century surge"), ("wound", "The wound", "The tear on the ruined island"), ("keepers", "Keepers", "The people who guard the stones")]]),
}
OUT = {"types": "world/types.md", "type-chart": "world/type-chart.md", "island-skeleton": "world/islands-skeleton.md"}
for q in d["quests"]:
    if q["id"] in W:
        q["widget"] = W[q["id"]]
        if q["id"] in OUT:
            q["output"] = OUT[q["id"]]; q["kind"] = "decision"; q.pop("file", None); q.pop("template", None)
PROMPTS = {
 "types": "Build the type list. Pick from the pool or invent your own, then mark the 12 that get an island.",
 "type-chart": "Set who beats whom. Rows attack, columns defend. The chart builds itself from your type list.",
 "island-skeleton": "Fill the board: home plus 12 source islands. Home has no stone, so it takes no element. Tier 1 is Water, Plant and Fire, the starters' homes. Every other island gets an element, a biome, and how it treats its stone and its mons.",
 "true-antagonist": "Who is really behind the storm, and why?",
}
for q in d["quests"]:
    if q["id"] in PROMPTS and q["status"] == "open": q["prompt"] = PROMPTS[q["id"]]
json.dump(d, open(p, "w"), indent=2)
print(sum(1 for q in d["quests"] if q.get("widget")), "quests with their own tool")
