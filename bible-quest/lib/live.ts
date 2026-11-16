"use client";

// Realtime sync between devices. Every write bumps a row in `revisions`; every
// open copy of the app subscribes to that table through Neon Realtime and
// refetches whatever another device changed.
import { useEffect, useRef, useState } from "react";
import { createRealtimeClient, type SealedLiveQuery } from "@neon/realtime/client";

type Row = { scope: string; rev: string | number; by_client: string | null };
export type LiveStatus = "off" | "connecting" | "live" | "stale" | "error";

export const CLIENT_ID =
  typeof window === "undefined"
    ? "server"
    : (window.sessionStorage?.getItem("bq-client") ??
      (() => {
        const id = Math.random().toString(36).slice(2, 10);
        try {
          window.sessionStorage.setItem("bq-client", id);
        } catch {}
        return id;
      })());

// Tag our own API writes so we don't react to our own echoes.
if (typeof window !== "undefined" && !(window as unknown as { __bqFetch?: boolean }).__bqFetch) {
  (window as unknown as { __bqFetch?: boolean }).__bqFetch = true;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("/api/") || url.startsWith(window.location.origin + "/api/")) {
      const headers = new Headers(init?.headers);
      headers.set("x-client-id", CLIENT_ID);
      return original(input, { ...init, headers });
    }
    return original(input, init);
  };
}

const listeners = new Set<(scopes: string[]) => void>();
const statusListeners = new Set<(s: LiveStatus) => void>();
let status: LiveStatus = "off";
let started = false;

function setStatus(s: LiveStatus) {
  status = s;
  statusListeners.forEach((l) => l(s));
}

async function fetchSealed(): Promise<{ enabled: boolean; url?: string; sealed?: SealedLiveQuery<Row> }> {
  const r = await fetch("/api/live", { cache: "no-store" });
  if (!r.ok) throw new Error("live endpoint failed");
  return r.json();
}

async function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  let info;
  try {
    info = await fetchSealed();
  } catch {
    started = false;
    return;
  }
  if (!info.enabled || !info.url || !info.sealed) return;
  setStatus("connecting");

  const client = createRealtimeClient({ url: info.url });
  const sub = client.subscribe(info.sealed);
  const revs = new Map<string, string>();
  let initialised = false;

  sub.onChange((snap) => {
    setStatus(snap.status === "closed" ? "off" : snap.status);
    if (!snap.data) return;
    const changed: string[] = [];
    for (const row of snap.data) {
      const rev = String(row.rev);
      const before = revs.get(row.scope);
      revs.set(row.scope, rev);
      if (initialised && before !== rev && row.by_client !== CLIENT_ID) changed.push(row.scope);
    }
    initialised = true;
    if (changed.length) listeners.forEach((l) => l(changed));
  });

  // Sealed queries last about a minute; renew before they expire.
  let expiresAt = info.sealed.expiresAt;
  const renew = async () => {
    try {
      const next = await fetchSealed();
      if (next.sealed) {
        expiresAt = next.sealed.expiresAt;
        await sub.renew(next.sealed);
      }
      setTimeout(renew, Math.max(1000, expiresAt - Date.now() - 10_000));
    } catch {
      if (sub.getState?.().status === "error") {
        client.close();
        started = false;
        setStatus("error");
        setTimeout(start, 5000);
        return;
      }
      setTimeout(renew, 2000);
    }
  };
  setTimeout(renew, Math.max(1000, expiresAt - Date.now() - 10_000));
}

/** Calls `onChange` with the scopes another device just changed: "quests", "notes:<id>", "doc:<path>". */
export function useLive(onChange: (scopes: string[]) => void) {
  const ref = useRef(onChange);
  ref.current = onChange;
  useEffect(() => {
    start();
    const l = (scopes: string[]) => ref.current(scopes);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
}

export function useLiveStatus() {
  const [s, setS] = useState<LiveStatus>(status);
  useEffect(() => {
    start();
    statusListeners.add(setS);
    setS(status);
    return () => {
      statusListeners.delete(setS);
    };
  }, []);
  return s;
}
