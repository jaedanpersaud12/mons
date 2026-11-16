"use client";

import { useMemo } from "react";
import { renderMarkdown } from "@/lib/markdown";

export function MdView({
  markdown,
  className = "",
  idPrefix = "",
}: {
  markdown: string;
  className?: string;
  idPrefix?: string;
}) {
  const inner = useMemo(() => ({ __html: renderMarkdown(markdown, idPrefix) }), [markdown, idPrefix]);
  return <div className={`md ${className}`} dangerouslySetInnerHTML={inner} />;
}
