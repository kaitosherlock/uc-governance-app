/**
 * PageHeader.tsx — Presentational page header with an h1 heading.
 *
 * Every route renders this to provide a heading structure. The title is
 * rendered as an h1, with an optional description paragraph and a slot
 * on the right for future action buttons.
 */
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-[var(--space-4)] px-[var(--space-6)] py-[var(--space-5)] border-b border-[var(--color-border-subtle)]">
      <div className="min-w-0">
        <h1
          className="text-[var(--text-xl)] font-[var(--weight-semibold)] text-[var(--color-text-primary)] leading-[var(--leading-snug)]"
          style={{ textWrap: "balance" }}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-[var(--space-1)] text-[var(--text-base)] text-[var(--color-text-secondary)] max-w-[70ch]">
            {description}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="shrink-0 flex items-center gap-[var(--space-2)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}
