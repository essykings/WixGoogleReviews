// The support search box on the Insights page: what is safe to put into a database filter.

/** A search word with filter-syntax characters removed. Empty when it is too short to search for. */
export function cleanSiteQuery(q: unknown): string {
  if (typeof q !== "string") return ""
  const v = q.replace(/[,()%*_"'\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100)
  return v.length >= 3 ? v : ""
}
