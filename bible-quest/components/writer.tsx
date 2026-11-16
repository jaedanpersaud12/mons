"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SegmentedControl } from "@/components/interior/segmented-control";
import { renderMarkdown } from "@/lib/markdown";
import { useLive } from "@/lib/live";
import type { QuestView } from "@/lib/game";

type Doc = { path: string; mtime: number; size: number };
type Mode = "write" | "split" | "preview";
type Status = "idle" | "loading" | "unsaved" | "saving" | "saved" | "conflict" | "error";

const btn =
  "inline-flex h-8 items-center rounded-[8px] px-2.5 text-[12.5px] font-medium text-stone-300 outline-none transition-colors hover:bg-white/[0.06] hover:text-stone-100 focus-visible:ring-2 focus-visible:ring-stone-500 disabled:opacity-40";

export function Writer() {
  const router = useRouter();
  const params = useSearchParams();
  const file = params.get("file");

  const [docs, setDocs] = useState<Doc[]>([]);
  const [quests, setQuests] = useState<QuestView[]>([]);
  const [text, setText] = useState("");
  const [mtime, setMtime] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [conflict, setConflict] = useState<{ text: string; mtime: number } | null>(null);
  const [mode, setMode] = useState<Mode>("split");
  const [newPath, setNewPath] = useState("");
  const [filter, setFilter] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSel = useRef<[number, number] | null>(null);
  const setSel = (a: number, b = a) => {
    pendingSel.current = [a, b];
  };
  useLayoutEffect(() => {
    const el = area.current;
    const sel = pendingSel.current;
    if (!el || !sel) return;
    pendingSel.current = null;
    el.focus();
    el.setSelectionRange(sel[0], sel[1]);
  }, [text]);
  const latest = useRef({ text, mtime, file, status });
  latest.current = { text, mtime, file, status };

  const refreshDocs = useCallback(async () => {
    const res = await fetch("/api/docs", { cache: "no-store" });
    const body = await res.json();
    if (res.ok) setDocs(body.docs);
  }, []);

  useLive((scopes) => {
    const docs = scopes.filter((x) => x.startsWith("doc:")).map((x) => x.slice(4));
    if (!docs.length) return;
    refreshDocs();
    const f = latest.current.file;
    if (f && docs.includes(f) && latest.current.status === "saved") {
      fetch(`/api/doc?path=${encodeURIComponent(f)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((b) => {
          if (latest.current.file !== f || latest.current.status !== "saved") return;
          setText(b.text);
          setMtime(b.mtime);
        })
        .catch(() => {});
    }
  });

  useEffect(() => {
    refreshDocs();
    fetch("/api/quests", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => setQuests(b.quests ?? []))
      .catch(() => {});
  }, [refreshDocs]);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setStatus("loading");
    setConflict(null);
    fetch(`/api/doc?path=${encodeURIComponent(file)}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setText("");
          setMtime(null);
          setStatus("error");
          return;
        }
        setText(body.text);
        setMtime(body.mtime);
        setStatus("saved");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const save = useCallback(
    async (force = false) => {
      const { text: t, mtime: m, file: f } = latest.current;
      if (!f) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setStatus("saving");
      const res = await fetch("/api/doc", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: f, text: t, baseMtime: force ? null : m }),
      });
      const body = await res.json();
      if (res.status === 409) {
        setConflict(body.current);
        setStatus("conflict");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setMtime(body.mtime);
      setConflict(null);
      if (latest.current.text === t) setStatus("saved");
      else setStatus("unsaved");
      refreshDocs();
    },
    [refreshDocs],
  );

  const edit = (next: string) => {
    setText(next);
    if (latest.current.status === "conflict") return;
    setStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(), 900);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (latest.current.status === "unsaved" || latest.current.status === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [save]);

  const open = async (path: string) => {
    if (latest.current.status === "unsaved") await save();
    router.push(`/write?file=${encodeURIComponent(path)}`);
  };

  const wrap = (before: string, after = before, placeholder = "text") => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const picked = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + picked + after + value.slice(e);
    edit(next);
    setSel(s + before.length, s + before.length + picked.length);
  };

  const linePrefix = (prefix: string) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const start = value.lastIndexOf("\n", s - 1) + 1;
    const block = value.slice(start, e);
    const lines = block.split("\n").map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l));
    const replaced = lines.join("\n");
    edit(value.slice(0, start) + replaced + value.slice(e));
    setSel(start, start + replaced.length);
  };

  const insert = (snippet: string) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, value } = el;
    const pre = s > 0 && value[s - 1] !== "\n" ? "\n\n" : "";
    const next = value.slice(0, s) + pre + snippet + value.slice(s);
    edit(next);
    setSel(s + pre.length + snippet.length);
  };

  const onEditorKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "b") {
      e.preventDefault();
      wrap("**");
    } else if (mod && e.key.toLowerCase() === "i") {
      e.preventDefault();
      wrap("*");
    } else if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      wrap("[", "](url)", "link text");
    } else if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: s, selectionEnd: en, value } = el;
      edit(value.slice(0, s) + "  " + value.slice(en));
      setSel(s + 2);
    } else if (e.key === "Enter" && !mod) {
      const el = e.currentTarget;
      const { selectionStart: s, value } = el;
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const line = value.slice(lineStart, s);
      const m = line.match(/^(\s*)(- \[[ xX]\] |- |\* |\d+\. |> )/);
      if (m) {
        e.preventDefault();
        if (line.trim() === m[2].trim()) {
          edit(value.slice(0, lineStart) + value.slice(s));
          setSel(lineStart);
          return;
        }
        let marker = m[2];
        if (/^\d+\. $/.test(marker)) marker = `${parseInt(marker) + 1}. `;
        if (marker.startsWith("- [")) marker = "- [ ] ";
        const add = "\n" + m[1] + marker;
        edit(value.slice(0, s) + add + value.slice(s));
        setSel(s + add.length);
      }
    }
  };

  const html = useMemo(() => renderMarkdown(text), [text]);
  const words = useMemo(() => (text.trim() ? text.trim().split(/\s+/).length : 0), [text]);
  const quest = quests.find((q) => q.file === file);

  const grouped = useMemo(() => {
    const g = new Map<string, Doc[]>();
    docs
      .filter((d) => d.path.toLowerCase().includes(filter.toLowerCase()))
      .forEach((d) => {
        const folder = d.path.includes("/") ? d.path.slice(0, d.path.lastIndexOf("/")) : "";
        g.set(folder, [...(g.get(folder) ?? []), d]);
      });
    return [...g.entries()].sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  }, [docs, filter]);

  const statusText: Record<Status, string> = {
    idle: "",
    loading: "Opening…",
    unsaved: "Unsaved",
    saving: "Saving…",
    saved: "Saved to disk",
    conflict: "Changed on disk",
    error: "Could not open or save",
  };

  return (
    <div className="flex h-screen flex-col bg-[#141312] text-stone-200">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/[0.08] px-3">
        <Link href="/" className={btn}>
          ← Quests
        </Link>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <span className="min-w-0 truncate font-mono text-[12.5px] text-stone-400">
          {file ? `game-docs/${file}` : "No file open"}
        </span>
        {quest ? (
          <Link
            href={`/?quest=${quest.id}`}
            className="ml-1 hidden shrink-0 rounded-full bg-amber-300/[0.12] px-2.5 py-0.5 text-[11.5px] font-medium text-amber-200 hover:bg-amber-300/[0.2] sm:inline"
          >
            Quest: {quest.title} · +{quest.xp} XP
          </Link>
        ) : null}
        <div className="flex-1" />
        <span
          className={`text-[12px] ${
            status === "conflict" || status === "error"
              ? "text-red-400"
              : status === "unsaved"
                ? "text-amber-200/80"
                : "text-stone-500"
          }`}
        >
          {statusText[status]}
        </span>
        <SegmentedControl
          label="Editor mode"
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          options={[
            { value: "write", label: "Write" },
            { value: "split", label: "Split" },
            { value: "preview", label: "Preview" },
          ]}
        />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[250px] shrink-0 flex-col border-r border-white/[0.08]">
          <div className="p-3">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter docs"
              className="h-8 w-full rounded-[8px] border border-white/[0.1] bg-black/20 px-2.5 text-[12.5px] outline-none placeholder:text-stone-600 focus:border-[#93B0FF]/50"
            />
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {grouped.map(([folder, list]) => (
              <div key={folder || "root"} className="mb-3">
                <p className="px-2 pb-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-stone-500">
                  {folder || "game-docs"}
                </p>
                {list.map((d) => {
                  const name = d.path.split("/").pop()!;
                  const active = d.path === file;
                  return (
                    <button
                      key={d.path}
                      type="button"
                      onClick={() => open(d.path)}
                      className={`block w-full truncate rounded-[7px] px-2 py-1.5 text-left text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-stone-500 ${
                        active
                          ? "bg-white/[0.08] text-stone-100"
                          : "text-stone-400 hover:bg-white/[0.04] hover:text-stone-200"
                      }`}
                    >
                      {name.replace(/\.md$/, "")}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <form
            className="border-t border-white/[0.08] p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              let p = newPath.trim().replace(/^\/+/, "");
              if (!p) return;
              if (!p.endsWith(".md")) p += ".md";
              const title = p.split("/").pop()!.replace(/\.md$/, "").replace(/[-_]/g, " ");
              const res = await fetch("/api/doc", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: p, text: `# ${title}\n\n` }),
              });
              if (res.ok) {
                setNewPath("");
                await refreshDocs();
                open(p);
              }
            }}
          >
            <input
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="New doc, e.g. world/notes.md"
              className="h-8 w-full rounded-[8px] border border-white/[0.1] bg-black/20 px-2.5 text-[12.5px] outline-none placeholder:text-stone-600 focus:border-[#93B0FF]/50"
            />
          </form>
        </aside>

        {file ? (
          <main className="flex min-w-0 flex-1 flex-col">
            {conflict ? (
              <div className="flex items-center gap-3 border-b border-red-400/20 bg-red-400/[0.06] px-4 py-2 text-[12.5px] text-red-200">
                This file was changed somewhere else since you opened it.
                <button
                  type="button"
                  className={btn}
                  onClick={() => {
                    setText(conflict.text);
                    setMtime(conflict.mtime);
                    setConflict(null);
                    setStatus("saved");
                  }}
                >
                  Load the disk version
                </button>
                <button type="button" className={btn} onClick={() => save(true)}>
                  Keep mine and overwrite
                </button>
              </div>
            ) : null}

            {mode !== "preview" ? (
              <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-white/[0.06] px-2">
                <button type="button" className={btn} onClick={() => linePrefix("## ")}>H2</button>
                <button type="button" className={btn} onClick={() => linePrefix("### ")}>H3</button>
                <button type="button" className={`${btn} font-bold`} onClick={() => wrap("**")}>B</button>
                <button type="button" className={`${btn} italic`} onClick={() => wrap("*")}>I</button>
                <button type="button" className={btn} onClick={() => linePrefix("- ")}>List</button>
                <button type="button" className={btn} onClick={() => linePrefix("- [ ] ")}>Task</button>
                <button type="button" className={btn} onClick={() => linePrefix("> ")}>Quote</button>
                <button type="button" className={btn} onClick={() => wrap("[", "](url)", "link text")}>Link</button>
                <button
                  type="button"
                  className={btn}
                  onClick={() => insert("| Field | Value |\n|---|---|\n|  |  |\n")}
                >
                  Table
                </button>
                <button type="button" className={btn} onClick={() => insert("- [stated] \n")}>
                  Decision line
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  className={btn}
                  onClick={() => save()}
                  disabled={status === "saved" || status === "saving"}
                >
                  Save ⌘S
                </button>
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1">
              {mode !== "preview" ? (
                <textarea
                  ref={area}
                  value={text}
                  onChange={(e) => edit(e.target.value)}
                  onKeyDown={onEditorKey}
                  spellCheck
                  disabled={status === "loading"}
                  className={`min-h-0 flex-1 resize-none bg-transparent px-8 py-6 font-mono text-[13.5px] leading-[1.75] text-stone-200 outline-none placeholder:text-stone-600 ${
                    mode === "split" ? "border-r border-white/[0.06]" : ""
                  }`}
                  placeholder="Start writing…"
                />
              ) : null}
              {mode !== "write" ? (
                <article
                  className="md scroller min-h-0 flex-1 overflow-y-auto px-10 py-8 [--md-size:16px] [--md-width:none]"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ) : null}
            </div>

            <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-white/[0.06] px-4 text-[11.5px] text-stone-500">
              <span>{words.toLocaleString()} words</span>
              <span>{Math.max(1, Math.round(words / 230))} min read</span>
              <span className="flex-1" />
              <span>⌘B bold · ⌘I italic · ⌘K link · autosaves as you type</span>
            </footer>
          </main>
        ) : (
          <main className="grid flex-1 place-items-center text-[13px] text-stone-500">
            Pick a doc on the left, or start a new one.
          </main>
        )}
      </div>
    </div>
  );
}
