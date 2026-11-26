const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

/** Allow only absolute http(s) and mailto links. Rejects scripts, data URLs, and relatives. */
export function safeMarkdownHref(href: string | undefined): string | null {
  if (!href) {
    return null;
  }
  const trimmed = href.trim();
  if (
    trimmed.length === 0 ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("\\") ||
    hasControlCharacter(trimmed)
  ) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
