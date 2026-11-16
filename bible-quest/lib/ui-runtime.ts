// Builds the page that runs inside the sandboxed iframe for a live UI.
import { HTM_PREACT } from "./vendor/htm-preact";
import { KIT_CSS, RUNTIME_JS } from "./vendor/ui-runtime-src";

// Keeps "</script>" and "<!--" inside the source from ending the inline script.
const inline = (code: string) => code.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");

/**
 * The frame gets no network at all (CSP default-src 'none') and, through the iframe's
 * sandbox attribute, no access to the app's cookies, storage or DOM. Its only way out
 * is postMessage to the quest that hosts it.
 */
export function buildSrcDoc(source: string) {
  const csp = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:";
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\">",
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    `<style>${KIT_CSS}</style></head><body><div id="root"></div>`,
    `<script>${inline(HTM_PREACT)}</script>`,
    `<script>var SOURCE = ${inline(JSON.stringify(source))};\n${inline(RUNTIME_JS)}</script>`,
    "</body></html>",
  ].join("");
}
