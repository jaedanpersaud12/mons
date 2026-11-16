// Each quest can have its own tool (a "widget") instead of a blank text box.
// The widget's structured answer is the source; markdown docs are generated from it.
import type { Quest, QuestNote } from "./game";

export type Option = { label: string; hint?: string };

export type Field =
  | {
      id: string;
      label: string;
      hint?: string;
      type: "choice" | "multi";
      options?: Option[];
      optionsFrom?: "types";
      allowCustom?: boolean;
      optional?: boolean;
      min?: number;
    }
  | { id: string; label: string; hint?: string; type: "text"; lines?: number; placeholder?: string; optional?: boolean }
  | {
      id: string;
      label: string;
      hint?: string;
      type: "assign";
      rows: Option[];
      options: Option[];
      unique?: boolean;
      optional?: boolean;
    };

export type Widget =
  | { type: "fields"; fields: Field[] }
  | { type: "types" }
  | { type: "chart" }
  | { type: "islands" }
  | { type: "review" };

export type Objective = { id: string; label: string; done: boolean; bonus?: boolean; detail?: string };

export const BONUS_XP = 25;

// Main types: real-world elements that pool at a source. Every mon has exactly one.
export const MAIN_PRESETS = [
  "Fire", "Water", "Plant", "Ground", "Rock", "Air", "Ice", "Lightning", "Metal", "Poison", "Light", "Sand", "Mist",
];
// Secondary types: where and how a mon lives inside its biome. Optional second slot.
export const SECONDARY_PRESETS: { label: string; from: string }[] = [
  { label: "Dark", from: "Deep water, caves, night" },
  { label: "Flying", from: "Cliffs, peaks, open sky" },
  { label: "Fighting", from: "Contested ground, rivals, duels" },
  { label: "Spirit", from: "Old places, ruins, the wound" },
  { label: "Bug", from: "Swarms, undergrowth, rot" },
  { label: "Beast", from: "Big predators and herds" },
  { label: "Mind", from: "Ancient, solitary, long-lived" },
  { label: "Sound", from: "Echoing caves and reefs" },
  { label: "Armored", from: "High pressure, rockfalls, predators" },
];
export const TYPE_PRESETS = [...MAIN_PRESETS, ...SECONDARY_PRESETS.map((x) => x.label)];

export const STONE_RELATIONS = ["Faith", "Economy", "Law", "Folk", "Secret", "Contested"];
export const MONS_RELATIONS = ["Partners", "Revered", "Resource", "Feared", "Rivals"];

/** `noStone`: no source and no stone, so the slot takes no element and no stone relationship. */
export type IslandSlot = { id: string; label: string; group: string; fixed?: boolean; noStone?: boolean };
export const ISLAND_SLOTS: IslandSlot[] = [
  { id: "home", label: "Home", group: "Home", fixed: true, noStone: true },
  { id: "tier1-a", label: "Island A", group: "Tier 1" },
  { id: "tier1-b", label: "Island B", group: "Tier 1" },
  { id: "tier1-c", label: "Island C", group: "Tier 1" },
  { id: "midpoint", label: "Midpoint", group: "Midpoint", fixed: true },
  { id: "tier2-a", label: "Island A", group: "Tier 2" },
  { id: "tier2-b", label: "Island B", group: "Tier 2" },
  { id: "tier2-c", label: "Island C", group: "Tier 2" },
  { id: "reveal", label: "Reveal", group: "Reveal", fixed: true },
  { id: "tier3-a", label: "Island A", group: "Tier 3" },
  { id: "tier3-b", label: "Island B", group: "Tier 3" },
  { id: "tier3-c", label: "Island C", group: "Tier 3" },
  { id: "ruined", label: "The ruined island", group: "Ruined", fixed: true },
];

export type TypesData = {
  types: string[];
  sources: string[];
  secondary: string[];
  origins: Record<string, string>;
};
export type Cell = "strong" | "weak" | "none" | "absorb";
export type ChartData = { cells: Record<string, Cell> };
/** `island` is the landmass the slot sits on. Several sources can share one island. */
export type Island = { element?: string; island?: string; biome?: string; inspiration?: string; stone?: string; mons?: string };
export type IslandsData = { islands: Record<string, Island> };
export type FieldsData = Record<string, string | string[] | Record<string, string>>;

export type Ctx = {
  types: TypesData;
  notes: QuestNote[];
  overall: string;
  heads: { ref: string; section: string }[];
  sheetExists: boolean;
  sheetWords: number;
};

