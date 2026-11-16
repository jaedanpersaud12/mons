import { NextResponse } from "next/server";
import { extract, parseRef, type ContextSection } from "@/lib/sections";
import { listQuests, readDoc } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  try {
    const quest = (await listQuests()).find((q) => q.id === id);
    if (!quest) return NextResponse.json({ error: "Unknown quest" }, { status: 404 });
    const refs = quest.context ?? [];
    const cache = new Map<string, string | null>();
    const sections: ContextSection[] = [];
    for (const ref of refs) {
      const { file } = parseRef(ref);
      if (!cache.has(file)) {
        try {
          cache.set(file, (await readDoc(file)).text);
        } catch {
          cache.set(file, null);
        }
      }
      const text = cache.get(file);
      sections.push(
        text == null
          ? { ref, file, heading: null, trail: [], markdown: "", missing: true }
          : extract(ref, text),
      );
    }
    return NextResponse.json({ sections });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
