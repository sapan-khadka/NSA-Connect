/**
 * Tiny className joiner for design-system components.
 * Avoids adding a dependency for a one-liner used by base UI.
 */
export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