const asTypes = (d: unknown): TypesData => {
  const t = (d ?? {}) as Partial<TypesData>;
  return { types: t.types ?? [], sources: t.sources ?? [], secondary: t.secondary ?? [], origins: t.origins ?? {} };
};
export const mainsOf = (t: TypesData) => t.types.filter((x) => !t.secondary.includes(x));
export const secondariesOf = (t: TypesData) => t.types.filter((x) => t.secondary.includes(x));
/** Mains first, then secondaries. */
export const orderedTypes = (t: TypesData) => [...mainsOf(t), ...secondariesOf(t)];
const asChart = (d: unknown): ChartData => ({ cells: ((d ?? {}) as Partial<ChartData>).cells ?? {} });
const asIslands = (d: unknown): IslandsData => ({ islands: ((d ?? {}) as Partial<IslandsData>).islands ?? {} });
export { asTypes, asChart, asIslands };
/** The starters' elements. Their home islands are the three tier 1 islands. */
export const STARTER_ELEMENTS = ["Water", "Plant", "Fire"];
/** A slot's relationships are filled in: mons for every island, stone only where there is one. */
export const islandRelDone = (s: IslandSlot, i: Island) => !!i.mons && (s.noStone || !!i.stone);
export const islandDone = (s: IslandSlot, i: Island) => !!i.biome?.trim() && islandRelDone(s, i) && (s.noStone || !!i.element);

function fieldDone(f: Field, v: FieldsData[string] | undefined) {
  if (f.type === "text" || f.type === "choice") return typeof v === "string" && v.trim().length > 0;
  if (f.type === "multi") return Array.isArray(v) && v.length >= (f.min ?? 1);
  if (f.type !== "assign") return false;
  const map = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, string>;
  const all = f.rows.every((r) => map[r.label]);
  const vals = f.rows.map((r) => map[r.label]).filter(Boolean);
  return all && (!f.unique || new Set(vals).size === vals.length);
}

