import { NextResponse } from "next/server";
import { completeQuest, createSheet, listQuests, reopenQuest } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ quests: await listQuests() });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, id, answer, bonusXp, outputText } = await request.json();
    if (action === "complete") await completeQuest(id, String(answer ?? ""), Number(bonusXp) || 0, outputText ? String(outputText) : null);
    else if (action === "reopen") await reopenQuest(id);
    else if (action === "create-sheet") await createSheet(id);
    else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    return NextResponse.json({ quests: await listQuests() });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
