// Pulls just the parts of a markdown doc a quest needs.
//   "11-story.md#Awakening rules"  -> that heading and everything under it
//   "11-story.md?match=Default"     -> only the lines and blocks that mention "Default",
//                                      grouped under the heading they sit in
//   "11-story.md"                   -> the whole file

export type ContextSection = {
  ref: string;
  file: string;
  heading: string | null;
  trail: string[];
  markdown: string;
  missing?: boolean;
};

type Heading = { line: number; level: number; text: string };

function headings(lines: string[]): Heading[] {
  const out: Heading[] = [];
  let fence = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    if (fence) return;
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l);
    if (m) out.push({ line: i, level: m[1].length, text: m[2] });
  });
  return out;
}

function trailFor(hs: Heading[], index: number) {
  const trail: string[] = [];
  let level = hs[index].level;
  for (let i = index - 1; i >= 0; i--) {
    if (hs[i].level < level && hs[i].level > 1) {
      trail.unshift(hs[i].text);
      level = hs[i].level;
    }
  }
  return trail;
}

export function parseRef(ref: string) {
  const [pathAndQuery, hash] = ref.split("#");
  const [file, query] = pathAndQuery.split("?");
  const match = query ? new URLSearchParams(query).get("match") : null;
  return { file, heading: hash ? decodeURIComponent(hash) : null, match };
}

const norm = (s: string) => s.toLowerCase().replace(/[*_`]/g, "").trim();

export function extract(ref: string, text: string): ContextSection {
  const { file, heading, match } = parseRef(ref);
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const hs = headings(lines);

  if (heading) {
    const want = norm(heading);
    const idx = hs.findIndex((h) => norm(h.text).startsWith(want));
    if (idx === -1) return { ref, file, heading, trail: [], markdown: "", missing: true };
    const h = hs[idx];
    const end = hs.slice(idx + 1).find((x) => x.level <= h.level);
    const body = lines.slice(h.line, end ? end.line : lines.length).join("\n").trim();
    return { ref, file, heading: h.text, trail: trailFor(hs, idx), markdown: body };
  }

  if (match) {
    const term = match.toLowerCase();
    const out: string[] = [];
    // walk leaf sections (heading to the next heading of any level)
    const bounds = [{ line: -1, level: 0, text: "" }, ...hs];
    bounds.forEach((h, i) => {
      const start = h.line + 1;
      const stop = i + 1 < bounds.length ? bounds[i + 1].line : lines.length;
      const chunk = lines.slice(start, stop);
      const blocks: string[] = [];
      let block: string[] = [];
      const flush = () => {
        if (block.length) blocks.push(block.join("\n"));
        block = [];
      };
      chunk.forEach((l) => (l.trim() ? block.push(l) : flush()));
      flush();
      if (h.level === 1) return;
      const headingHit = !!h.text && h.text.toLowerCase().includes(term);
      const hits: string[] = headingHit ? [...blocks] : [];
      if (!headingHit) blocks.forEach((b) => {
        const isList = b.split("\n").every((l) => /^\s*([-*+]|\d+\.)\s|^\s+\S/.test(l));
        const isTable = b.trimStart().startsWith("|");
        if (isList) {
          const items = b.split("\n").filter((l) => l.toLowerCase().includes(term));
          if (items.length) hits.push(items.join("\n"));
        } else if (isTable) {
          const rows = b.split("\n");
          const body = rows.slice(2).filter((r) => r.toLowerCase().includes(term));
          if (body.length) hits.push([rows[0], rows[1], ...body].join("\n"));
        } else if (b.toLowerCase().includes(term)) {
          hits.push(b);
        }
      });
      if (!hits.length) return;
      if (h.text) out.push(`${"#".repeat(Math.max(2, Math.min(h.level, 3)))} ${h.text}`);
      out.push(...hits);
    });
    return { ref, file, heading: `Everything marked “${match}”`, trail: [], markdown: out.join("\n\n") };
  }

  return { ref, file, heading: null, trail: [], markdown: text };
}