export function objectivesFor(quest: Quest, data: unknown, ctx: Ctx): Objective[] {
  const w = quest.widget;
  if (quest.kind === "sheet" && !w) {
    return [
      { id: "exists", label: "Create the sheet", done: ctx.sheetExists },
      { id: "words", label: "Write at least 200 words", done: ctx.sheetWords >= 200, bonus: true, detail: `${ctx.sheetWords}` },
    ];
  }
  if (!w) {
    return [{ id: "answer", label: "Note the reading or write an overall answer", done: ctx.notes.length > 0 || !!ctx.overall.trim() }];
  }
  if (w.type === "review") {
    const covered = ctx.heads.filter((h) => ctx.notes.some((n) => n.ref === h.ref && n.section === h.section)).length;
    return [
      { id: "one", label: "Leave at least one note", done: ctx.notes.length > 0 || !!ctx.overall.trim() },
      {
        id: "all",
        label: "Note something in every section",
        done: ctx.heads.length > 0 && covered === ctx.heads.length,
        bonus: true,
        detail: `${covered}/${ctx.heads.length}`,
      },
    ];
  }
  if (w.type === "fields") {
    const d = (data ?? {}) as FieldsData;
    return w.fields.map((f) => ({ id: f.id, label: f.label, done: fieldDone(f, d[f.id]), bonus: f.optional }));
  }
  if (w.type === "types") {
    const t = asTypes(data);
    const mains = mainsOf(t);
    const secs = secondariesOf(t);
    const live = t.sources.filter((x) => mains.includes(x));
    const explained = secs.filter((x) => t.origins[x]?.trim()).length;
    return [
      { id: "mains", label: "At least 12 main types", done: mains.length >= 12, detail: `${mains.length}` },
      { id: "starters", label: "Fire, Water and Plant are main types", done: ["Fire", "Water", "Plant"].every((x) => mains.includes(x)) },
      { id: "sources", label: "Mark exactly 12 mains as island elements", done: live.length === 12, detail: `${live.length}/12` },
      { id: "secs", label: "At least 4 secondary types", done: secs.length >= 4, detail: `${secs.length}` },
      { id: "origins", label: "Every secondary says where it comes from", done: secs.length > 0 && explained === secs.length, detail: `${explained}/${secs.length}` },
      { id: "own", label: "Invent a type of your own", done: t.types.some((x) => !TYPE_PRESETS.includes(x)), bonus: true },
    ];
  }
  if (w.type === "chart") {
    const types = orderedTypes(ctx.types);
    const { cells } = asChart(data);
    const strongVs = (a: string) => types.filter((d) => cells[`${a}>${d}`] === "strong");
    const weakTo = (d: string) => types.filter((a) => cells[`${a}>${d}`] === "strong");
    const hits = types.filter((t) => strongVs(t).length > 0).length;
    const weak = types.filter((t) => weakTo(t).length > 0).length;
    const tri = ["Fire>Plant", "Plant>Water", "Water>Fire"].every((k) => cells[k] === "strong");
    return [
      { id: "types", label: "Type list is picked", done: types.length >= 2 },
      { id: "hits", label: "Every type hits something hard", done: types.length > 0 && hits === types.length, detail: `${hits}/${types.length}` },
      { id: "weak", label: "Every type has a weakness", done: types.length > 0 && weak === types.length, detail: `${weak}/${types.length}` },
      { id: "tri", label: "Starter triangle: Fire › Plant › Water › Fire", done: tri },
      {
        id: "fair",
        label: "No type has more than 4 weaknesses",
        done: types.length > 0 && weak === types.length && types.every((t) => weakTo(t).length <= 4),
        bonus: true,
      },
    ];
  }
  // islands
  const { islands } = asIslands(data);
  const all = ISLAND_SLOTS.map((s) => ({ s, i: islands[s.id] ?? {} }));
  const sources = all.filter((x) => !x.s.noStone);
  const total = all.length;
  const els = sources.map((x) => x.i.element).filter(Boolean) as string[];
  const biomes = all.filter((x) => !!x.i.biome?.trim()).length;
  const rels = all.filter((x) => islandRelDone(x.s, x.i)).length;
  const insp = all.filter((x) => !!x.i.inspiration?.trim()).length;
  const placed = sources.filter((x) => !!x.i.island?.trim()).length;
  const lands = new Set(sources.map((x) => x.i.island?.trim().toLowerCase()).filter(Boolean)).size;
  const tier1 = sources.filter((x) => x.s.group === "Tier 1").map((x) => x.i.element);
  return [
    { id: "el", label: "Every source island has an element", done: els.length === sources.length, detail: `${els.length}/${sources.length}` },
    { id: "uniq", label: "No element used twice", done: els.length > 0 && new Set(els).size === els.length },
    { id: "tier1", label: "Tier 1 is Water, Plant and Fire", done: STARTER_ELEMENTS.every((e) => tier1.includes(e)) },
    { id: "land", label: "Every source is placed on an island", done: placed === sources.length, detail: `${placed}/${sources.length} on ${lands} islands` },
    { id: "biome", label: "Every stop has a biome", done: biomes === total, detail: `${biomes}/${total}` },
    { id: "rel", label: "Every island has its stone and mons relationship", done: rels === total, detail: `${rels}/${total}` },
    { id: "variety", label: "At least 4 different stone relationships", done: new Set(sources.map((x) => x.i.stone).filter(Boolean)).size >= 4, bonus: true },
    { id: "insp", label: "Every island has an inspiration", done: insp === total, bonus: true },
  ];
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** One-paragraph or bulleted answer for the decision log. */
export function widgetAnswer(quest: Quest, data: unknown, ctx: Ctx): string {
  const w = quest.widget;
  if (!w || w.type === "review") return "";
  if (w.type === "fields") {
    const d = (data ?? {}) as FieldsData;
    return w.fields
      .map((f) => {
        const v = d[f.id];
        if (v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length)) return "";
        const text = typeof v === "string" ? v.trim().replace(/\s*\n\s*/g, " ") : Array.isArray(v) ? v.join("; ") : Object.entries(v).map(([k, x]) => `${k} → ${x}`).join("; ");
        return `- **${f.label}** ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  if (w.type === "types") {
    const t = asTypes(data);
    const mains = mainsOf(t);
    return [
      `${mains.length} main types, ${secondariesOf(t).length} secondary.`,
      `- Main: ${mains.join(", ")}`,
      `- Island elements: ${t.sources.filter((x) => mains.includes(x)).join(", ")}`,
      `- Secondary: ${secondariesOf(t).map((x) => `${x} (${t.origins[x] || "?"})`).join("; ")}`,
      `- Written to \`${quest.output}\``,
    ].join("\n");
  }
  if (w.type === "chart") {
    const n = Object.values(asChart(data).cells).filter(Boolean).length;
    return `Type chart set for ${orderedTypes(ctx.types).length} types (${n} matchups). Written to \`${quest.output}\`.`;
  }
  const { islands } = asIslands(data);
  return (
    `${ISLAND_SLOTS.length} islands sketched. Written to \`${quest.output}\`.\n` +
    ISLAND_SLOTS.map((s) => {
      const i = islands[s.id] ?? {};
      const name = s.group === s.label || s.fixed ? s.label : `${s.group}, ${s.label}`;
      if (s.noStone) return `- ${name}: no stone, ${i.biome ?? "?"} (mons: ${i.mons ?? "?"})`;
      return `- ${name}: ${i.element ?? "?"}${i.island?.trim() ? ` on ${i.island.trim()}` : ""}, ${i.biome ?? "?"} (stone: ${i.stone ?? "?"}; mons: ${i.mons ?? "?"})`;
    }).join("\n")
  );
}

/** The generated markdown doc, for widgets that produce one. */
export function widgetOutput(quest: Quest, data: unknown, ctx: Ctx): string | null {
  const w = quest.widget;
  if (!w || !quest.output) return null;
  const head = (title: string) => `# ${title}\n\nStatus: Decided. Generated by Bible Quest on ${today()}. Edit it in the quest, not here, or your changes will be overwritten when the quest is locked again.\n\n`;
  if (w.type === "types") {
    const t = asTypes(data);
    const mains = mainsOf(t);
    const secs = secondariesOf(t);
    return (
      head("Types") +
      "## How types work\n\n" +
      "- **Main types** are real-world elements that pool at a source. Every mon has exactly one: the element it absorbs.\n" +
      "- **Secondary types** come from where and how a mon lives inside its biome: depth, altitude, night, caves, behaviour. They are optional.\n" +
      "- A mon that lives where two elements meet (a volcano, where fire meets stone) can take a second main type in the secondary slot instead.\n" +
      "- Examples: a deep-water mon is **Water / Dark**. A flyer from the storm peaks is **Lightning / Flying**.\n\n" +
      `## Main types (${mains.length})\n\n| Type | Island element |\n|---|---|\n` +
      mains.map((x) => `| ${x} | ${t.sources.includes(x) ? "Yes" : ""} |`).join("\n") +
      `\n\n## Secondary types (${secs.length})\n\n| Type | Comes from |\n|---|---|\n` +
      secs.map((x) => `| ${x} | ${t.origins[x] ?? ""} |`).join("\n") +
      "\n"
    );
  }
  if (w.type === "chart") {
    const types = orderedTypes(ctx.types);
    const { cells } = asChart(data);
    const sym = { strong: "2×", weak: "½×", none: "0", absorb: "heals" } as const;
    return (
      head("Type chart") +
      "Rows attack, columns defend. Blank means normal damage. Heals means the target absorbs the hit and recovers a little.\n\n" +
      `| Attacker | ${types.join(" | ")} |\n|---|${types.map(() => "---").join("|")}|\n` +
      types.map((a) => `| **${a}** | ${types.map((d) => (cells[`${a}>${d}`] ? sym[cells[`${a}>${d}`]] : "")).join(" | ")} |`).join("\n") +
      "\n\n## Strengths and weaknesses\n\n" +
      types
        .map((t) => {
          const s = types.filter((d) => cells[`${t}>${d}`] === "strong");
          const wk = types.filter((a) => cells[`${a}>${t}`] === "strong");
          return `- **${t}**: strong against ${s.join(", ") || "nothing"}; weak to ${wk.join(", ") || "nothing"}`;
        })
        .join("\n") +
      "\n"
    );
  }
  if (w.type === "islands") {
    const { islands } = asIslands(data);
    return (
      head("Islands: the skeleton") +
      "| Slot | Element | Island | Biome | Inspiration | Stone | Mons |\n|---|---|---|---|---|---|---|\n" +
      ISLAND_SLOTS.map((s) => {
        const i = islands[s.id] ?? {};
        const slot = s.fixed ? s.label : `${s.group}, ${s.label}`;
        if (s.noStone) return `| ${slot} | No stone | ${i.island ?? "Home"} | ${i.biome ?? ""} | ${i.inspiration ?? ""} | None | ${i.mons ?? ""} |`;
        return `| ${slot} | ${i.element ?? ""} | ${i.island ?? ""} | ${i.biome ?? ""} | ${i.inspiration ?? ""} | ${i.stone ?? ""} | ${i.mons ?? ""} |`;
      }).join("\n") +
      "\n\nSlots are sources, not islands: several sources can share one island, and each boat upgrade opens a new part of an island you have already visited." +
      "\n\nHome has no source and no stone. Tier 1 holds the starters' home islands: Water, Plant and Fire, in any order." +
      "\n\nStone and mons relationships are defined in `world/cultures-and-ecology.md`.\n"
    );
  }
  return null;
}
