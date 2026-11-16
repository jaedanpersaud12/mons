import { NextResponse } from "next/server";
import { listDocs } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ docs: await listDocs() });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
