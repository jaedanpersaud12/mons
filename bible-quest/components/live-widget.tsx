"use client";

// Live UI: runs a quest's interface from source kept in the database, inside a sandboxed
// iframe. When the source changes (say, through the MCP server) the open quest reloads it
// on the spot. A crash never takes the quest down: you can fall back or roll back.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Select } from "@/components/select";
import { useLive } from "@/lib/live";
import { buildSrcDoc } from "@/lib/ui-runtime";

type VersionInfo = { v: number; note: string; at: string; by: string };
type Loaded = { id: string; title: string; current: number; version: number; source: string; versions: VersionInfo[] };
type Meta = { objectives?: unknown; answer?: unknown; output?: unknown };

const when = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};
const who = (by: string) => (by === "mcp" ? "Claude" : by === "app" ? "the app" : "you");

export function LiveWidget({
  codeId,
  value,
  onChange,
  ctx,
  fallback,
  custom,
}: {
  codeId: string;
  value: unknown;
  onChange: (v: unknown) => void;
  /** Everything the code is allowed to know: types, slots, whether the quest is locked. */
  ctx: Record<string, unknown>;
  /** The built-in tool for this quest, if it has one. Shown when live UI is off or broken. */
  fallback?: ReactNode;
  /** A quest with no built-in tool: objectives and the answer come from the code's `meta`. */
  custom?: boolean;
}) {
  const [code, setCode] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<{ message: string; stack: string } | null>(null);
  const [height, setHeight] = useState(240);
  const [flash, setFlash] = useState<string | null>(null);
  const [builtin, setBuiltin] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const lastFromFrame = useRef<string>("");
  const meta = useRef<Meta | null>(null);
  const latest = useRef({ value, ctx, onChange });
  latest.current = { value, ctx, onChange };
  const prefKey = `bq-live-off:${codeId}`;

  useEffect(() => {
    try {
      setBuiltin(window.localStorage.getItem(prefKey) === "1");
    } catch {}
  }, [prefKey]);

  const load = useCallback(
    (announce: boolean) =>
      fetch(`/api/code?id=${encodeURIComponent(codeId)}`, { cache: "no-store" })
        .then(async (r) => {
          if (r.status === 404) return setMissing(true);
          const next = (await r.json()) as Loaded;
          if (!next?.source) return;
          setMissing(false);
          setCode((prev) => {
            if (prev && prev.version === next.version && prev.source === next.source) return { ...next };
            ready.current = false;
            setError(null);
            if (announce) {
              const info = next.versions.find((x) => x.v === next.version);
              setFlash(`Updated to v${next.version}${info?.note ? `: ${info.note}` : ""}`);
              setTimeout(() => setFlash(null), 6000);
            }
            return next;
          });
        })
        .catch(() => {}),
    [codeId],
  );

  useEffect(() => {
    setCode(null);
    load(false);
  }, [load]);

  // Someone saved a new version, or rolled back: swap it in without a refresh.
  useLive((scopes) => {
    if (scopes.includes(`code-${codeId}`)) load(true);
  });

  const stripMeta = (v: unknown) => {
    if (!custom || !v || typeof v !== "object") return v;
    const rest = { ...(v as Record<string, unknown>) };
    delete rest._meta;
    return rest;
  };
  const post = (message: Record<string, unknown>) => frame.current?.contentWindow?.postMessage({ bq: 1, ...message }, "*");

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const m = e.data as { bq?: number; t?: string; data?: unknown; h?: number; message?: string; stack?: string; meta?: Meta };
      if (!m || m.bq !== 1) return;
      if (m.t === "ready") {
        ready.current = true;
        const data = stripMeta(latest.current.value);
        lastFromFrame.current = JSON.stringify(data ?? null);
        post({ t: "init", data: data ?? null, ctx: latest.current.ctx });
      } else if (m.t === "save") {
        lastFromFrame.current = JSON.stringify(m.data ?? null);
        latest.current.onChange(custom && m.data && typeof m.data === "object" ? { ...(m.data as object), _meta: meta.current ?? undefined } : m.data);
      } else if (m.t === "meta" && custom) {
        const before = JSON.stringify(meta.current);
        meta.current = m.meta ?? null;
        const cur = latest.current.value;
        if (before !== JSON.stringify(meta.current) && cur && typeof cur === "object") latest.current.onChange({ ...(cur as object), _meta: meta.current ?? undefined });
      } else if (m.t === "height" && typeof m.h === "number") {
        setHeight(Math.max(80, Math.min(20000, m.h)));
      } else if (m.t === "error") {
        setError({ message: m.message ?? "Unknown error", stack: m.stack ?? "" });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [custom]); // eslint-disable-line react-hooks/exhaustive-deps

  // The quest's data changed from outside the frame (another device, the MCP server): pass it in.
  const ctxKey = JSON.stringify(ctx);
  useEffect(() => {
    if (!ready.current) return;
    const data = stripMeta(value);
    const json = JSON.stringify(data ?? null);
    if (json === lastFromFrame.current) {
      post({ t: "data", data: data ?? null, ctx });
      return;
    }
    lastFromFrame.current = json;
    post({ t: "data", data: data ?? null, ctx });
  }, [value, ctxKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const srcDoc = useMemo(() => (code ? buildSrcDoc(code.source) : ""), [code?.source]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBuiltin = (off: boolean) => {
    setBuiltin(off);
    try {
      if (off) window.localStorage.setItem(prefKey, "1");
      else window.localStorage.removeItem(prefKey);
    } catch {}
  };
  const rollTo = (v: number) =>
    fetch("/api/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: codeId, version: v }) }).then(() => load(false));

  if (missing) {
    return (
      <div className="space-y-3">
        <p className="rounded-[10px] border border-dashed border-amber-300/30 p-3 text-[12.5px] text-amber-200/90">
          This quest points at live UI <b>{codeId}</b>, but nothing is saved under that name yet.
        </p>
        {fallback}
      </div>
    );
  }
  if (!code) return <div className="h-40 animate-pulse rounded-[12px] bg-white/[0.03]" />;

  const info = code.versions.find((x) => x.v === code.version);
  const previous = [...code.versions].reverse().find((x) => x.v < code.version);
  const showFrame = !builtin || !fallback;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] bg-[#93B0FF]/[0.06] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(147,176,255,0.18)]">
        <span className="relative flex h-2 w-2">
          {showFrame && !error ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#93B0FF] opacity-60" /> : null}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${error ? "bg-red-400" : showFrame ? "bg-[#93B0FF]" : "bg-stone-500"}`} />
        </span>
        <span className="text-[12.5px] font-medium text-stone-100">Live UI</span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-stone-400">
          {flash ? (
            <span className="text-[#C7D5FF]">{flash}</span>
          ) : (
            <>
              {code.title} · v{code.version}
              {info?.at ? ` · ${when(info.at)} by ${who(info.by)}` : " · shipped with the app"}
            </>
          )}
        </span>
        {code.versions.length > 1 ? (
          <div className="w-[230px]">
            <Select
              label="Version"
              placeholder="Version…"
              value={String(code.version)}
              onChange={(v) => v != null && Number(v) !== code.version && rollTo(Number(v))}
              items={[...code.versions].reverse().map((x) => ({ value: String(x.v), label: `v${x.v}${x.v === code.current ? " · live" : ""}`, hint: x.note.slice(0, 20) }))}
            />
          </div>
        ) : null}
        {fallback ? (
          <button
            type="button"
            onClick={() => toggleBuiltin(!builtin)}
            className="h-7 rounded-[8px] px-2.5 text-[12px] text-stone-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-colors hover:bg-white/[0.06]"
          >
            {builtin ? "Use live UI" : "Use built-in"}
          </button>
        ) : null}
      </div>

      {error && showFrame ? (
        <div className="mb-3 rounded-[10px] bg-red-400/[0.07] p-3 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.3)]">
          <p className="text-[13px] font-medium text-red-200">v{code.version} of this UI crashed</p>
          <p className="mt-1 font-mono text-[12px] text-red-200/80">{error.message}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {previous ? (
              <button type="button" onClick={() => rollTo(previous.v)} className="h-7 rounded-[8px] bg-white/[0.08] px-2.5 text-[12px] text-stone-100 hover:bg-white/[0.12]">
                Roll back to v{previous.v}
              </button>
            ) : null}
            {fallback ? (
              <button type="button" onClick={() => toggleBuiltin(true)} className="h-7 rounded-[8px] bg-white/[0.08] px-2.5 text-[12px] text-stone-100 hover:bg-white/[0.12]">
                Use the built-in tool
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-[11.5px] text-stone-400">Your answers are safe: the code only draws the tool, it does not hold the data.</p>
        </div>
      ) : null}

      {showFrame ? (
        error ? (
          fallback ?? null
        ) : (
          <iframe
            key={`${code.id}:${code.version}:${code.source.length}`}
            ref={frame}
            title={code.title}
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            style={{ height }}
            className="block w-full border-0 bg-transparent"
          />
        )
      ) : (
        fallback
      )}
    </div>
  );
}
