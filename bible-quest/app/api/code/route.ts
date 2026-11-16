import { NextResponse } from "next/server";
import { currentCode, rollbackCode, summarise } from "@/lib/code-store";

export const dynamic = "force-dynamic";

// The live UI for a quest: current source plus its version list.
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const found = await currentCode(id);
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ...summarise(found.entry), version: found.cur.v, source: found.cur.source }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const { id, version } = await request.json();
    const by = request.headers.get("x-client-id") ?? undefined;
    return NextResponse.json(await rollbackCode(String(id), Number(version), by));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
