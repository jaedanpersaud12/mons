import { NextResponse } from "next/server";
import { ConflictError, readDoc, writeDoc } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rel = new URL(request.url).searchParams.get("path");
  if (!rel) return NextResponse.json({ error: "Missing path" }, { status: 400 });
  try {
    return NextResponse.json(await readDoc(rel));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 404 });
  }
}

export async function PUT(request: Request) {
  try {
    const { path, text, baseMtime } = await request.json();
    return NextResponse.json(await writeDoc(String(path), String(text ?? ""), baseMtime ?? null));
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message, current: error.current }, { status: 409 });
    }
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }
}
