import { NextResponse } from "next/server";
import { COOKIE, passToken } from "@/lib/passcode";

export async function POST(request: Request) {
  const expected = process.env.APP_PASSCODE;
  const { passcode } = await request.json().catch(() => ({ passcode: "" }));
  if (!expected) return NextResponse.json({ ok: true });
  if (typeof passcode !== "string" || passcode !== expected) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await passToken(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
