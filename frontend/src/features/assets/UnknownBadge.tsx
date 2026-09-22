import { strings } from "@/lib/strings";

interface UnknownBadgeProps {
  value: string;
  className?: string | undefined;
}

/**
 * Renders an unknown enum value verbatim paired with an "Unknown" badge.
 * Guarantees that unrecognized enum values from the server never crash the UI.
 */
export function UnknownBadge({ value, className = "" }: UnknownBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-[var(--space-1)] px-[var(--space-2)] py-[2px] rounded-[var(--radius-control)] text-[var(--text-xs)] font-[var(--weight-medium)] font-[var(--font-mono)] bg-[var(--color-unknown-bg)] text-[var(--color-unknown)] border border-[var(--color-unknown)]/30 ${className}`}
      title={`${value} (${strings.assets.states.unknownBadge})`}
    >
      <span>{value}</span>
      <span className="text-[10px] uppercase tracking-wider px-1 py-[1px] rounded bg-[var(--color-unknown)] text-white font-sans font-semibold">
        {strings.assets.states.unknownBadge}
      </span>
    </span>
  );
}
