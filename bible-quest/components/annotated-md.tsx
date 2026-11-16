"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { renderMarkdown } from "@/lib/markdown";
import { VERDICTS, type QuestNote, type Verdict } from "@/lib/game";

type Anchor = {
  key: string;
  item: string;
  section: string;
  el: HTMLElement;
  noteHost: HTMLElement;
  pillHost: HTMLElement;
};

const tone: Record<Verdict, string> = {
  keep: "text-emerald-300 bg-emerald-400/[0.12] shadow-[inset_0_0_0_1px_rgba(52,211,153,0.3)]",
  change: "text-amber-200 bg-amber-300/[0.12] shadow-[inset_0_0_0_1px_rgba(252,211,77,0.3)]",
  question: "text-sky-300 bg-sky-400/[0.12] shadow-[inset_0_0_0_1px_rgba(125,211,252,0.3)]",
  note: "text-stone-200 bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]",
};

function ownText(el: HTMLElement) {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("ul,ol,.note-host,.pill-host,input").forEach((n) => n.remove());
  return (clone.textContent || "").replace(/\s+/g, " ").trim();
}

export function AnnotatedMd({
  markdown,
  sectionRef,
  notes,
  openKey,
  onOpen,
  onSave,
  onDelete,
  onSections,
}: {
  markdown: string;
  sectionRef: string;
  notes: QuestNote[];
  openKey: string | null;
  onOpen: (key: string | null) => void;
  onSave: (note: Omit<QuestNote, "updatedAt">) => void;
  onDelete: (key: string) => void;
  onSections?: (ref: string, sections: string[]) => void;
}) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);
  // Same object every render, or React 19 rewrites innerHTML and drops the note hooks.
  const inner = useMemo(() => ({ __html: html }), [html]);
  const root = useRef<HTMLDivElement>(null);
  const [anchors, setAnchors] = useState<Anchor[]>([]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const found: Anchor[] = [];
    const used = new Map<string, number>();
    let heading = "";

    const walk = (node: Element) => {
      for (const child of Array.from(node.children)) {
        const tag = child.tagName;
        if (/^H[1-6]$/.test(tag)) {
          heading = (child.textContent || "").trim();
          continue;
        }
        if (tag === "UL" || tag === "OL") {
          child.querySelectorAll(":scope > li").forEach((li) => add(li as HTMLElement, "li"));
          continue;
        }
        if (child.classList.contains("table-wrap")) {
          child.querySelectorAll("tbody tr").forEach((tr) => add(tr as HTMLElement, "tr"));
          continue;
        }
        if (tag === "P" || child.classList.contains("alert") || tag === "BLOCKQUOTE") {
          add(child as HTMLElement, "block");
        }
      }
    };

    const add = (target: HTMLElement, kind: "li" | "tr" | "block") => {
      const item = kind === "tr"
        ? Array.from(target.children).map((c) => (c.textContent || "").trim()).filter(Boolean).join(" · ")
        : ownText(target);
      if (!item) return;
      const base = `${sectionRef}::${heading}::${item.slice(0, 140)}`;
      const n = used.get(base) || 0;
      used.set(base, n + 1);
      const key = n ? `${base}#${n}` : base;

      target.classList.add("annot");
      target.dataset.anchor = key;

      const pillHost = document.createElement("span");
      pillHost.className = "pill-host";
      const noteHost = document.createElement("div");
      noteHost.className = "note-host";

      if (kind === "tr") {
        const last = target.lastElementChild as HTMLElement | null;
        last?.classList.add("annot-cell");
        last?.append(pillHost);
        const row = document.createElement("tr");
        row.className = "note-row";
        const td = document.createElement("td");
        td.colSpan = target.children.length;
        td.append(noteHost);
        row.append(td);
        target.after(row);
      } else if (kind === "li") {
        target.append(pillHost);
        const nested = target.querySelector(":scope > div > ul, :scope > div > ol, :scope > ul, :scope > ol");
        if (nested) nested.before(noteHost);
        else target.append(noteHost);
      } else {
        target.append(pillHost);
        target.after(noteHost);
      }
      found.push({ key, item, section: heading, el: target, noteHost, pillHost });
    };

    walk(el);
    setAnchors(found);
    onSections?.(sectionRef, [...new Set(found.map((a) => a.section))]);
  }, [html, sectionRef]);

  const byKey = useMemo(() => new Map(notes.map((n) => [n.key, n])), [notes]);

  useLayoutEffect(() => {
    anchors.forEach((a) => {
      a.el.classList.toggle("has-note", byKey.has(a.key));
      a.el.classList.toggle("is-open", openKey === a.key);
      const row = a.el.tagName === "TR" ? (a.el.nextElementSibling as HTMLElement | null) : null;
      row?.classList.toggle("show", byKey.has(a.key) || openKey === a.key);
    });
  }, [anchors, byKey, openKey]);

  return (
    <>
      <div ref={root} className="md compact annotatable" dangerouslySetInnerHTML={inner} />
      {anchors.map((a) => {
        const note = byKey.get(a.key);
        const open = openKey === a.key;
        return (
          <PortalPair key={a.key} anchor={a}>
            <button
              type="button"
              onClick={() => onOpen(open ? null : a.key)}
              aria-label={note ? "Edit note" : "Add a note"}
              className={`note-pill ${note ? "has" : ""}`}
            >
              {note ? VERDICTS.find((v) => v.id === note.verdict)!.label : "Note"}
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <Composer
                  key="composer"
                  initial={note}
                  onCancel={() => onOpen(null)}
                  onDelete={note ? () => (onDelete(a.key), onOpen(null)) : undefined}
                  onSave={(verdict, text) => {
                    onSave({ key: a.key, ref: sectionRef, section: a.section, item: a.item, verdict, text });
                    onOpen(null);
                  }}
                />
              ) : note ? (
                <motion.button
                  key="card"
                  type="button"
                  onClick={() => onOpen(a.key)}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="note-card"
                >
                  <span className={`note-chip ${tone[note.verdict]}`}>
                    {VERDICTS.find((v) => v.id === note.verdict)!.label}
                  </span>
                  {note.text ? <span className="note-text">{note.text}</span> : null}
                </motion.button>
              ) : null}
            </AnimatePresence>
          </PortalPair>
        );
      })}
    </>
  );
}

