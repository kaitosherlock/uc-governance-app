import { useId } from "react";
import { Link } from "react-router";
import type { AllowedAction } from "@contracts/types";
import { ArrowUpRight, Lock } from "lucide-react";
import { strings } from "@/lib/strings";

interface AssetActionControlProps {
  action: AllowedAction;
  onExecute?: ((actionName: string) => void) | undefined;
}

function getActionLabel(actionName: string): string {
  switch (actionName) {
    case "grant":
      return strings.assets.actions.grant;
    case "revoke":
      return strings.assets.actions.revoke;
    case "edit_metadata":
      return strings.assets.actions.editMetadata;
    case "delete":
      return strings.assets.actions.delete;
    case "transfer_ownership":
      return strings.assets.actions.transferOwnership;
    default:
      return actionName;
  }
}

export function AssetActionControl({
  action,
  onExecute,
}: AssetActionControlProps) {
  const reasonId = useId();
  const label = getActionLabel(action.action);

  // If navigate_to is present, render a link per spec
  if (action.navigate_to) {
    return (
      <Link
        to={action.navigate_to}
        className="inline-flex items-center gap-[var(--space-1)] px-[var(--space-3)] py-[6px] rounded-[var(--radius-control)] text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] focus:ring-offset-2"
        title={action.reason ?? strings.assets.actions.viewPermissionsAtSource}
      >
        <span>{strings.assets.actions.viewPermissionsAtSource}</span>
        <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    );
  }

  const isDisabled = !action.allowed;
  const reason =
    action.reason ?? action.reason_code ?? strings.assets.actions.notAllowed;

  return (
    <div className="relative inline-flex flex-col items-start group">
      <button
        type="button"
        disabled={isDisabled}
        aria-describedby={isDisabled ? reasonId : undefined}
        onClick={() => {
          if (!isDisabled && onExecute) {
            onExecute(action.action);
          }
        }}
        className={`inline-flex items-center gap-[var(--space-1)] px-[var(--space-3)] py-[6px] rounded-[var(--radius-control)] text-[var(--text-sm)] font-[var(--weight-medium)] border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] focus:ring-offset-2 ${
          isDisabled
            ? "border-[var(--color-border-subtle)] bg-[var(--color-neutral-2)] text-[var(--color-text-muted)] cursor-not-allowed opacity-75"
            : action.action === "delete"
              ? "border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
              : "border-[var(--color-border-strong)] bg-[var(--color-neutral-0)] text-[var(--color-text-primary)] hover:bg-[var(--color-neutral-1)]"
        }`}
      >
        {isDisabled ? (
          <Lock className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
        ) : null}
        <span>{label}</span>
      </button>

      {/* Accessible reason text for assistive technology and visual disclosure */}
      {isDisabled ? (
        <span
          id={reasonId}
          role="tooltip"
          className="mt-1 text-[11px] text-[var(--color-text-secondary)] max-w-[280px]"
        >
          {reason}
        </span>
      ) : null}
    </div>
  );
}
