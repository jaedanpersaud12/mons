"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Select } from "@/components/select";
import {
  ISLAND_SLOTS,
  MAIN_PRESETS,
  MONS_RELATIONS,
  SECONDARY_PRESETS,
  STONE_RELATIONS,
  asChart,
  mainsOf,
  orderedTypes,
  asIslands,
  asTypes,
  type Cell,
  type Field,
  type FieldsData,
  type Island,
  type Option,
  type TypesData,
} from "@/lib/widgets";

const input =
  "h-9 w-full rounded-[8px] border border-white/[0.12] bg-black/25 px-2.5 text-[13px] text-stone-100 outline-none placeholder:text-stone-600 focus:border-[#93B0FF]/60 disabled:opacity-50";
const label = "text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500";

function Tick() {
  return (
    <motion.span
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-400/20 text-[10px] text-emerald-300"
    >
      ✓
    </motion.span>
  );
}

/* ---------- Fields: choices, multi-picks, short text, assignments ---------- */

export function FieldsWidget({
  fields,
  value,
  onChange,
  types,
  disabled,
}: {
  fields: Field[];
  value: unknown;
  onChange: (v: FieldsData) => void;
  types: TypesData;
  disabled?: boolean;
}) {
  const data = (value ?? {}) as FieldsData;
  const set = (id: string, v: FieldsData[string]) => onChange({ ...data, [id]: v });

  return (
    <div className="mx-auto max-w-[760px] space-y-8">
      {fields.map((f, i) => (
        <section key={f.id}>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[11.5px] text-stone-600">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="text-[15.5px] font-medium text-stone-100">{f.label}</h3>
            {f.optional ? (
              <span className="rounded-full bg-amber-300/[0.1] px-2 py-0.5 text-[10.5px] font-medium text-amber-200">
                Bonus
              </span>
            ) : null}
          </div>
          {f.hint ? <p className="mt-1 pl-7 text-[12.5px] leading-relaxed text-stone-500">{f.hint}</p> : null}
          <div className="mt-3 pl-7">
            {f.type === "text" ? (
              (f.lines ?? 3) === 1 ? (
                <input
                  className={input}
                  value={(data[f.id] as string) ?? ""}
                  onChange={(e) => set(f.id, e.target.value)}
                  placeholder={f.placeholder}
                  disabled={disabled}
                />
              ) : (
                <textarea
                  className={`${input} h-auto resize-none py-2 leading-relaxed`}
                  rows={f.lines ?? 3}
                  value={(data[f.id] as string) ?? ""}
                  onChange={(e) => set(f.id, e.target.value)}
                  placeholder={f.placeholder}
                  disabled={disabled}
                />
              )
            ) : f.type === "assign" ? (
              <Assign f={f} value={(data[f.id] as Record<string, string>) ?? {}} onChange={(v) => set(f.id, v)} disabled={disabled} />
            ) : (
              <Cards
                options={f.optionsFrom === "types" ? mainsOf(types).map((t) => ({ label: t })) : f.options ?? []}
                multi={f.type === "multi"}
                allowCustom={f.allowCustom}
                compact={f.optionsFrom === "types"}
                emptyText={f.optionsFrom === "types" ? "Pick your main types first, or type one in." : undefined}
                value={data[f.id] as string | string[] | undefined}
                onChange={(v) => set(f.id, v)}
                disabled={disabled}
              />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function Cards({
  options,
  multi,
  allowCustom,
  compact,
  emptyText,
  value,
  onChange,
  disabled,
}: {
  options: Option[];
  multi: boolean;
  allowCustom?: boolean;
  compact?: boolean;
  emptyText?: string;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  disabled?: boolean;
}) {
  const picked = multi ? ((value as string[]) ?? []) : value ? [value as string] : [];
  const labels = options.map((o) => o.label);
  const customs = picked.filter((p) => !labels.includes(p));
  const [draft, setDraft] = useState("");

  const toggle = (l: string) => {
    if (disabled) return;
    if (multi) onChange(picked.includes(l) ? picked.filter((p) => p !== l) : [...picked, l]);
    else onChange(picked[0] === l ? "" : l);
  };
  const addCustom = () => {
    const t = draft.trim();
    if (!t) return;
    if (multi) onChange([...picked.filter((p) => p !== t), t]);
    else onChange(t);
    setDraft("");
  };

  return (
    <div>
      {options.length === 0 && emptyText ? <p className="mb-2 text-[12.5px] text-stone-500">{emptyText}</p> : null}
      <div className={compact ? "flex flex-wrap gap-1.5" : "grid gap-2 sm:grid-cols-2"}>
        {[...options, ...customs.map((c) => ({ label: c, hint: "Your own" }))].map((o) => {
          const on = picked.includes(o.label);
          return (
            <button
              key={o.label}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.label)}
              disabled={disabled}
              className={`rounded-[10px] text-left outline-none transition-[background-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-stone-500 active:scale-[0.985] disabled:opacity-60 ${
                compact ? "h-8 px-3 text-[12.5px]" : "px-3.5 py-3"
              } ${
                on
                  ? "bg-[#93B0FF]/[0.12] text-stone-50 shadow-[inset_0_0_0_1.5px_rgba(147,176,255,0.6)]"
                  : "bg-white/[0.03] text-stone-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] hover:bg-white/[0.06]"
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className={compact ? "" : "text-[13.5px] font-medium leading-snug"}>{o.label}</span>
                {on && !compact ? <Tick /> : null}
              </span>
              {o.hint && !compact ? (
                <span className="mt-1 block text-[12px] leading-relaxed text-stone-500">{o.hint}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {allowCustom && !disabled ? (
        <div className="mt-2 flex gap-2">
          <input
            className={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
            placeholder="Something else… type it and press Enter"
          />
        </div>
      ) : null}
    </div>
  );
}

function Assign({
  f,
  value,
  onChange,
  disabled,
}: {
  f: Extract<Field, { type: "assign" }>;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  disabled?: boolean;
}) {
  const used = Object.values(value);
  return (
    <div className="space-y-2">
      {f.rows.map((r) => (
        <div key={r.label} className="flex flex-wrap items-center gap-3 rounded-[10px] bg-white/[0.03] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
          <div className="min-w-[170px] flex-1">
            <p className="text-[13.5px] font-medium text-stone-100">{r.label}</p>
            {r.hint ? <p className="text-[12px] text-stone-500">{r.hint}</p> : null}
          </div>
          <div className="flex gap-1">
            {f.options.map((o) => {
              const on = value[r.label] === o.label;
              const taken = f.unique && !on && used.includes(o.label);
              return (
                <button
                  key={o.label}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...value, [r.label]: on ? "" : o.label })}
                  title={o.hint}
                  className={`h-8 rounded-[8px] px-3 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-stone-500 ${
                    on
                      ? "bg-[#93B0FF]/[0.16] text-stone-50 shadow-[inset_0_0_0_1.5px_rgba(147,176,255,0.6)]"
                      : taken
                        ? "text-stone-600 hover:text-stone-400"
                        : "bg-white/[0.04] text-stone-300 hover:bg-white/[0.08]"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Types: main and secondary, then the 12 island elements ---------- */

function Chip({ on, children, onClick, disabled, tone = "main" }: { on: boolean; children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: "main" | "sec" }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`h-8 rounded-full px-3 text-[12.5px] font-medium outline-none transition-[background-color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-stone-500 active:scale-95 ${
        on
          ? tone === "main"
            ? "bg-stone-100 text-stone-900"
            : "bg-[#93B0FF] text-stone-950"
          : "bg-white/[0.05] text-stone-400 hover:bg-white/[0.09] hover:text-stone-200"
      }`}
    >
      {children}
    </button>
  );
}

export function TypesWidget({ value, onChange, disabled }: { value: unknown; onChange: (v: TypesData) => void; disabled?: boolean }) {
  const t = asTypes(value);
  const { types, sources, secondary, origins } = t;
  const mains = mainsOf(t);
  const secs = types.filter((x) => secondary.includes(x));
  const live = sources.filter((x) => mains.includes(x));
  const [mainDraft, setMainDraft] = useState("");
  const [secDraft, setSecDraft] = useState("");
  const secPreset = (l: string) => SECONDARY_PRESETS.find((x) => x.label === l);

  const update = (patch: Partial<TypesData>) => !disabled && onChange({ ...t, ...patch });
  const toggle = (x: string, tier: "main" | "sec") => {
    if (types.includes(x)) {
      update({
        types: types.filter((y) => y !== x),
        sources: sources.filter((y) => y !== x),
        secondary: secondary.filter((y) => y !== x),
      });
    } else {
      update({ types: [...types, x], secondary: tier === "sec" ? [...secondary, x] : secondary });
    }
  };
  const moveTier = (x: string) =>
    update(
      secondary.includes(x)
        ? { secondary: secondary.filter((y) => y !== x) }
        : { secondary: [...secondary, x], sources: sources.filter((y) => y !== x) },
    );
  const add = (raw: string, tier: "main" | "sec") => {
    const x = raw.trim().replace(/^\w/, (c) => c.toUpperCase());
    if (x && !types.includes(x)) toggle(x, tier);
  };
  const customMains = mains.filter((x) => !MAIN_PRESETS.includes(x));
  const customSecs = secs.filter((x) => !secPreset(x));

  return (
    <div className="mx-auto max-w-[780px] space-y-9">
      <section>
        <div className="flex items-baseline justify-between">
          <p className={label}>1 · Main types</p>
          <span className="font-mono text-[12px] text-stone-400">{mains.length} picked</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-stone-500">
          Real-world elements that pool at a source. Every mon has exactly one: the element it absorbs.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[...MAIN_PRESETS, ...customMains].map((x) => (
            <Chip key={x} on={mains.includes(x)} onClick={() => (secondary.includes(x) ? moveTier(x) : toggle(x, "main"))} disabled={disabled}>
              {x}
            </Chip>
          ))}
        </div>
        {!disabled ? (
          <input
            className={`${input} mt-2 max-w-[320px]`}
            value={mainDraft}
            onChange={(e) => setMainDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add(mainDraft, "main"), setMainDraft(""))}
            placeholder="Invent a main type… press Enter"
          />
        ) : null}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <p className={label}>2 · Secondary types</p>
          <span className="font-mono text-[12px] text-stone-400">{secs.length} picked</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-stone-500">
          Where and how a mon lives inside its biome: depth, altitude, night, caves, behaviour. A deep-water mon is{" "}
          <b className="text-stone-300">Water / Dark</b>. A flyer from the storm peaks is <b className="text-stone-300">Lightning / Flying</b>.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[...SECONDARY_PRESETS.map((x) => x.label), ...customSecs].map((x) => (
            <Chip key={x} tone="sec" on={secs.includes(x)} onClick={() => (types.includes(x) && !secondary.includes(x) ? moveTier(x) : toggle(x, "sec"))} disabled={disabled}>
              {x}
            </Chip>
          ))}
        </div>
        {!disabled ? (
          <input
            className={`${input} mt-2 max-w-[320px]`}
            value={secDraft}
            onChange={(e) => setSecDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add(secDraft, "sec"), setSecDraft(""))}
            placeholder="Invent a secondary type… press Enter"
          />
        ) : null}
        {secs.length ? (
          <div className="mt-4 space-y-1.5">
            {secs.map((x) => (
              <div key={x} className="flex items-center gap-3 rounded-[10px] bg-white/[0.03] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
                <span className="w-[86px] shrink-0 text-[13px] font-medium text-[#B9CBFF]">{x}</span>
                <span className="shrink-0 text-[12px] text-stone-500">comes from</span>
                <input
                  className={`${input} h-8 text-[12.5px]`}
                  value={origins[x] ?? ""}
                  onChange={(e) => update({ origins: { ...origins, [x]: e.target.value } })}
                  placeholder={secPreset(x)?.from ?? "Where do mons pick this up?"}
                  disabled={disabled}
                />
                {!origins[x] && secPreset(x) && !disabled ? (
                  <button
                    type="button"
                    onClick={() => update({ origins: { ...origins, [x]: secPreset(x)!.from } })}
                    className="shrink-0 text-[11.5px] text-stone-500 hover:text-stone-200"
                  >
                    Use suggestion
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <p className={label}>3 · Tap the 12 mains that get an island</p>
          <span className={`font-mono text-[12px] tabular-nums ${live.length === 12 ? "text-emerald-300" : live.length > 12 ? "text-red-400" : "text-stone-400"}`}>
            {live.length}/12 island elements
          </span>
        </div>
        <p className="mt-1 text-[12.5px] text-stone-500">Each island has one great source, and every source is a main type.</p>
        {mains.length === 0 ? (
          <p className="mt-3 rounded-[10px] border border-dashed border-white/10 p-4 text-[12.5px] text-stone-500">No main types yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {mains.map((x) => {
              const on = sources.includes(x);
              return (
                <button
                  key={x}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => update({ sources: on ? sources.filter((y) => y !== x) : [...sources, x] })}
                  className={`flex h-14 flex-col justify-center rounded-[10px] px-3 text-left outline-none transition-[background-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-stone-500 active:scale-[0.98] ${
                    on
                      ? "bg-amber-300/[0.1] shadow-[inset_0_0_0_1.5px_rgba(252,211,77,0.5)]"
                      : "bg-white/[0.03] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="text-[13.5px] font-medium text-stone-100">{x}</span>
                  <span className={`text-[11px] ${on ? "text-amber-200" : "text-stone-600"}`}>{on ? "Island element" : "No island"}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- Chart: click cells to set matchups ---------- */

const NEXT: Record<string, Cell | undefined> = { "": "strong", strong: "weak", weak: "none", none: "absorb", absorb: undefined };
const CELL: Record<Cell, { text: string; cls: string }> = {
  strong: { text: "2", cls: "bg-emerald-400/25 text-emerald-200" },
  weak: { text: "½", cls: "bg-red-400/20 text-red-200" },
  none: { text: "0", cls: "bg-stone-950 text-stone-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" },
  absorb: { text: "+", cls: "bg-sky-400/20 text-sky-200" },
};

export function ChartWidget({ value, onChange, types, disabled }: { value: unknown; onChange: (v: { cells: Record<string, Cell> }) => void; types: TypesData; disabled?: boolean }) {
  const { cells } = asChart(value);
  const [hover, setHover] = useState<[string, string] | null>(null);
  const list = orderedTypes(types);
  const firstSec = list.find((x) => types.secondary.includes(x));

  if (list.length < 2) {
    return (
      <p className="mx-auto max-w-[520px] rounded-[10px] border border-dashed border-white/10 p-5 text-[13px] leading-relaxed text-stone-400">
        The chart is built from your type list. Do <b className="text-stone-200">Pick the type list</b> first, then come back.
      </p>
    );
  }

  const click = (a: string, d: string) => {
    if (disabled) return;
    const key = `${a}>${d}`;
    const next = NEXT[cells[key] ?? ""];
    const copy = { ...cells };
    if (next) copy[key] = next;
    else delete copy[key];
    onChange({ cells: copy });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-stone-400">
        <span>Rows attack, columns defend. <span className="text-[#93B0FF]/80">Blue</span> names are secondary. Click to cycle:</span>
        {(["strong", "weak", "none", "absorb"] as Cell[]).map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className={`grid size-5 place-items-center rounded-[5px] text-[11px] font-medium ${CELL[c].cls}`}>{CELL[c].text}</span>
            {c === "strong" ? "hits hard" : c === "weak" ? "resisted" : c === "none" ? "no effect" : "absorbed, heals"}
          </span>
        ))}
        <span className="text-stone-500">
          {hover ? (
            <>
              <b className="text-stone-200">{hover[0]}</b> attacking <b className="text-stone-200">{hover[1]}</b>
            </>
          ) : (
            "blank is normal"
          )}
        </span>
      </div>
      <div className="scroller overflow-x-auto pb-2">
        <table className="border-separate border-spacing-[3px]">
          <thead>
            <tr>
              <th />
              {list.map((d) => (
                <th key={d} className={`relative h-[70px] w-8 min-w-8 max-w-8 ${d === firstSec ? "border-l-[6px] border-transparent" : ""}`}>
                  <span className={`absolute bottom-1 left-4 block origin-bottom-left -rotate-45 whitespace-nowrap text-left text-[11.5px] font-medium ${hover?.[1] === d ? "text-stone-50" : types.secondary.includes(d) ? "text-[#93B0FF]/80" : "text-stone-400"}`}>
                    {d}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a}>
                <th className={`pr-2 text-right text-[12px] font-medium ${hover?.[0] === a ? "text-stone-50" : types.secondary.includes(a) ? "text-[#93B0FF]/80" : "text-stone-400"} ${a === firstSec ? "pt-3" : ""}`}>{a}</th>
                {list.map((d) => {
                  const c = cells[`${a}>${d}`];
                  return (
                    <td key={d} className={`p-0 ${d === firstSec ? "border-l-[6px] border-transparent" : ""} ${a === firstSec ? "pt-3" : ""}`}>
                      <button
                        type="button"
                        aria-label={`${a} attacking ${d}: ${c ?? "normal"}`}
                        disabled={disabled}
                        onClick={() => click(a, d)}
                        onMouseEnter={() => setHover([a, d])}
                        onMouseLeave={() => setHover(null)}
                        className={`grid size-8 place-items-center rounded-[6px] text-[12.5px] font-medium outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-stone-400 ${
                          c ? CELL[c].cls : a === d ? "bg-white/[0.07] text-transparent hover:bg-white/[0.12]" : "bg-white/[0.035] text-transparent hover:bg-white/[0.1]"
                        }`}
                      >
                        {c ? CELL[c].text : "·"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Islands: the 12-slot board ---------- */

export function IslandsWidget({ value, onChange, types, disabled }: { value: unknown; onChange: (v: { islands: Record<string, Island> }) => void; types: TypesData; disabled?: boolean }) {
  const { islands } = asIslands(value);
  const mains = mainsOf(types);
  const live = types.sources.filter((s) => mains.includes(s));
  const elements = live.length ? live : mains;
  const used = Object.values(islands).map((i) => i.element).filter(Boolean);
  const set = (id: string, patch: Island) => onChange({ islands: { ...islands, [id]: { ...islands[id], ...patch } } });

  const groups: { name: string; slots: typeof ISLAND_SLOTS }[] = [];
  ISLAND_SLOTS.forEach((s) => {
    const g = groups[groups.length - 1];
    if (g && g.name === s.group) g.slots.push(s);
    else groups.push({ name: s.group, slots: [s] });
  });

  return (
    <div className="space-y-3">
      {elements.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-white/10 p-3 text-[12.5px] text-stone-400">
          Elements come from your type list. Do <b className="text-stone-200">Pick the type list</b> first.
        </p>
      ) : null}
      {groups.map((g) => {
        const open = g.slots.length > 1;
        return (
          <div key={g.name}>
            <p className={`${label} mb-1.5 ${open ? "text-[#93B0FF]" : ""}`}>
              {g.name}
              {open ? " · any order" : " · fixed story island"}
            </p>
            <div className={`grid gap-2 ${open ? "sm:grid-cols-3" : "sm:grid-cols-3"}`}>
              {g.slots.map((s) => {
                const i = islands[s.id] ?? {};
                const complete = !!(i.element && i.biome?.trim() && i.stone && i.mons);
                return (
                  <div
                    key={s.id}
                    className={`rounded-[12px] p-3 transition-shadow duration-200 ${open ? "" : "sm:col-start-2"} ${
                      complete
                        ? "bg-emerald-400/[0.05] shadow-[inset_0_0_0_1.5px_rgba(52,211,153,0.35)]"
                        : "bg-white/[0.03] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[13px] font-medium text-stone-100">{s.label}</span>
                      {complete ? <Tick /> : null}
                    </div>
                    <div className="space-y-1.5">
                      <Select
                        label="Element"
                        placeholder="Element…"
                        value={i.element}
                        disabled={disabled}
                        onChange={(v) => set(s.id, { element: v })}
                        items={elements.map((t) => ({ value: t, label: t, hint: used.includes(t) && i.element !== t ? "used" : undefined }))}
                      />
                      <input className={`${input} h-8 text-[12.5px]`} value={i.biome ?? ""} disabled={disabled} onChange={(e) => set(s.id, { biome: e.target.value })} placeholder="Biome, e.g. reef shallows" aria-label="Biome" />
                      <input className={`${input} h-8 text-[12.5px]`} value={i.inspiration ?? ""} disabled={disabled} onChange={(e) => set(s.id, { inspiration: e.target.value })} placeholder="Inspiration (bonus)" aria-label="Inspiration" />
                      <div className="grid grid-cols-2 gap-1.5">
                        <Select
                          label="Stone relationship"
                          placeholder="Stone…"
                          value={i.stone}
                          disabled={disabled}
                          onChange={(v) => set(s.id, { stone: v })}
                          items={STONE_RELATIONS.map((r) => ({ value: r, label: r }))}
                        />
                        <Select
                          label="Mons relationship"
                          placeholder="Mons…"
                          value={i.mons}
                          disabled={disabled}
                          onChange={(v) => set(s.id, { mons: v })}
                          items={MONS_RELATIONS.map((r) => ({ value: r, label: r }))}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
