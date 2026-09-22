import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { middleTruncate } from "@/lib/fqn";
import { strings } from "@/lib/strings";

interface AssetBreadcrumbsProps {
  catalog?: string | undefined;
  schema?: string | undefined;
  objectType?: string | undefined;
  name?: string | undefined;
}

export function AssetBreadcrumbs({
  catalog,
  schema,
  objectType,
  name,
}: AssetBreadcrumbsProps) {
  const catalogTrunc = catalog ? middleTruncate(catalog, 28, 12) : null;
  const schemaTrunc = schema ? middleTruncate(schema, 28, 12) : null;
  const nameTrunc = name ? middleTruncate(name, 32, 14) : null;

  return (
    <nav
      aria-label={strings.assets.breadcrumbAriaLabel}
      className="flex items-center px-[var(--space-6)] py-[var(--space-3)] bg-[var(--color-neutral-1)] border-b border-[var(--color-border-subtle)] text-[var(--text-sm)] text-[var(--color-text-secondary)]"
    >
      <ol className="flex items-center flex-wrap gap-[var(--space-1)]">
        <li className="flex items-center">
          <Link
            to="/assets"
            className="font-[var(--weight-medium)] text-[var(--color-text-primary)] hover:text-[var(--color-accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] rounded-[var(--radius-control)] px-1"
          >
            {strings.assets.breadcrumbRoot}
          </Link>
        </li>

        {catalog && catalogTrunc ? (
          <li className="flex items-center gap-[var(--space-1)]">
            <ChevronRight className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
            <Link
              to={`/assets/${encodeURIComponent(catalog)}`}
              title={catalogTrunc.full}
              tabIndex={0}
              className={`font-[var(--font-mono)] hover:text-[var(--color-accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] rounded-[var(--radius-control)] px-1 ${
                !schema && !name
                  ? "font-[var(--weight-semibold)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
              aria-current={!schema && !name ? "page" : undefined}
            >
              {catalogTrunc.display}
            </Link>
          </li>
        ) : null}

        {catalog && schema && schemaTrunc ? (
          <li className="flex items-center gap-[var(--space-1)]">
            <ChevronRight className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
            <Link
              to={`/assets/${encodeURIComponent(catalog)}/${encodeURIComponent(schema)}`}
              title={schemaTrunc.full}
              tabIndex={0}
              className={`font-[var(--font-mono)] hover:text-[var(--color-accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] rounded-[var(--radius-control)] px-1 ${
                !name
                  ? "font-[var(--weight-semibold)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
              aria-current={!name ? "page" : undefined}
            >
              {schemaTrunc.display}
            </Link>
          </li>
        ) : null}

        {catalog && schema && objectType && name && nameTrunc ? (
          <li className="flex items-center gap-[var(--space-1)]">
            <ChevronRight className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
            <span
              title={nameTrunc.full}
              aria-label={nameTrunc.full}
              aria-current="page"
              className="font-[var(--font-mono)] font-[var(--weight-semibold)] text-[var(--color-text-primary)] rounded-[var(--radius-control)] px-1"
            >
              {nameTrunc.display}
            </span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}
