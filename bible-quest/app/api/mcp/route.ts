import { createMcpHandler } from "mcp-handler";
import { registerBibleTools } from "@/lib/mcp-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => registerBibleTools(server),
  {
    serverInfo: { name: "bible-quest", version: "0.2.0" },
    instructions:
      "This is the game bible for Jaedan's creature RPG (tropical island chain, 12 awakenings, a lost bond). Call bible_overview first. Work one decision at a time with Jaedan: propose, let him choose, then write. Only lock_quest once he has agreed.",
  },
);

// Token from MCP_TOKEN (falls back to APP_PASSCODE). Send it as `Authorization: Bearer <token>`
// or put it in the URL as ?key=<token> for clients that can't set headers.
function allowed(request: Request) {
  const token = process.env.MCP_TOKEN || process.env.APP_PASSCODE;
  if (!token) return true;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const key = new URL(request.url).searchParams.get("key");
  return header === token || key === token;
}

async function guarded(request: Request) {
  if (!allowed(request)) {
    return new Response(JSON.stringify({ error: "Bad or missing MCP token" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return handler(request);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
