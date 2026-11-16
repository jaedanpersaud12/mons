import type { Widget } from "./widgets";

export type LayerId = "1" | "2" | "3a" | "3b" | "4";

export type Quest = {
  id: string;
  title: string;
  layer: LayerId;
  xp: number;
  kind: "decision" | "sheet";
  prompt: string;
  file?: string;
  template?: string;
  status: "open" | "done";
  answer?: string;
  doneAt?: string;
  context?: string[];
  widget?: Widget;
  output?: string;
  bonusXp?: number;
};

export type QuestView = Quest & { fileExists: boolean; absPath?: string; started?: boolean };

export type Layer = {
  id: LayerId;
  name: string;
  blurb: string;
  needs: LayerId[];
};

export const LAYERS: Layer[] = [
  { id: "1", name: "Rules", blurb: "Theme, tone, the Current", needs: [] },
  { id: "2", name: "Skeleton", blurb: "Types, the chart, 12 islands", needs: ["1"] },
  { id: "3a", name: "Islands and cast", blurb: "Species, culture, keepers, characters", needs: ["2"] },
  { id: "3b", name: "Systems", blurb: "Battle, bond, catching, items", needs: ["2"] },
  { id: "4", name: "Content", blurb: "Roster, names, scripts, endings", needs: ["3a", "3b"] },
];

export const RANKS = [
  { xp: 0, title: "Villager" },
  { xp: 300, title: "Gate-walker" },
  { xp: 800, title: "Route-runner" },
  { xp: 1500, title: "Trial-taker" },
  { xp: 2500, title: "Stone-bearer" },
  { xp: 3600, title: "Keeper's friend" },
  { xp: 5500, title: "Anchor" },
  { xp: 7600, title: "Stormholder" },
];

export function layerStats(quests: Quest[], id: LayerId) {
  const list = quests.filter((q) => q.layer === id);
  const done = list.filter((q) => q.status === "done").length;
  return { total: list.length, done, complete: list.length > 0 && done === list.length };
}

export function isUnlocked(quests: Quest[], id: LayerId): boolean {
  const layer = LAYERS.find((l) => l.id === id)!;
  return layer.needs.every((n) => layerStats(quests, n).complete);
}

export function totalXp(quests: Quest[]) {
  return quests.filter((q) => q.status === "done").reduce((s, q) => s + q.xp + (q.bonusXp ?? 0), 0);
}

export function rankFor(xp: number) {
  let index = 0;
  RANKS.forEach((r, i) => {
    if (xp >= r.xp) index = i;
  });
  const current = RANKS[index];
  const next = RANKS[index + 1];
  return {
    index,
    title: current.title,
    level: index + 1,
    next,
    into: xp - current.xp,
    span: next ? next.xp - current.xp : 0,
  };
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function streak(quests: Quest[], now = new Date()) {
  const days = new Set(quests.filter((q) => q.doneAt).map((q) => dayKey(q.doneAt!)));
  let count = 0;
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor.toISOString()))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor.toISOString()))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function nextQuest(quests: Quest[]) {
  for (const layer of LAYERS) {
    if (!isUnlocked(quests, layer.id)) continue;
    const open = quests.find((q) => q.layer === layer.id && q.status === "open");
    if (open) return open;
  }
  return null;
}

export type Achievement = { id: string; name: string; how: string; earned: boolean };

export function achievements(quests: Quest[]): Achievement[] {
  const doneCount = (pred: (q: Quest) => boolean) =>
    quests.filter((q) => pred(q) && q.status === "done").length;
  const all = (pred: (q: Quest) => boolean) => {
    const list = quests.filter(pred);
    return list.length > 0 && list.every((q) => q.status === "done");
  };
  const islandSheets = (q: Quest) => q.id.startsWith("island-");
  return [
    { id: "gate", name: "The gate is open", how: "Complete your first quest", earned: doneCount(() => true) > 0 },
    { id: "rules", name: "Rules locked", how: "Finish the Rules layer", earned: layerStats(quests, "1").complete },
    { id: "map", name: "Map drawn", how: "Finish the Skeleton layer", earned: layerStats(quests, "2").complete },
    { id: "hopper", name: "Island hopper", how: "Finish 4 island sheets", earned: doneCount(islandSheets) >= 4 },
    { id: "chain", name: "Chain walker", how: "Finish all 12 island sheets", earned: all(islandSheets) },
    { id: "cast", name: "Full cast", how: "Finish every character sheet", earned: all((q) => q.id.startsWith("char-")) },
    { id: "systems", name: "Systems online", how: "Finish the Systems layer", earned: layerStats(quests, "3b").complete },
    { id: "roll", name: "On a roll", how: "Lock a decision 3 days in a row", earned: streak(quests) >= 3 },
    { id: "storm", name: "Stormholder", how: "Finish the whole bible", earned: quests.every((q) => q.status === "done") },
  ];
}

export type Verdict = "keep" | "change" | "question" | "note";
export type QuestNote = {
  key: string;
  ref: string;
  section: string;
  item: string;
  verdict: Verdict;
  text: string;
  updatedAt: string;
};
export type QuestNotes = { overall: string; notes: QuestNote[]; data?: unknown };

export const VERDICTS: { id: Verdict; label: string; tone: string }[] = [
  { id: "keep", label: "Keep", tone: "emerald" },
  { id: "change", label: "Change", tone: "amber" },
  { id: "question", label: "Question", tone: "sky" },
  { id: "note", label: "Note", tone: "stone" },
];

export function composeAnswer(overall: string, notes: QuestNote[]) {
  const count = (v: Verdict) => notes.filter((n) => n.verdict === v).length;
  const tally = (["keep", "change", "question", "note"] as Verdict[])
    .map((v) => [v, count(v)] as const)
    .filter(([, c]) => c > 0)
    .map(([v, c]) => `${c} ${VERDICTS.find((x) => x.id === v)!.label.toLowerCase()}`)
    .join(", ");
  const head = overall.trim() || (notes.length ? `Reviewed ${notes.length} item${notes.length === 1 ? "" : "s"}: ${tally}.` : "");
  const lines = notes.map((n) => {
    const label = VERDICTS.find((x) => x.id === n.verdict)!.label;
    const item = n.item.length > 90 ? n.item.slice(0, 87).trimEnd() + "…" : n.item;
    return `- ${n.section ? `${n.section} › ` : ""}*${item}*: **${label}**${n.text.trim() ? `. ${n.text.trim().replace(/\s*\n\s*/g, " ")}` : ""}`;
  });
  return [head, ...lines].filter(Boolean).join("\n");
}
