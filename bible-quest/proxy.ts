import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, passToken } from "@/lib/passcode";

export async function proxy(request: NextRequest) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return NextResponse.next();
  const cookie = request.cookies.get(COOKIE)?.value;
  if (cookie && cookie === (await passToken(passcode))) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico).*)"],
};
