import { NextResponse } from "next/server";
import { createRealtime, rawSql } from "@neon/realtime/server";

export const dynamic = "force-dynamic";

type Row = { scope: string; rev: string; by_client: string | null };

let realtime: ReturnType<typeof createRealtime> | null = null;

// Seals the one live query every open copy of Bible Quest subscribes to:
// a revision counter per quest list, notes entry and doc.
export async function GET() {
  const secret = process.env.NEON_REALTIME_SECRET;
  const url = process.env.NEON_REALTIME_URL;
  const dbUrl = process.env.DATABASE_URL;
  if (!secret || !url || !dbUrl) return NextResponse.json({ enabled: false });
  realtime ??= createRealtime({ secret, db: new URL(dbUrl).pathname.slice(1) || "neondb" });
  const sealed = await realtime.seal({ query: rawSql<Row>("SELECT scope, rev, by_client FROM revisions") });
  return NextResponse.json({ enabled: true, url, sealed }, { headers: { "Cache-Control": "no-store" } });
}
