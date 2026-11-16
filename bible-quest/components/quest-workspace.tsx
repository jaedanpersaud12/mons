"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Drawer } from "@/components/interior/drawer";
import { HoldToConfirm } from "@/components/interior/hold-to-confirm";
import { LoadingButton } from "@/components/interior/loading-button";
import { MdView } from "@/components/md-view";
import { AnnotatedMd } from "@/components/annotated-md";
import { ProgressBar } from "@/components/interior/progress-bar";
import { useLive } from "@/lib/live";
import { ChartWidget, FieldsWidget, IslandsWidget, TypesWidget } from "@/components/widgets";
import { LiveWidget } from "@/components/live-widget";
import { LAYERS, VERDICTS, composeAnswer, type QuestNote, type QuestView } from "@/lib/game";
import { BONUS_XP, ISLAND_SLOTS, STARTER_ELEMENTS, asTypes, mainsOf, objectivesFor, widgetAnswer, widgetOutput, type Ctx, type Objective } from "@/lib/widgets";
import type { ContextSection } from "@/lib/sections";

type SaveState = "idle" | "loading" | "unsaved" | "saving" | "saved" | "conflict" | "error";

function useSheet(path: string | undefined, enabled: boolean) {
  const [text, setText] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const mtime = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(text);
  latest.current = text;

  useEffect(() => {
    if (!path || !enabled) return;
    let cancelled = false;
    setState("loading");
    fetch(`/api/doc?path=${encodeURIComponent(path)}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (cancelled) return;
        if (!r.ok) return setState("error");
        mtime.current = body.mtime;
        setText(body.text);
        setState("saved");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [path, enabled]);

  const save = useCallback(
    async (force = false) => {
      if (!path) return;
      if (timer.current) clearTimeout(timer.current);
      const sent = latest.current;
      setState("saving");
      const res = await fetch("/api/doc", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, text: sent, baseMtime: force ? null : mtime.current }),
      });
      const body = await res.json();
      if (res.status === 409) return setState("conflict");
      if (!res.ok) return setState("error");
      mtime.current = body.mtime;
      setState(latest.current === sent ? "saved" : "unsaved");
    },
    [path],
  );

  const edit = (next: string) => {
    setText(next);
    setState("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(), 900);
  };

  const reload = useCallback(async () => {
    if (!path) return;
    const r = await fetch(`/api/doc?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    const body = await r.json();
    if (r.ok) {
      mtime.current = body.mtime;
      setText(body.text);
      setState("saved");
    }
  }, [path]);

  return { text, state, edit, save, reload, path };
}

const saveLabel: Record<SaveState, string> = {
  idle: "",
  loading: "Opening…",
  unsaved: "Unsaved",
  saving: "Saving…",
  saved: "Saved",
  conflict: "Changed on disk",
  error: "Could not save",
};

export type CompletePayload = { answer: string; bonusXp: number; outputText?: string | null };
type View = "work" | "read" | "sheet";

export function QuestWorkspace({
  quest,
  locked,
  onClose,
  onComplete,
  onReopen,
  onCreateSheet,
}: {
  quest: QuestView | null;
  locked: boolean;
  onClose: () => void;
  onComplete: (payload: CompletePayload) => void | Promise<void>;
  onReopen: () => Promise<void>;
  onCreateSheet: () => Promise<void>;
}) {
  const [last, setLast] = useState<QuestView | null>(quest);
  useEffect(() => {
    if (quest) setLast(quest);
  }, [quest]);
  const q = quest ?? last;

  const widget = q?.widget;
  const hasTool = !!widget && widget.type !== "review";
  const isSheet = q?.kind === "sheet" && !widget;

  const [sections, setSections] = useState<ContextSection[] | null>(null);
  const [view, setView] = useState<View>("read");
  const readerRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState<QuestNote[]>([]);
  const [overall, setOverall] = useState("");
  const [data, setData] = useState<unknown>(null);
  const [typesData, setTypesData] = useState(asTypes(null));
  const [heads, setHeads] = useState<Record<string, string[]>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const loaded = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(false);

  useEffect(() => {
    if (!quest) return;
    const id = quest.id;
    loaded.current = null;
    setSections(null);
    setNotes([]);
    setOverall("");
    setData(null);
    setHeads({});
    setOpenKey(null);
    setView(quest.widget && quest.widget.type !== "review" ? "work" : "read");
    fetch(`/api/context?id=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => setSections(b.sections ?? []))
      .catch(() => setSections([]));
    fetch(`/api/notes?quest=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => {
        setNotes(b.notes ?? []);
        setOverall(b.overall ?? "");
        setData(b.data ?? null);
        loaded.current = id;
      })
      .catch(() => (loaded.current = id));
    if (id !== "types") {
      fetch("/api/notes?quest=types", { cache: "no-store" })
        .then((r) => r.json())
        .then((b) => setTypesData(asTypes(b.data)))
        .catch(() => {});
    }
  }, [quest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = q?.id;
    if (!id || loaded.current !== id || q?.status === "done") return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      fetch("/api/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quest: id, overall, notes, data }),
      }).catch(() => {});
    }, 400);
  }, [notes, overall, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const upsertNote = (n: Omit<QuestNote, "updatedAt">) =>
    setNotes((list) => {
      const next = { ...n, updatedAt: new Date().toISOString() };
      const i = list.findIndex((x) => x.key === n.key);
      if (i === -1) return [...list, next];
      const copy = list.slice();
      copy[i] = next;
      return copy;
    });
  const removeNote = (key: string) => setNotes((list) => list.filter((x) => x.key !== key));
  const onSections = useCallback((ref: string, list: string[]) => {
    setHeads((h) => ((h[ref] ?? []).join("|") === list.join("|") ? h : { ...h, [ref]: list }));
  }, []);

  const sheet = useSheet(q?.file, !!quest && isSheet && !!q?.fileExists);

  // Another device changed something this quest shows: pull it in.
  useLive((scopes) => {
    if (!quest) return;
    const id = quest.id;
    if (scopes.includes(`notes:${id}`) && saveTimer.current == null) {
      fetch(`/api/notes?quest=${encodeURIComponent(id)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((b) => {
          if (loaded.current !== id) return;
          skipSave.current = true;
          setNotes(b.notes ?? []);
          setOverall(b.overall ?? "");
          setData(b.data ?? null);
        })
        .catch(() => {});
    }
    if (id !== "types" && scopes.includes("notes:types")) {
      fetch("/api/notes?quest=types", { cache: "no-store" })
        .then((r) => r.json())
        .then((b) => setTypesData(asTypes(b.data)))
        .catch(() => {});
    }
    const docs = scopes.filter((x) => x.startsWith("doc:")).map((x) => x.slice(4));
    if (docs.some((d) => (sections ?? []).some((sec) => sec.file === d))) {
      fetch(`/api/context?id=${encodeURIComponent(id)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((b) => setSections(b.sections ?? []))
        .catch(() => {});
    }
    if (sheet.path && docs.includes(sheet.path) && sheet.state === "saved") sheet.reload();
  });

  const types = q?.id === "types" ? asTypes(data) : typesData;
  const ctx: Ctx = useMemo(
    () => ({
      types,
      notes,
      overall,
      heads: Object.entries(heads).flatMap(([ref, list]) => list.filter(Boolean).map((section) => ({ ref, section }))),
      sheetExists: !!q?.fileExists,
      sheetWords: sheet.text.trim() ? sheet.text.trim().split(/\s+/).length : 0,
    }),
    [types, notes, overall, heads, q?.fileExists, sheet.text], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const objectives = useMemo(() => (q ? objectivesFor(q, data, ctx) : []), [q, data, ctx]);
  const required = objectives.filter((o) => !o.bonus);
  const bonus = objectives.filter((o) => o.bonus && o.done).length * BONUS_XP;
  const nextUp = required.find((o) => !o.done);

  const builtinTool = !widget ? null : widget.type === "fields" ? (
    <FieldsWidget fields={widget.fields} value={data} onChange={setData} types={types} disabled={q?.status === "done" || locked} />
  ) : widget.type === "types" ? (
    <TypesWidget value={data} onChange={setData} disabled={q?.status === "done" || locked} />
  ) : widget.type === "chart" ? (
    <ChartWidget value={data} onChange={setData} types={types} disabled={q?.status === "done" || locked} />
  ) : widget.type === "islands" ? (
    <IslandsWidget value={data} onChange={setData} types={types} disabled={q?.status === "done" || locked} />
  ) : null;
  // What a live UI is told about the quest. It runs sandboxed, so this is all it can see.
  const liveCtx = useMemo(() => {
    const mains = mainsOf(types);
    const live = types.sources.filter((s) => mains.includes(s));
    return {
      quest: { id: q?.id, title: q?.title, prompt: q?.prompt },
      disabled: q?.status === "done" || locked,
      mains,
      secondaries: types.types.filter((t) => types.secondary.includes(t)),
      elements: live.length ? live : mains,
      starters: STARTER_ELEMENTS,
      slots: ISLAND_SLOTS,
      fields: widget?.type === "fields" ? widget.fields : undefined,
    };
  }, [types, q?.id, q?.title, q?.prompt, q?.status, locked, widget]);

  const layer = q ? LAYERS.find((l) => l.id === q.layer) : null;
  const done = q?.status === "done";
  const canLock = !!q && !done && !locked && !nextUp;

  const jump = (i: number) => {
    setView("read");
    requestAnimationFrame(() =>
      readerRef.current?.querySelector(`[data-section="${i}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const jumpToNote = (key: string) => {
    setView("read");
    requestAnimationFrame(() => {
      const el = Array.from(readerRef.current?.querySelectorAll<HTMLElement>("[data-anchor]") ?? []).find(
        (x) => x.dataset.anchor === key,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setOpenKey(key);
    });
  };

  const lock = async () => {
    if (!q) return;
    if (isSheet && (sheet.state === "unsaved" || sheet.state === "saving")) await sheet.save();
    const answer = [widgetAnswer(q, data, ctx), composeAnswer(overall, notes)].filter(Boolean).join("\n");
    await onComplete({ answer: answer || "Done.", bonusXp: bonus, outputText: widgetOutput(q, data, ctx) });
  };

  const tab = (v: View, text: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      className={`h-7 rounded-[7px] px-2.5 text-[12px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-stone-500 ${
        view === v ? "bg-stone-100 text-stone-900" : "bg-white/[0.05] text-stone-300 hover:bg-white/[0.09]"
      }`}
    >
      {text}
    </button>
  );

  return (
    <Drawer
      open={!!quest}
      onOpenChange={(open) => !open && onClose()}
      title={q?.title ?? "Quest"}
      description={q && layer ? `Layer ${layer.id} · ${layer.name} · +${q.xp} XP` : undefined}
      width={1240}
      footer={
        q ? (
          done ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-emerald-400">
                Locked in{q.doneAt ? ` on ${new Date(q.doneAt).toLocaleDateString()}` : ""}
                {q.bonusXp ? ` · +${q.bonusXp} bonus XP` : ""}
                {q.output ? ` · wrote ${q.output}` : ""}
              </span>
              <LoadingButton onAction={onReopen} pendingLabel="Reopening" successLabel="Reopened">
                Reopen quest
              </LoadingButton>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-stone-500">
                {locked ? "This layer is locked." : nextUp ? `Next: ${nextUp.label}` : q.output ? `Ready. Locking writes ${q.output}.` : "Ready. Hold to commit."}
              </span>
              <HoldToConfirm onConfirm={lock} disabled={!canLock} confirmLabel={`+${q.xp + bonus} XP`} duration={1200}>
                {bonus ? `Hold to lock it in · +${q.xp + bonus} XP` : "Hold to lock it in"}
              </HoldToConfirm>
            </div>
          )
        ) : null
      }
    >
      {q ? (
        <div className="-mx-4 -my-3 flex h-full min-h-0">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-white/[0.07] px-5 py-2.5">
              {hasTool ? tab("work", "Work") : null}
              {hasTool ? tab("read", "Reading") : null}
              {isSheet && q.fileExists ? tab("sheet", "Preview your sheet") : null}
              {isSheet && q.fileExists ? tab("read", "Reading") : null}
              {view === "read" ? (
                <>
                  {hasTool || (isSheet && q.fileExists) ? <span className="mx-1 h-4 w-px bg-white/10" /> : (
                    <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">Read</span>
                  )}
                  {sections === null ? (
                    <span className="text-[12px] text-stone-500">Finding what you need…</span>
                  ) : sections.length === 0 ? (
                    <span className="text-[12px] text-stone-500">Nothing to read for this one.</span>
                  ) : (
                    sections.map((s, i) => (
                      <button
                        key={s.ref}
                        type="button"
                        onClick={() => jump(i)}
                        className="h-7 max-w-[240px] truncate rounded-[7px] bg-white/[0.04] px-2.5 text-[12px] text-stone-300 outline-none hover:bg-white/[0.08] hover:text-stone-100 focus-visible:ring-2 focus-visible:ring-stone-500"
                        title={`${s.file} › ${s.heading ?? "whole file"}`}
                      >
                        {s.heading ?? s.file}
                      </button>
                    ))
                  )}
                </>
              ) : hasTool && sections?.length ? (
                <span className="ml-1 text-[12px] text-stone-500">
                  {sections.length} section{sections.length === 1 ? "" : "s"} of background in Reading
                </span>
              ) : null}
            </div>

            <div ref={readerRef} className="scroller min-h-0 flex-1 overflow-y-auto px-8 py-6">
              {view === "work" && widget ? (
                widget.code ? (
                  <LiveWidget codeId={widget.code} value={data} onChange={setData} ctx={liveCtx} fallback={builtinTool} custom={widget.type === "custom"} />
                ) : (
                  builtinTool
                )
              ) : view === "sheet" ? (
                <MdView markdown={sheet.text} className="compact" />
              ) : (
                <div className="mx-auto max-w-[72ch] space-y-8">
                  {(sections ?? []).map((s, i) => (
                    <section key={s.ref} data-section={i} className="scroll-mt-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate font-mono text-[11.5px] text-stone-500">
                          {s.file}
                          {s.trail.length ? ` › ${s.trail.join(" › ")}` : ""}
                        </p>
                        <a href={`/write?file=${encodeURIComponent(s.file)}`} className="shrink-0 text-[11.5px] text-stone-500 hover:text-stone-200">
                          Edit source
                        </a>
                      </div>
                      {s.missing ? (
                        <p className="rounded-[8px] border border-dashed border-white/10 p-3 text-[12.5px] text-stone-500">
                          Couldn’t find “{s.heading ?? s.file}”. The heading may have been renamed.
                        </p>
                      ) : (
                        <AnnotatedMd
                          markdown={s.markdown}
                          sectionRef={s.ref}
                          notes={notes.filter((n) => n.ref === s.ref)}
                          openKey={openKey}
                          onOpen={setOpenKey}
                          onSave={upsertNote}
                          onDelete={removeNote}
                          onSections={onSections}
                        />
                      )}
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex w-[360px] shrink-0 flex-col border-l border-white/[0.07]">
            <div className="shrink-0 px-5 pt-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#93B0FF]">Your quest</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-200">{q.prompt || q.answer}</p>
            </div>

            {!done ? <Objectives list={objectives} base={q.xp} bonus={bonus} /> : null}

            <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4">
              {isSheet ? (
                q.fileExists ? (
                  <>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="font-mono text-[11.5px] text-stone-500">{q.file}</span>
                      <span className={`text-[11.5px] ${sheet.state === "conflict" || sheet.state === "error" ? "text-red-400" : sheet.state === "unsaved" ? "text-amber-200/80" : "text-stone-500"}`}>
                        {saveLabel[sheet.state]}
                      </span>
                    </div>
                    {sheet.state === "conflict" ? (
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-red-200">
                        Changed somewhere else.
                        <button type="button" className="underline" onClick={sheet.reload}>
                          Load disk version
                        </button>
                        <button type="button" className="underline" onClick={() => sheet.save(true)}>
                          Overwrite
                        </button>
                      </div>
                    ) : null}
                    <textarea
                      value={sheet.text}
                      onChange={(e) => sheet.edit(e.target.value)}
                      disabled={done || sheet.state === "loading"}
                      spellCheck
                      className="min-h-0 flex-1 resize-none rounded-[10px] border border-white/[0.12] bg-black/25 p-3 font-mono text-[12.5px] leading-[1.7] text-stone-100 outline-none focus:border-[#93B0FF]/60 disabled:opacity-60"
                    />
                    <div className="mt-2 flex items-center justify-between text-[12px]">
                      <a href={`/write?file=${encodeURIComponent(q.file!)}`} className="text-stone-500 hover:text-stone-200">
                        Open in the full writer →
                      </a>
                      {notes.length ? <span className="text-stone-500">{notes.length} note{notes.length === 1 ? "" : "s"} on the reading</span> : null}
                    </div>
                  </>
                ) : (
                  <div className="rounded-[10px] border border-white/[0.08] bg-black/20 p-4">
                    <p className="text-[12.5px] text-stone-400">This quest is a sheet. Start it from the template, then fill it in here.</p>
                    <div className="mt-3">
                      <LoadingButton onAction={onCreateSheet} pendingLabel="Creating" successLabel="Created">
                        Create the sheet
                      </LoadingButton>
                    </div>
                  </div>
                )
              ) : done ? (
                <div className="scroller min-h-0 flex-1 overflow-y-auto">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-stone-500">Your answer</p>
                  <MdView markdown={q.answer || "Done."} className="compact mt-1.5 [--md-size:13.5px]" />
                </div>
              ) : (
                <NotesPanel notes={notes} overall={overall} onOverall={setOverall} onJump={jumpToNote} onRemove={removeNote} disabled={locked} compact={hasTool} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}

function Objectives({ list, base, bonus }: { list: Objective[]; base: number; bonus: number }) {
  const required = list.filter((o) => !o.bonus);
  const doneCount = required.filter((o) => o.done).length;
  return (
    <div className="shrink-0 border-b border-white/[0.07] px-5 pb-4 pt-4">
      <ProgressBar
        value={doneCount}
        max={required.length || 1}
        label={`Objectives ${doneCount}/${required.length}`}
        completeLabel="Ready"
      />
      <ul className="mt-3 space-y-1.5">
        {list.map((o) => (
          <li key={o.id} className="flex items-start gap-2 text-[12.5px] leading-snug">
            <span className="relative mt-[1px] grid size-4 shrink-0 place-items-center">
              <AnimatePresence initial={false} mode="wait">
                {o.done ? (
                  <motion.span
                    key="y"
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 520, damping: 22 }}
                    className={`grid size-4 place-items-center rounded-[5px] text-[10px] ${o.bonus ? "bg-amber-300/20 text-amber-200" : "bg-emerald-400/20 text-emerald-300"}`}
                  >
                    ✓
                  </motion.span>
                ) : (
                  <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="size-[7px] rounded-[2px] bg-white/20" />
                )}
              </AnimatePresence>
            </span>
            <span className={`min-w-0 flex-1 ${o.done ? "text-stone-400" : "text-stone-200"}`}>{o.label}</span>
            {o.detail && !o.done ? <span className="shrink-0 font-mono text-[11px] tabular-nums text-stone-500">{o.detail}</span> : null}
            {o.bonus ? (
              <span className={`shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-medium ${o.done ? "bg-amber-300/[0.16] text-amber-200" : "bg-white/[0.05] text-stone-500"}`}>
                +{BONUS_XP}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] text-stone-500">
        Worth <span className="font-mono text-amber-200/90">+{base + bonus} XP</span>
        {bonus ? ` (${base} + ${bonus} bonus)` : list.some((o) => o.bonus) ? " · bonus objectives add more" : ""}
      </p>
    </div>
  );
}

function NotesPanel({
  notes,
  overall,
  onOverall,
  onJump,
  onRemove,
  disabled,
  compact,
}: {
  notes: QuestNote[];
  overall: string;
  onOverall: (v: string) => void;
  onJump: (key: string) => void;
  onRemove: (key: string) => void;
  disabled: boolean;
  compact?: boolean;
}) {
  const chip: Record<string, string> = {
    keep: "text-emerald-300 bg-emerald-400/[0.12]",
    change: "text-amber-200 bg-amber-300/[0.12]",
    question: "text-sky-300 bg-sky-400/[0.12]",
    note: "text-stone-200 bg-white/[0.07]",
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.08em] text-stone-500">Your notes</span>
        <span className="text-[11.5px] text-stone-500">
          {VERDICTS.map((v) => {
            const c = notes.filter((n) => n.verdict === v.id).length;
            return c ? `${c} ${v.label.toLowerCase()}` : null;
          })
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <div className="scroller mt-2 min-h-0 flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-white/[0.1] p-3 text-[12.5px] leading-relaxed text-stone-500">
            {compact
              ? "Optional. Open Reading and press Note on anything you want to flag."
              : "Hover anything on the left and press Note. Mark it Keep, Change or Question right where it is. Your notes become the answer when you lock it in."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {notes.map((n) => (
              <li key={n.key} className="group relative">
                <button
                  type="button"
                  onClick={() => onJump(n.key)}
                  className="w-full rounded-[9px] border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-stone-500"
                >
                  <span className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${chip[n.verdict]}`}>
                      {VERDICTS.find((v) => v.id === n.verdict)!.label}
                    </span>
                    <span className="min-w-0 truncate text-[11.5px] text-stone-500">{n.section}</span>
                  </span>
                  <span className="mt-1 line-clamp-2 text-[12.5px] text-stone-300">{n.item}</span>
                  {n.text ? (
                    <span className="mt-1 block text-[12.5px] leading-relaxed text-stone-100">{n.text}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(n.key)}
                  aria-label="Remove note"
                  className="absolute right-2 top-2 hidden h-6 w-6 place-items-center rounded-[6px] text-[13px] text-stone-500 hover:bg-white/10 hover:text-stone-200 group-hover:grid"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="mt-3 block shrink-0">
        <span className="text-[11px] uppercase tracking-[0.08em] text-stone-500">Overall (optional)</span>
        <textarea
          value={overall}
          onChange={(e) => onOverall(e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder="Anything that isn't about one item."
          className="mt-1.5 w-full resize-none rounded-[10px] border border-white/[0.12] bg-black/25 p-2.5 text-[13px] leading-relaxed text-stone-100 outline-none placeholder:text-stone-600 focus:border-[#93B0FF]/60 disabled:opacity-50"
        />
      </label>
    </div>
  );
}
