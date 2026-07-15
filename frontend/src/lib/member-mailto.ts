/**
 * Open the OS mail client for a member email (no in-app messaging).
 */

export function memberMailtoHref(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  if (!trimmed) {
    return null;
  }
  return `mailto:${trimmed}`;
}
