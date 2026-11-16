"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ProgressBar } from "@/components/interior/progress-bar";
import { SegmentedControl } from "@/components/interior/segmented-control";
import { TaskSteps } from "@/components/interior/task-steps";
import { Tooltip, TooltipGroup } from "@/components/interior/tooltip-group";
import { ValueFlash } from "@/components/interior/value-flash";
import { QuestWorkspace, type CompletePayload } from "@/components/quest-workspace";
import { useLive, useLiveStatus } from "@/lib/live";
import {
  LAYERS,
  achievements,
  isUnlocked,
  layerStats,
  nextQuest,
  rankFor,
  streak,
  totalXp,
  type Quest,
  type QuestView,
} from "@/lib/game";

const WIDGET_LABEL = { fields: "Choices", types: "Type picker", chart: "Chart", islands: "Island board", review: "Review", custom: "Live tool" } as const;

type Filter = "open" | "done" | "all";
type Toast = { id: number; text: string; big?: boolean };

const card =
  "rounded-[14px] border border-white/[0.09] bg-[#1A1918] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]";

export function BibleQuest() {
  const [quests, setQuests] = useState<QuestView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ignoreLocks, setIgnoreLocks] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/quests", { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Could not load quests");
    setQuests(body.quests);
  }, []);

  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLive((scopes) => {
    if (!scopes.some((x) => x === "quests" || x.startsWith("notes:") || x.startsWith("doc:"))) return;
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => load().catch(() => {}), 150);
  });

  useEffect(() => {
    load().catch((e) => setError(String(e)));
    const fromUrl = new URLSearchParams(window.location.search).get("quest");
    if (fromUrl) setSelectedId(fromUrl);
  }, [load]);

  const toast = useCallback((text: string, big = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, big }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), big ? 3200 : 2200);
  }, []);

  const post = useCallback(async (payload: object) => {
    const res = await fetch("/api/quests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Request failed");
    setQuests(body.quests);
    return body.quests as QuestView[];
  }, []);

  const selected = quests?.find((q) => q.id === selectedId) ?? null;

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-10 text-[13px] text-red-400">
        <p className="font-medium">Bible Quest could not read your docs.</p>
        <p className="mt-2 text-stone-400">{error}</p>
        <p className="mt-2 text-stone-500">
          It expects <code>quests.json</code> in <code>../game-docs</code>, or set BIBLE_DIR.
        </p>
      </main>
    );
  }

  if (!quests) {
    return <main className="p-10 text-[13px] text-stone-500">Loading your bible…</main>;
  }

  const xp = totalXp(quests);
  const rank = rankFor(xp);
  const days = streak(quests);
  const up = nextQuest(quests);
  const badges = achievements(quests);
  const layerIndex = LAYERS.findIndex((l) => !layerStats(quests, l.id).complete);
  const doneCount = quests.filter((q) => q.status === "done").length;

  const complete = async (q: QuestView, payload: CompletePayload) => {
    const beforeRank = rankFor(totalXp(quests)).index;
    const beforeBadges = new Set(badges.filter((b) => b.earned).map((b) => b.id));
    const after = await post({ action: "complete", id: q.id, ...payload });
    toast(`+${q.xp + payload.bonusXp} XP · ${q.title}`);
    const afterRank = rankFor(totalXp(after));
    if (afterRank.index > beforeRank) toast(`Rank up: ${afterRank.title}`, true);
    achievements(after)
      .filter((b) => b.earned && !beforeBadges.has(b.id))
      .forEach((b) => toast(`Badge earned: ${b.name}`, true));
    setTimeout(() => setSelectedId(null), 900);
  };

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-10">
      <Header
        rankTitle={rank.title}
        level={rank.level}
        into={rank.into}
        span={rank.span}
        nextTitle={rank.next?.title}
        xp={xp}
        days={days}
        doneCount={doneCount}
        total={quests.length}
      />

      <div className="mt-6 grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          {up ? (
            <UpNext quest={up} onStart={() => setSelectedId(up.id)} />
          ) : (
            <section className={`${card} p-5 text-[13px] text-stone-300`}>
              Every unlocked quest is done. Check back when a layer opens.
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              label="Show quests"
              value={filter}
              onValueChange={(v) => setFilter(v as Filter)}
              options={[
                { value: "open", label: "Open" },
                { value: "done", label: "Done" },
                { value: "all", label: "All" },
              ]}
            />
            <label className="flex cursor-pointer select-none items-center gap-2 text-[12.5px] text-stone-400">
              <input
                type="checkbox"
                checked={ignoreLocks}
                onChange={(e) => setIgnoreLocks(e.target.checked)}
                className="accent-[#93B0FF]"
              />
              Work ahead (ignore locks)
            </label>
          </div>

          {LAYERS.map((layer) => {
            const stats = layerStats(quests, layer.id);
            const unlocked = isUnlocked(quests, layer.id);
            const list = quests.filter(
              (q) => q.layer === layer.id && (filter === "all" || q.status === filter),
            );
            const needNames = layer.needs.map((n) => LAYERS.find((l) => l.id === n)!.name);
            const needs =
              needNames.length > 1 ? `both ${needNames.join(" and ")} are` : `${needNames[0]} is`;
            return (
              <section key={layer.id} className={`${card} p-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
                      Layer {layer.id}
                    </p>
                    <h2 className="mt-0.5 text-[16px] font-medium text-stone-100">
                      {layer.name}
                    </h2>
                    <p className="text-[12.5px] text-stone-500">{layer.blurb}</p>
                  </div>
                  {!unlocked ? (
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-stone-400">
                      Locked until {needs} done
                    </span>
                  ) : stats.complete ? (
                    <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11.5px] font-medium text-emerald-400">
                      Cleared
                    </span>
                  ) : null}
                </div>

                <ProgressBar
                  className="mt-4"
                  value={stats.done}
                  max={stats.total}
                  label={`${stats.done} of ${stats.total} quests`}
                />

                {!unlocked && !ignoreLocks ? (
                  <p className="mt-4 text-[12.5px] text-stone-500">
                    {stats.total - stats.done} quests parked. They open when {needs} done.
                  </p>
                ) : list.length > 0 ? (
                  <ul className="mt-4 divide-y divide-white/[0.06]">
                    {list.map((q) => (
                      <li key={q.id}>
                        <QuestRow
                          quest={q}
                          locked={!unlocked && !ignoreLocks}
                          onOpen={() => setSelectedId(q.id)}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-[12.5px] text-stone-500">
                    {filter === "open" ? "Nothing open here." : "Nothing to show."}
                  </p>
                )}
              </section>
            );
          })}
        </div>

        <aside className="space-y-5 md:sticky md:top-6 md:self-start">
          <section className={`${card} p-5`}>
            <h2 className="text-[13px] font-medium text-stone-200">The path</h2>
            <TaskSteps
              className="mt-3"
              label="Bible layers"
              current={layerIndex === -1 ? LAYERS.length : layerIndex}
              steps={LAYERS.map((l) => ({
                id: l.id,
                label: l.name,
                meta: `${layerStats(quests, l.id).done}/${layerStats(quests, l.id).total}`,
              }))}
            />
          </section>

          <section className={`${card} p-5`}>
            <h2 className="text-[13px] font-medium text-stone-200">
              Badges{" "}
              <span className="text-stone-500">
                {badges.filter((b) => b.earned).length}/{badges.length}
              </span>
            </h2>
            <TooltipGroup className="mt-3 flex flex-wrap gap-2">
              {badges.map((b) => (
                <Tooltip key={b.id} label={b.earned ? `Earned. ${b.how}` : b.how}>
                  <span
                    tabIndex={0}
                    className={`inline-flex h-7 items-center rounded-[8px] px-2.5 text-[12px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-stone-500 ${
                      b.earned
                        ? "bg-amber-300/[0.12] text-amber-200 shadow-[inset_0_0_0_1px_rgba(252,211,77,0.25)]"
                        : "bg-white/[0.03] text-stone-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                    }`}
                  >
                    {b.name}
                  </span>
                </Tooltip>
              ))}
            </TooltipGroup>
          </section>

          <section className={`${card} p-5 text-[12.5px] leading-relaxed text-stone-400`}>
            <h2 className="mb-2 text-[13px] font-medium text-stone-200">How to play</h2>
            Only work on unlocked layers: everything else is parked, not forgotten. Open a quest,
            write your decision, and hold to lock it in. It is saved to{" "}
            <code className="text-stone-300">quests.json</code> and added to the decision log.
          </section>
        </aside>
      </div>

      <QuestWorkspace
        quest={selected}
        locked={selected ? !isUnlocked(quests, selected.layer) && !ignoreLocks : false}
        onClose={() => setSelectedId(null)}
        onComplete={(payload) => (selected ? complete(selected, payload) : undefined)}
        onReopen={async () => {
          if (!selected) return;
          await post({ action: "reopen", id: selected.id });
          toast(`Reopened · ${selected.title}`);
        }}
        onCreateSheet={async () => {
          if (!selected) return;
          await post({ action: "create-sheet", id: selected.id });
          toast(`Sheet created · ${selected.file}`);
        }}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className={`rounded-full px-4 py-2 text-[13px] font-medium shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8)] ${
                t.big
                  ? "bg-amber-300 text-stone-900"
                  : "border border-white/10 bg-[#24231F] text-stone-100"
              }`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </main>
  );
}

function Header(props: {
  rankTitle: string;
  level: number;
  into: number;
  span: number;
  nextTitle?: string;
  xp: number;
  days: number;
  doneCount: number;
  total: number;
}) {
  return (
    <header className={`${card} p-6`}>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="flex items-center text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
            <LiveDot />
            Bible Quest · mons
            <a href="/write" className="ml-3 normal-case tracking-normal text-[#93B0FF] hover:underline">
              Writer
            </a>
          </p>
          <h1 className="mt-1 text-[26px] font-medium tracking-tight text-stone-50">
            {props.rankTitle}
            <span className="ml-2 text-[15px] font-normal text-stone-500">Rank {props.level}</span>
          </h1>
        </div>
        <div className="flex items-end gap-6">
          <Stat label="Total XP">
            <ValueFlash value={props.xp} label="Total XP" format={(v) => v.toLocaleString()} />
          </Stat>
          <Stat label="Streak">
            <span className="text-[20px] font-medium tabular-nums text-stone-100">
              {props.days}
              <span className="ml-1 text-[12px] font-normal text-stone-500">
                {props.days === 1 ? "day" : "days"}
              </span>
            </span>
          </Stat>
          <Stat label="Quests">
            <span className="text-[20px] font-medium tabular-nums text-stone-100">
              {props.doneCount}
              <span className="text-[12px] font-normal text-stone-500">/{props.total}</span>
            </span>
          </Stat>
        </div>
      </div>
      <ProgressBar
        className="mt-5"
        value={props.span ? props.into : 1}
        max={props.span || 1}
        label={
          props.nextTitle
            ? `${props.span - props.into} XP to ${props.nextTitle}`
            : "Max rank. The surge is held."
        }
        completeLabel="Max"
      />
    </header>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-right">
      <p className="text-[11px] uppercase tracking-[0.08em] text-stone-500">{label}</p>
      <div className="text-[20px] font-medium text-stone-100">{children}</div>
    </div>
  );
}

function UpNext({ quest, onStart }: { quest: Quest; onStart: () => void }) {
  const layer = LAYERS.find((l) => l.id === quest.layer)!;
  return (
    <section
      className={`${card} relative overflow-hidden p-5 shadow-[inset_0_0_0_1px_rgba(147,176,255,0.18)]`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#93B0FF]">
        Up next · {layer.name}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[18px] font-medium text-stone-50">{quest.title}</h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-stone-400">{quest.prompt}</p>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="h-10 shrink-0 rounded-[9px] bg-stone-100 px-4 text-[13px] font-medium text-stone-900 outline-none transition-transform duration-150 hover:bg-white focus-visible:ring-2 focus-visible:ring-[#93B0FF] active:scale-[0.97]"
        >
          Start quest · +{quest.xp} XP
        </button>
      </div>
    </section>
  );
}

function QuestRow({
  quest,
  locked,
  onOpen,
}: {
  quest: QuestView;
  locked: boolean;
  onOpen: () => void;
}) {
  const done = quest.status === "done";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group flex w-full items-center gap-3 rounded-[8px] px-2 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-white/[0.04] focus-visible:bg-white/[0.05] ${
        locked ? "opacity-50" : ""
      }`}
    >
      <span
        aria-hidden
        className={`grid size-5 shrink-0 place-items-center rounded-[6px] text-[11px] ${
          done
            ? "bg-emerald-400/[0.16] text-emerald-400"
            : locked
              ? "bg-white/[0.04] text-stone-500"
              : "shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.18)]"
        }`}
      >
        {done ? "✓" : locked ? "·" : quest.started ? <span className="size-[7px] rounded-full bg-amber-300" /> : ""}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-[13.5px] ${
          done ? "text-stone-400 line-through decoration-stone-600" : "text-stone-200"
        }`}
      >
        {quest.title}
      </span>
      <span className="hidden rounded-[6px] bg-white/[0.04] px-2 py-0.5 text-[11px] text-stone-400 sm:inline">
        {quest.widget ? `${WIDGET_LABEL[quest.widget.type]}${quest.widget.code && quest.widget.type !== "custom" ? " · live" : ""}` : quest.kind === "sheet" ? "Sheet" : "Decision"}
      </span>
      <span
        className={`w-16 shrink-0 text-right font-mono text-[12px] tabular-nums ${
          done ? "text-stone-600" : "text-amber-200/90"
        }`}
      >
        +{quest.xp + (quest.bonusXp ?? 0)}
      </span>
    </button>
  );
}

function LiveDot() {
  const status = useLiveStatus();
  if (status === "off") return null;
  const tone =
    status === "live" ? "bg-emerald-400" : status === "error" ? "bg-red-400" : "bg-amber-300";
  const label =
    status === "live" ? "Synced live" : status === "error" ? "Sync stopped, retrying" : "Connecting sync";
  return (
    <span title={label} aria-label={label} className="mr-2 inline-flex items-center gap-1.5 normal-case tracking-normal">
      <span className={`size-2 rounded-full ${tone} ${status === "live" ? "shadow-[0_0_0_3px_rgba(52,211,153,0.15)]" : ""}`} />
      <span className="text-[11px] text-stone-500">{status === "live" ? "Live" : label}</span>
    </span>
  );
}
