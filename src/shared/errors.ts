/** Wix Data says WDE0025 when a collection has not been created on the site yet (the app was never installed or updated as a real version). */
export function isMissingCollection(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('WDE0025') || /collection\s+(.*\s)?does not exist/i.test(msg);
}

/** A short, safe description for logs: long token-like strings are hidden. */
export function describeError(e: unknown): string {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return msg.replace(/[A-Za-z0-9_-]{40,}/g, '[hidden]').slice(0, 300);
}
