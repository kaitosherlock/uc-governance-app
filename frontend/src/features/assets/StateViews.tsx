import { AlertCircle, AlertTriangle, Database, Info, RefreshCw } from "lucide-react";
import type { Meta } from "@contracts/types";
import { describeError, isAbortError } from "@/api/errors";
import { strings } from "@/lib/strings";

interface IdleViewProps {
  title?: string | undefined;
  description?: string | undefined;
}

export function IdleView({
  title = strings.assets.states.idleTitle,
  description = strings.assets.states.idleDescription,
}: IdleViewProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-[var(--space-12)] border border-dashed border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] bg-[var(--color-neutral-0)] my-[var(--space-4)]">
      <div className="p-3 bg-[var(--color-neutral-1)] rounded-full text-[var(--color-icon-muted)] mb-[var(--space-3)]">
        <Database className="w-8 h-8" aria-hidden="true" />
      </div>
      <h2 className="text-[var(--text-md)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
        {title}
      </h2>
      <p className="mt-[var(--space-2)] text-[var(--text-sm)] text-[var(--color-text-secondary)] max-w-[50ch]">
        {description}
      </p>
    </div>
  );
}

interface ErrorViewProps {
  error: unknown;
  onRetry?: (() => void) | undefined;
  compact?: boolean | undefined;
  className?: string | undefined;
}

export function ErrorView({
  error,
  onRetry,
  compact = false,
  className = "",
}: ErrorViewProps) {
  // An aborted request is not an error and must never render as one
  if (isAbortError(error)) {
    return null;
  }

  const desc = describeError(error);

  if (compact) {
    return (
      <div
        role="alert"
        className={`p-3 border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] rounded-[var(--radius-control)] text-[var(--color-text-primary)] my-1.5 ${className}`}
      >
        <div className="flex items-start gap-2">
          <AlertCircle
            className="w-4 h-4 text-[var(--color-danger)] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <div className="text-[var(--text-xs)] font-[var(--weight-semibold)] text-[var(--color-danger)]">
              {desc.title}
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)] leading-tight">
              {desc.body}
            </p>

            {desc.nextSteps.length > 0 ? (
              <div className="mt-2">
                <span className="text-[10px] font-[var(--weight-semibold)] text-[var(--color-text-primary)] uppercase tracking-wide">
                  {strings.errors.nextStepsPrefix}
                </span>
                <ul className="mt-0.5 list-disc list-inside text-[11px] text-[var(--color-text-secondary)] space-y-0.5">
                  {desc.nextSteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {desc.correlationId ? (
              <details className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                <summary className="cursor-pointer font-[var(--weight-medium)] hover:underline focus:outline-none">
                  {strings.context.errorDetails}
                </summary>
                <div className="mt-1 font-[var(--font-mono)] text-[10px] bg-[var(--color-neutral-0)]/60 p-1.5 rounded border border-[var(--color-danger)]/20 inline-block max-w-full overflow-x-auto">
                  <span>{strings.errors.correlationPrefix} </span>
                  <span className="select-all break-all">{desc.correlationId}</span>
                </div>
              </details>
            ) : null}

            {onRetry ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-[var(--radius-control)] text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-neutral-0)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-neutral-1)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] focus:ring-offset-1"
                >
                  <RefreshCw className="w-3 h-3" aria-hidden="true" />
                  <span>{strings.common.retry}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`p-[var(--space-5)] border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] rounded-[var(--radius-panel)] text-[var(--color-text-primary)] my-[var(--space-4)] ${className}`}
    >
      <div className="flex items-start gap-[var(--space-3)]">
        <AlertCircle
          className="w-5 h-5 text-[var(--color-danger)] shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-[var(--text-base)] font-[var(--weight-semibold)] text-[var(--color-danger)]">
            {desc.title}
          </h2>
          <p className="mt-1 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            {desc.body}
          </p>

          {desc.nextSteps.length > 0 ? (
            <div className="mt-3">
              <span className="text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-primary)] uppercase tracking-wide">
                {strings.errors.nextStepsPrefix}
              </span>
              <ul className="mt-1 list-disc list-inside text-[var(--text-sm)] text-[var(--color-text-secondary)] space-y-0.5">
                {desc.nextSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {desc.correlationId ? (
            <details className="mt-3 text-[var(--text-xs)] text-[var(--color-text-muted)]">
              <summary className="cursor-pointer font-[var(--weight-medium)] hover:underline focus:outline-none">
                {strings.context.errorDetails}
              </summary>
              <div className="mt-1 font-[var(--font-mono)] bg-[var(--color-neutral-0)]/60 p-2 rounded border border-[var(--color-danger)]/20 inline-block">
                <span>{strings.errors.correlationPrefix} </span>
                <span className="select-all">{desc.correlationId}</span>
              </div>
            </details>
          ) : null}

          {onRetry ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-[var(--space-1)] px-[var(--space-3)] py-1.5 rounded-[var(--radius-control)] text-[var(--text-sm)] font-[var(--weight-medium)] bg-[var(--color-neutral-0)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-neutral-1)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] focus:ring-offset-1"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{strings.common.retry}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CompactErrorView(props: Omit<ErrorViewProps, "compact">) {
  return <ErrorView {...props} compact />;
}

interface LimitationsViewProps {
  meta: Meta | undefined;
}

export function LimitationsView({ meta }: LimitationsViewProps) {
  if (!meta) return null;

  const isPartial = meta.completeness !== "complete";
  const hasLimitations = meta.limitations && meta.limitations.length > 0;

  if (!isPartial && !hasLimitations) return null;

  return (
    <div className="mt-[var(--space-6)] pt-[var(--space-4)] border-t border-[var(--color-border-subtle)] space-y-[var(--space-2)]">
      {isPartial ? (
        <div
          role="status"
          className="flex items-center gap-[var(--space-2)] p-[var(--space-2)] px-[var(--space-3)] rounded-[var(--radius-control)] bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30 text-[var(--text-xs)] text-[var(--color-warning)] font-[var(--weight-medium)]"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{strings.assets.states.completenessNotice}</span>
          <span className="font-[var(--font-mono)] text-[11px] opacity-80">
            ({meta.completeness})
          </span>
        </div>
      ) : null}

      {hasLimitations ? (
        <div className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
          <span className="font-[var(--weight-medium)] text-[var(--color-text-secondary)]">
            {strings.assets.states.limitationsHeading}
          </span>
          <ul className="mt-1 list-disc list-inside space-y-0.5">
            {meta.limitations.map((limitation, i) => (
              <li key={i}>{limitation}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

interface EmptySuccessViewProps {
  message: string;
  meta?: Meta | undefined;
}

export function EmptySuccessView({ message, meta }: EmptySuccessViewProps) {
  return (
    <div className="py-[var(--space-8)] px-[var(--space-4)] text-center my-[var(--space-2)]">
      <div className="inline-flex p-2.5 rounded-full bg-[var(--color-neutral-2)] text-[var(--color-icon-muted)] mb-2">
        <Info className="w-5 h-5" aria-hidden="true" />
      </div>
      <p className="text-[var(--text-base)] text-[var(--color-text-secondary)] max-w-[60ch] mx-auto">
        {message}
      </p>
      {meta ? <LimitationsView meta={meta} /> : null}
    </div>
  );
}

export function LocalizedSkeleton({ className = "" }: { className?: string | undefined }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-[var(--color-neutral-2)] rounded-[var(--radius-control)] ${className}`}
    />
  );
}
