/**
 * Split plain text into text + safe external links (XSS-safe; no raw HTML).
 * Only http(s) URLs are emitted as anchors.
 */

import type { ReactNode } from "react";

const URL_PATTERN =
  /https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+/gi;

function trimTrailingPunctuation(url: string): {
  href: string;
  trailing: string;
} {
  const match = /^(.*?)([),.!?;:]+)$/.exec(url);
  if (!match) {
    return { href: url, trailing: "" };
  }
  return { href: match[1], trailing: match[2] };
}

function safeHttpHref(raw: string): string | null {
  const { href: cleaned, trailing } = trimTrailingPunctuation(raw);
  const candidate = cleaned.startsWith("http") ? cleaned : `https://${cleaned}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    // Attach trailing punctuation separately via return shape below.
    void trailing;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function linkifyText(text: string): ReactNode[] {
  if (!text) {
    return [];
  }

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  const pattern = new RegExp(URL_PATTERN.source, URL_PATTERN.flags);
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) != null) {
    const raw = match[0];
    const start = match.index;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    const { href: cleaned, trailing } = trimTrailingPunctuation(raw);
    const href = safeHttpHref(cleaned);
    if (href) {
      nodes.push(
        <a
          key={`link-${start}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline underline-offset-2 break-all"
        >
          {cleaned}
        </a>,
      );
      if (trailing) {
        nodes.push(trailing);
      }
    } else {
      nodes.push(raw);
    }
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
