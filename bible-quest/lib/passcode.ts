// A single passcode guards the deployed app. Unset APP_PASSCODE to turn it off (local dev).
export const COOKIE = "bq_pass";

export async function passToken(passcode: string) {
  const data = new TextEncoder().encode(`bible-quest:${passcode}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