function PortalPair({ anchor, children }: { anchor: Anchor; children: [React.ReactNode, React.ReactNode] }) {
  return (
    <>
      {createPortal(children[0], anchor.pillHost)}
      {createPortal(children[1], anchor.noteHost)}
    </>
  );
}

function Composer({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: QuestNote;
  onSave: (verdict: Verdict, text: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [verdict, setVerdict] = useState<Verdict>(initial?.verdict ?? "keep");
  const [text, setText] = useState(initial?.text ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      className="composer"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSave(verdict, text);
        }
        if ((e.metaKey || e.ctrlKey) && /^[1-4]$/.test(e.key)) {
          e.preventDefault();
          setVerdict(VERDICTS[Number(e.key) - 1].id);
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {VERDICTS.map((v, i) => (
          <button
            key={v.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setVerdict(v.id);
              ref.current?.focus();
            }}
            title={`⌘${i + 1}`}
            className={`h-7 rounded-full px-3 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-stone-500 ${
              verdict === v.id ? tone[v.id] : "text-stone-400 hover:bg-white/[0.06] hover:text-stone-200"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={
          verdict === "keep"
            ? "Optional. Why it stays, or nothing at all."
            : verdict === "change"
              ? "What should it be instead?"
              : verdict === "question"
                ? "What do you need to figure out?"
                : "Your note"
        }
        className="mt-2 w-full resize-none rounded-[8px] border border-white/[0.12] bg-black/30 px-2.5 py-2 text-[13.5px] leading-relaxed text-stone-100 outline-none placeholder:text-stone-600 focus:border-[#93B0FF]/60"
      />
      <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-stone-500">
        <span>Enter saves · Shift+Enter new line · Esc cancels · ⌘1–4 verdict</span>
        <span className="flex-1" />
        {onDelete ? (
          <button type="button" onClick={onDelete} className="text-stone-500 hover:text-red-300">
            Remove
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onSave(verdict, text)}
          className="h-7 rounded-[7px] bg-stone-100 px-3 font-medium text-stone-900 hover:bg-white"
        >
          Save note
        </button>
      </div>
    </motion.div>
  );
}
