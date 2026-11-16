"use client";

import { useState } from "react";

export default function Login() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return setError("Enter the passcode");
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setBusy(false);
    if (!res.ok) return setError("That's not it");
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    window.location.href = next.startsWith("/") ? next : "/";
  };

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-[320px]">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">Bible Quest · mons</p>
        <h1 className="mt-1 text-[22px] font-medium text-stone-50">Passcode</h1>
        <input
          type="password"
          autoFocus
          value={passcode}
          onChange={(e) => {
            setPasscode(e.target.value);
            setError("");
          }}
          className="mt-4 h-10 w-full rounded-[9px] border border-white/[0.12] bg-black/25 px-3 text-[14px] text-stone-100 outline-none focus:border-[#93B0FF]/60"
          aria-invalid={!!error}
          aria-describedby="err"
        />
        <p id="err" className="mt-1.5 h-4 text-[12.5px] text-red-400">
          {error}
        </p>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 h-10 w-full rounded-[9px] bg-stone-100 text-[13.5px] font-medium text-stone-900 outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-[#93B0FF] disabled:opacity-60"
        >
          {busy ? "Checking…" : "Open the bible"}
        </button>
      </form>
    </main>
  );
}
