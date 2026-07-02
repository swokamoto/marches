/**
 * Converts a display name into a URL-safe slug.
 * - Lowercases
 * - Strips characters that aren't alphanumeric, spaces, or hyphens
 * - Collapses whitespace and repeated hyphens to a single hyphen
 * - Trims leading/trailing hyphens
 * - Limits to 60 characters
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
