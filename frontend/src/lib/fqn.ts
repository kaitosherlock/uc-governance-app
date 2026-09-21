/**
 * fqn.ts — Helpers for fully qualified names (FQNs).
 *
 * Unity Catalog FQNs are dot-separated: catalog.schema.object
 * These utilities handle splitting, breadcrumb building, middle-truncation
 * for display, and URL-safe encoding.
 */

/** Individual segment of a fully qualified name with its level label. */
export interface FqnPart {
  label: string;
  segment: string;
  /** The FQN up to and including this segment */
  path: string;
}

/**
 * Split a dotted FQN into its constituent parts.
 * "sales.crm.orders" → [
 *   { label: "Catalog", segment: "sales", path: "sales" },
 *   { label: "Schema",  segment: "crm",   path: "sales.crm" },
 *   { label: "Object",  segment: "orders", path: "sales.crm.orders" },
 * ]
 */
export function splitFqn(fqn: string): FqnPart[] {
  const segments = fqn.split(".");
  const labels = ["Catalog", "Schema", "Object"];
  const parts: FqnPart[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment === undefined) continue;
    parts.push({
      label: labels[i] ?? "Part",
      segment,
      path: segments.slice(0, i + 1).join("."),
    });
  }

  return parts;
}

/**
 * Build a breadcrumb trail from an FQN.
 * Each crumb has a `label`, `segment`, and a `to` path suitable for
 * constructing a router link (e.g., "/assets/sales" or "/assets/sales/crm").
 */
export interface BreadcrumbItem {
  label: string;
  segment: string;
  to: string;
}

export function buildBreadcrumbs(fqn: string): BreadcrumbItem[] {
  const parts = splitFqn(fqn);
  return parts.map((part) => ({
    label: part.label,
    segment: part.segment,
    to: `/assets/${part.path.split(".").map(encodeURIComponent).join("/")}`,
  }));
}

/**
 * Middle-truncate a long name for display while keeping the full value
 * for the title attribute. Returns { display, full }.
 *
 * If the name is within maxLength, display === full.
 * Otherwise: first `keep` chars + "…" + last `keep` chars.
 */
export function middleTruncate(
  name: string,
  maxLength: number = 40,
  keep: number = 16,
): { display: string; full: string } {
  if (name.length <= maxLength) {
    return { display: name, full: name };
  }
  const start = name.slice(0, keep);
  const end = name.slice(-keep);
  return {
    display: `${start}…${end}`,
    full: name,
  };
}

/**
 * Encode an FQN for use as a single URL path segment.
 *
 * Dots in FQNs are meaningful (catalog.schema.object) and we map them
 * to `/` in the route. When an individual segment itself contains a dot
 * (rare but possible), call encodeURIComponent on each segment separately.
 *
 * This function takes a full FQN and returns the URL path portion:
 * "sales.crm.orders" → "sales/crm/orders"
 */
export function fqnToUrlSegments(fqn: string): string {
  return fqn
    .split(".")
    .map(encodeURIComponent)
    .join("/");
}

/**
 * Reconstruct an FQN from URL path segments.
 * ["sales", "crm", "orders"] → "sales.crm.orders"
 */
export function urlSegmentsToFqn(segments: string[]): string {
  return segments.map(decodeURIComponent).join(".");
}
