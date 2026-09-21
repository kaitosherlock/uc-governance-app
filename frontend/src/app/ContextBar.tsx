/**
 * ContextBar.tsx — Persistent context bar across the top of the application.
 *
 * Presentational only. Takes context, identity, and loading as props.
 * No data fetching in this task (P0-04); that arrives in P0-05.
 *
 * Three states:
 * 1. loading=true → pulsing skeleton with "Loading workspace context" label.
 * 2. loading=false, context=null → static bar saying context not connected.
 * 3. context !== null → full bar with mode badge, environment, workspace,
 *    scope, actor, and executor.
 */
import type { Context, Identity, ModeLabel } from "@contracts/types";
import { cn } from "@/lib/cn";
import { strings } from "@/lib/strings";
import {
  FlaskConical,
  Eye,
  PenLine,
  Server,
  FolderTree,
  User,
  Bot,
} from "lucide-react";

interface ContextBarProps {
  context: Context | null;
  identity: Identity | null;
  loading: boolean;
}

/* ---- Mode badge config: icon + colour per mode ---- */

function getModeConfig(modeLabel: ModeLabel) {
  switch (modeLabel) {
    case "Demo — synthetic data":
      return {
        Icon: FlaskConical,
        colorClass: "text-[var(--color-mode-demo)] border-[var(--color-mode-demo)] bg-[var(--color-warning-bg)]",
      };
    case "Read-only":
      return {
        Icon: Eye,
        colorClass: "text-[var(--color-mode-readonly)] border-[var(--color-mode-readonly)] bg-[var(--color-info-bg)]",
      };
    case "Editing enabled":
      return {
        Icon: PenLine,
        colorClass: "text-[var(--color-mode-editing)] border-[var(--color-mode-editing)] bg-[var(--color-accent-light)]",
      };
  }
}

/* ---- Environment chip ---- */

function EnvironmentChip({ label }: { label: string }) {
  const isProd = label.toUpperCase() === "PROD" || label.toUpperCase() === "PRODUCTION";

  return (
    <span
      className={cn(
        "inline-flex items-center px-[var(--space-2)] py-[2px] text-[var(--text-xs)] font-[var(--weight-medium)] rounded-[var(--radius-control)]",
        isProd
          ? "text-[var(--color-danger)] border-2 border-dashed border-[var(--color-danger)] bg-[var(--color-danger-bg)]"
          : "text-[var(--color-text-secondary)] border border-[var(--color-border-strong)] bg-[var(--color-neutral-1)]",
      )}
    >
      {label}
    </span>
  );
}

/* ---- Skeleton for loading state (state 1) ---- */

function ContextBarSkeleton() {
  return (
    <header
      className="flex items-center gap-[var(--space-4)] h-12 px-[var(--space-4)] border-b border-[var(--color-border-strong)] bg-[var(--color-neutral-0)]"
      aria-label={strings.context.barLoadingLabel}
      role="banner"
    >
      <div className="h-6 w-40 rounded-[var(--radius-control)] bg-[var(--color-neutral-2)] animate-pulse" />
      <div className="h-5 w-12 rounded-[var(--radius-control)] bg-[var(--color-neutral-2)] animate-pulse" />
      <div className="flex-1" />
      <div className="h-4 w-36 rounded bg-[var(--color-neutral-2)] animate-pulse" />
      <div className="h-4 w-24 rounded bg-[var(--color-neutral-2)] animate-pulse" />
      <div className="h-4 w-32 rounded bg-[var(--color-neutral-2)] animate-pulse" />
      <div className="h-4 w-32 rounded bg-[var(--color-neutral-2)] animate-pulse" />
    </header>
  );
}

/* ---- Not-connected state (state 2) ---- */

function ContextBarNotConnected() {
  return (
    <header
      className="flex items-center h-12 px-[var(--space-4)] border-b border-[var(--color-border-strong)] bg-[var(--color-neutral-0)]"
      aria-label={strings.context.barLabel}
      role="banner"
    >
      <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
        {strings.context.notConnected}
      </span>
    </header>
  );
}

/* ---- Main component ---- */

export function ContextBar({ context, identity, loading }: ContextBarProps) {
  /* State 1: actively loading */
  if (loading) {
    return <ContextBarSkeleton />;
  }

  /* State 2: not loading, but no context data yet */
  if (!context) {
    return <ContextBarNotConnected />;
  }

  /* State 3: context available */
  const modeConfig = getModeConfig(context.mode_label);
  const ModeIcon = modeConfig.Icon;

  const scopeDisplay =
    context.managed_catalogs.length > 0
      ? context.managed_catalogs.join(", ")
      : strings.context.noScope;

  return (
    <header
      className="flex items-center gap-[var(--space-3)] h-12 px-[var(--space-4)] border-b border-[var(--color-border-strong)] bg-[var(--color-neutral-0)] overflow-x-auto"
      aria-label={strings.context.barLabel}
      role="banner"
    >
      {/* Mode badge — icon + text, never colour alone */}
      <span
        className={cn(
          "inline-flex items-center gap-[var(--space-1)] shrink-0 px-[var(--space-2)] py-[2px] text-[var(--text-xs)] font-[var(--weight-medium)] border rounded-[var(--radius-control)]",
          modeConfig.colorClass,
        )}
      >
        <ModeIcon size={14} aria-hidden="true" />
        {context.mode_label}
      </span>

      {/* Environment chip — rendered as visible text, no title-only */}
      <EnvironmentChip label={context.environment_label} />

      {/* Visual separator */}
      <span className="w-px h-5 bg-[var(--color-border-subtle)] shrink-0" aria-hidden="true" />

      {/* Workspace host */}
      <span
        className="shrink-0 text-[var(--text-xs)] text-[var(--color-text-muted)] flex items-center gap-[var(--space-1)]"
      >
        <Server size={13} aria-hidden="true" className="text-[var(--color-icon-muted)]" />
        <span className="truncate max-w-48">{context.workspace_host}</span>
      </span>

      {/* Managed scope */}
      <span
        className="shrink-0 text-[var(--text-xs)] text-[var(--color-text-muted)] flex items-center gap-[var(--space-1)]"
      >
        <FolderTree size={13} aria-hidden="true" className="text-[var(--color-icon-muted)]" />
        <span className="truncate max-w-36">{scopeDisplay}</span>
      </span>

      {/* Spacer */}
      <div className="flex-1 min-w-[var(--space-2)]" />

      {/* Actor */}
      {identity && (
        <span
          className="shrink-0 text-[var(--text-xs)] text-[var(--color-text-secondary)] flex items-center gap-[var(--space-1)]"
        >
          <User size={13} aria-hidden="true" className="text-[var(--color-icon-muted)]" />
          <span className="truncate max-w-40">{identity.actor.display}</span>
        </span>
      )}

      {/* Executor — shown as a clearly separate item */}
      {identity && (
        <span
          className="shrink-0 text-[var(--text-xs)] text-[var(--color-text-muted)] flex items-center gap-[var(--space-1)] border-l border-[var(--color-border-subtle)] pl-[var(--space-3)]"
        >
          <Bot size={13} aria-hidden="true" className="text-[var(--color-icon-muted)]" />
          <span className="truncate max-w-40">{identity.executor.display}</span>
        </span>
      )}
    </header>
  );
}
