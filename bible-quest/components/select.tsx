"use client";

// A form select built on interior.dev's Dropdown (useDropdown hook + its motion and styling).
// Differences from the stock Dropdown: the trigger shows the picked value, it fills its cell,
// and the menu renders in a portal at fixed position so drawers and scroll areas never clip it.
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useDropdown, type DropdownItem } from "@/components/interior/dropdown";

const EASE = [0.23, 1, 0.32, 1] as const;
const EXIT = [0.4, 0, 1, 1] as const;
const OPEN = { type: "spring", stiffness: 620, damping: 38, mass: 0.6 } as const;
const SLIDE = { type: "spring", stiffness: 700, damping: 46, mass: 0.5 } as const;
const NUDGE = SLIDE;
const CELL = { type: "spring", stiffness: 520, damping: 34, mass: 0.45 } as const;
const NONE = { duration: 0 } as const;
const ROW_H = 32;
const MAX_H = 232;

export type SelectItem = DropdownItem;

type Props = {
  items: SelectItem[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder: string;
  label: string;
  disabled?: boolean;
  /** Adds a "Clear" row at the top when something is picked. */
  clearable?: boolean;
  size?: "sm" | "md";
  className?: string;
};

const CLEAR = "__clear__";

export function Select({ items, value, onChange, placeholder, label, disabled, clearable = true, size = "sm", className = "" }: Props) {
  const reduced = useReducedMotion();
  const list = clearable && value ? [{ value: CLEAR, label: "Clear", hint: "none" }, ...items] : items;
  const dd = useDropdown({
    items: list,
    value: value ?? "",
    onChange: (v) => onChange(v === CLEAR ? undefined : v),
    disabled,
  });
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!dd.open) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = dd.triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const height = Math.min(MAX_H, list.length * ROW_H) + 12;
      const up = r.bottom + 6 + height > window.innerHeight && r.top - 6 - height > 0;
      const width = Math.max(r.width, 180);
      const left = Math.min(r.left, window.innerWidth - width - 8);
      setPos({ left, width, up, top: up ? r.top - 6 - height : r.bottom + 6 });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [dd.open, dd.triggerRef, list.length]);

  // The hook focuses the list on open; the portal can mount a beat later, so focus again once placed.
  useEffect(() => {
    if (dd.open && pos) dd.listProps.ref.current?.focus();
  }, [dd.open, pos, dd.listProps.ref]);

  const picked = items.find((i) => i.value === value);
  const h = size === "sm" ? "h-8 text-[12.5px]" : "h-9 text-[13px]";

  return (
    <div ref={dd.rootRef} className={`relative min-w-0 ${className}`}>
      <button
        {...dd.triggerProps}
        aria-label={`${label}: ${picked ? picked.label : placeholder}`}
        className={`flex w-full min-w-0 select-none items-center gap-2 rounded-[9px] border px-2.5 text-left font-medium outline-none transition-[box-shadow,border-color,background-color] duration-150 disabled:opacity-50 ${h} ${
          dd.open
            ? "border-white/20 bg-[#1D1D1A] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
            : "border-white/[0.12] bg-white/[0.04] shadow-[0_1px_6px_rgba(0,0,0,0.35)] hover:border-white/20 hover:bg-white/[0.06] focus-visible:border-white/30"
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${picked ? "text-stone-100" : "text-stone-500"}`}>{picked ? picked.label : placeholder}</span>
        {picked?.hint ? <span className="shrink-0 font-mono text-[10.5px] text-stone-500">{picked.hint}</span> : null}
        <motion.svg
          aria-hidden
          viewBox="0 0 12 12"
          className="size-3 shrink-0 text-stone-400"
          initial={false}
          animate={{ rotate: dd.open ? 180 : 0 }}
          transition={reduced ? NONE : NUDGE}
        >
          <path d="M3 4.75 6 7.75 9 4.75" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </button>
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {dd.open && (
                <motion.div
                  ref={dd.panelRef}
                  onKeyDown={(e) => e.stopPropagation()}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: pos?.up ? 8 : -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: pos?.up ? 6 : -6, transition: reduced ? NONE : { duration: 0.12, ease: EXIT } }}
                  transition={reduced ? NONE : { ...OPEN, opacity: { duration: 0.12, ease: EASE } }}
                  style={{ position: "fixed", left: pos?.left ?? 0, top: pos?.top ?? 0, minWidth: pos?.width ?? 180, visibility: pos ? "visible" : "hidden", transformOrigin: pos?.up ? "bottom left" : "top left" }}
                  className="dark z-[200] whitespace-nowrap rounded-[11px] border border-white/[0.16] bg-[#1D1D1A] p-[5px] shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
                >
                  <ul {...dd.listProps} aria-label={label} className="relative overflow-y-auto outline-none [scrollbar-gutter:stable]" style={{ maxHeight: MAX_H }}>
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-[7px] bg-white/10"
                      initial={false}
                      animate={{ y: dd.activeIndex < 0 ? 0 : dd.activeIndex * ROW_H, opacity: dd.activeIndex < 0 ? 0 : 1 }}
                      transition={reduced ? NONE : { ...SLIDE, opacity: { duration: 0.1, ease: EASE } }}
                    />
                    {list.map((item, i) => {
                      const active = i === dd.activeIndex && !item.disabled;
                      const sel = i === dd.selectedIndex;
                      const clear = item.value === CLEAR;
                      return (
                        <li
                          key={item.value}
                          {...dd.getItemProps(i)}
                          className={`relative flex h-8 cursor-default select-none items-center rounded-[7px] px-2.5 text-[13px] ${
                            item.disabled ? "text-stone-400/60" : clear ? "text-stone-400" : active ? "text-stone-100" : "text-stone-200"
                          }`}
                        >
                          <span className="relative flex min-w-0 flex-1 items-center gap-3">
                            <span className="truncate">{item.label}</span>
                            {item.hint ? <span className="ml-auto shrink-0 font-mono text-[10.5px] text-stone-500">{item.hint}</span> : null}
                          </span>
                          <motion.span
                            aria-hidden
                            initial={false}
                            animate={{ opacity: sel ? 1 : 0, scale: sel ? 1 : 0.7 }}
                            transition={reduced ? NONE : CELL}
                            className="relative ml-2 flex size-[14px] shrink-0 items-center justify-center"
                          >
                            <svg viewBox="0 0 14 14" className="size-[14px]">
                              <path d="M3 7.4 5.8 10.2 11 4.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </motion.span>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
