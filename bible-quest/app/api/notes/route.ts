import { NextResponse } from "next/server";
import { getNotes, putNotes } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const quest = new URL(request.url).searchParams.get("quest");
  if (!quest) return NextResponse.json({ error: "Missing quest" }, { status: 400 });
  return NextResponse.json(await getNotes(quest));
}

export async function PUT(request: Request) {
  try {
    const { quest, overall, notes, data } = await request.json();
    const by = request.headers.get("x-client-id") ?? undefined;
    if (!quest) return NextResponse.json({ error: "Missing quest" }, { status: 400 });
    await putNotes(String(quest), { overall: String(overall ?? ""), notes: Array.isArray(notes) ? notes : [], ...(data != null ? { data } : {}) }, by);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }
}
