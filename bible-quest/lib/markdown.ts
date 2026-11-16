// Rendering pipeline ported from the Markdown Reader artifact:
// markdown-it (html, linkify) + footnotes, sanitised with DOMPurify,
// then the reader's DOM pass: heading ids, code bars, wrapped tables,
// task checkboxes, [!NOTE]-style callouts and external links.
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import DOMPurify from "dompurify";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
md.use(footnote);
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const lang = (token.info || "").trim().split(/\s+/)[0].toLowerCase();
  return `<pre data-lang="${escape(lang)}"><code>${escape(token.content)}</code></pre>\n`;
};

export function slug(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-");
}

function stripFrontMatter(text: string) {
  const m = /^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text.replace(/^﻿/, ""));
  return m ? text.slice(m[0].length) : text;
}

export function renderMarkdown(text: string, idPrefix = ""): string {
  const raw = md.render(stripFrontMatter(text));
  if (typeof window === "undefined") return raw;

  const clean = DOMPurify.sanitize(raw, {
    ADD_ATTR: ["target", "data-lang"],
    FORBID_TAGS: ["style", "form", "input", "textarea", "button", "select"],
  });
  const root = document.createElement("div");
  root.innerHTML = clean;

  const seen = new Map<string, number>();
  root.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
    let id = slug(h.textContent || "") || "section";
    const n = seen.get(id) || 0;
    seen.set(id, n + 1);
    if (n) id = `${id}-${n}`;
    h.id = idPrefix + id;
  });

  root.querySelectorAll("pre").forEach((pre) => {
    const wrap = document.createElement("div");
    wrap.className = "code";
    const bar = document.createElement("div");
    bar.className = "code-bar";
    const lang = document.createElement("span");
    lang.textContent = (pre as HTMLElement).dataset.lang || "text";
    bar.append(lang);
    pre.replaceWith(wrap);
    wrap.append(bar, pre);
  });

  root.querySelectorAll("table").forEach((table) => {
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    table.replaceWith(wrap);
    wrap.append(table);
  });

  root.querySelectorAll("li").forEach((li) => {
    const first = li.firstChild;
    const textNode = first && first.nodeName === "P" ? first.firstChild : first;
    if (!textNode || textNode.nodeType !== 3) return;
    const m = /^\[([ xX])\]\s+/.exec(textNode.nodeValue || "");
    if (!m) return;
    textNode.nodeValue = (textNode.nodeValue || "").slice(m[0].length);
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = m[1] !== " ";
    box.disabled = true;
    box.setAttribute("aria-label", "Task");
    const body = document.createElement("div");
    while (li.firstChild) body.append(li.firstChild);
    li.append(box, body);
    li.classList.add("task");
    li.classList.toggle("done", box.checked);
  });

  root.querySelectorAll("blockquote").forEach((bq) => {
    const p = bq.firstElementChild;
    const t = p?.firstChild;
    if (!p || p.tagName !== "P" || !t || t.nodeType !== 3) return;
    const m = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(t.nodeValue || "");
    if (!m) return;
    t.nodeValue = (t.nodeValue || "").slice(m[0].length);
    if (!t.nodeValue && t.nextSibling?.nodeName === "BR") t.nextSibling.remove();
    if (!p.textContent?.trim() && !p.children.length) p.remove();
    const kind = m[1].toLowerCase();
    const alert = document.createElement("div");
    alert.className = `alert alert-${kind}`;
    const title = document.createElement("div");
    title.className = "alert-title";
    title.textContent = kind;
    alert.append(title);
    while (bq.firstChild) alert.append(bq.firstChild);
    bq.replaceWith(alert);
  });

  root.querySelectorAll("a[href]").forEach((a) => {
    if (/^https?:/i.test(a.getAttribute("href") || "")) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    }
  });

  return root.innerHTML;
}
