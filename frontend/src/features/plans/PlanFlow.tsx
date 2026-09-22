import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type {
  ErrorCode,
  GrantChanges,
  MetadataChanges,
  Operation,
  OwnershipChanges,
  Plan,
  PlanChanges,
  PlanCreateRequest,
  PlanKind,
  PlanTargetInput,
} from "@contracts/types";
import { API_PATHS } from "@contracts/types";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, HelpCircle, RefreshCw, X } from "lucide-react";
import { apiGet } from "@/api/client";
import { ApiError } from "@/api/errors";
import { useCreatePlan, useExecutePlan, useReconcileOperation } from "@/api/queries";
import { strings } from "@/lib/strings";

export interface PlanFlowProps {
  kind: PlanKind;
  targets: PlanTargetInput[];
  initialChanges?: PlanChanges | undefined;
  accessRequestId?: string | null | undefined;
  isOpen?: boolean | undefined;
  onClose?: (() => void) | undefined;
  onSuccess?: ((operation: Operation) => void) | undefined;
  className?: string | undefined;
}

interface FormValues {
  reason: string;
  principal?: string;
  privilege?: string;
  privileges?: string[];
  new_owner?: string;
  comment?: string;
}

// Zod schema for input validation only per spec
const planFormSchema = z.object({
  reason: z
    .string()
    .min(3, strings.planFlow.form.reasonRequired)
    .max(200, strings.planFlow.form.reasonTooLong),
  principal: z.string().optional(),
  privilege: z.string().optional(),
  privileges: z.array(z.string()).optional(),
  new_owner: z.string().optional(),
  comment: z.string().optional(),
});

function getInitialFormValues(kind: PlanKind, changes?: PlanChanges): FormValues {
  const base: FormValues = { reason: "" };
  if (!changes) return base;

  if (kind === "grant" || kind === "revoke") {
    const gc = changes as GrantChanges;
    base.principal = gc.principal || "";
    base.privileges = gc.privileges || [];
    base.privilege = gc.privileges?.[0] || "";
  } else if (kind === "transfer_ownership") {
    const oc = changes as OwnershipChanges;
    base.new_owner = oc.new_owner || "";
  } else if (kind === "edit_metadata") {
    const mc = changes as MetadataChanges;
    base.comment = mc.comment || "";
  }
  return base;
}

export function PlanFlow({
  kind,
  targets,
  initialChanges,
  accessRequestId = null,
  isOpen = true,
  onClose,
  onSuccess,
  className = "",
}: PlanFlowProps) {
  const titleId = useId();
  const outcomeTitleId = useId();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Core Lifecycle States
  const [plan, setPlan] = useState<Plan | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [conflictError, setConflictError] = useState<{
    code: ErrorCode;
    message: string;
    correlationId?: string | null;
    nextSteps?: string[] | null | undefined;
  } | null>(null);
  const [typedConfirmationValue, setTypedConfirmationValue] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  // TanStack Query mutations
  const createPlanMutation = useCreatePlan();
  const executePlanMutation = useExecutePlan();
  const reconcileMutation = useReconcileOperation();

  // Form setup
  const initialValues = useMemo(
    () => getInitialFormValues(kind, initialChanges),
    [kind, initialChanges],
  );

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors: formErrors },
  } = useForm<FormValues>({
    defaultValues: initialValues,
  });

  // Watch form fields: ANY change to form inputs collapses preview per Spec Requirement 5
  const watchedValues = watch();
  const lastSubmittedValuesRef = useRef<FormValues | null>(null);

  useEffect(() => {
    if (!plan) return;
    const submitted = lastSubmittedValuesRef.current;
    if (!submitted) return;

    const hasChanged =
      watchedValues.reason !== submitted.reason ||
      watchedValues.principal !== submitted.principal ||
      watchedValues.privilege !== submitted.privilege ||
      watchedValues.new_owner !== submitted.new_owner ||
      watchedValues.comment !== submitted.comment;

    if (hasChanged) {
      // Invalidate preview immediately when inputs change
      setPlan(null);
      setConflictError(null);
      setTypedConfirmationValue("");
    }
  }, [watchedValues, plan]);

  // Focus trap & Escape key management
  useEffect(() => {
    if (!isOpen) return;
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Esc must NOT dismiss a destructive confirmation per spec
        const isDestructive =
          plan?.requires_typed_confirmation === true || isExecuting;
        if (!isDestructive && onClose) {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key === "Tab" && containerRef.current) {
        const focusable = containerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, plan, isExecuting, onClose]);

  // Live countdown for plan expiration
  useEffect(() => {
    if (!plan?.expires_at) {
      setSecondsRemaining(null);
      return;
    }

    const computeSeconds = () => {
      const diffMs = new Date(plan.expires_at).getTime() - Date.now();
      return Math.max(0, Math.floor(diffMs / 1000));
    };

    setSecondsRemaining(computeSeconds());
    const interval = setInterval(() => {
      const remaining = computeSeconds();
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [plan?.expires_at]);

  const isExpired = secondsRemaining !== null && secondsRemaining <= 0;

  // Format seconds as MM:SS
  const countdownFormatted = useMemo(() => {
    if (secondsRemaining === null) return "";
    const m = Math.floor(secondsRemaining / 60);
    const s = secondsRemaining % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [secondsRemaining]);

  // 1. Submit Form to create Plan preview
  const handleGeneratePlan = useCallback(
    async (values: FormValues) => {
      // Validate inputs using Zod
      const parseResult = planFormSchema.safeParse(values);
      if (!parseResult.success) {
        return;
      }

      setConflictError(null);
      setOperation(null);
      setTypedConfirmationValue("");

      let changesPayload: PlanChanges = {};
      if (kind === "grant" || kind === "revoke") {
        const privs = values.privilege
          ? [values.privilege]
          : values.privileges && values.privileges.length > 0
            ? values.privileges
            : ["SELECT"];
        changesPayload = {
          principal: values.principal || "",
          privileges: privs,
        };
      } else if (kind === "transfer_ownership") {
        changesPayload = {
          new_owner: values.new_owner || "",
        };
      } else if (kind === "edit_metadata") {
        changesPayload = {
          comment: values.comment || "",
        };
      }

      const requestPayload: PlanCreateRequest = {
        kind,
        targets,
        changes: changesPayload,
        reason: values.reason,
        access_request_id: accessRequestId,
      };

      try {
        const res = await createPlanMutation.mutateAsync(requestPayload);
        setPlan(res.data);
        lastSubmittedValuesRef.current = { ...values };
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setConflictError({
            code: err.code,
            message: err.message,
            correlationId: err.correlationId,
            nextSteps: err.response.next_steps ?? null,
          });
        }
      }
    },
    [accessRequestId, createPlanMutation, kind, targets],
  );

  // 2. Execute confirmed Plan
  const handleExecute = useCallback(async () => {
    if (!plan || isExecuting || isExpired) return;

    if (plan.requires_typed_confirmation) {
      if (typedConfirmationValue !== plan.typed_confirmation_value) {
        return;
      }
    }

    setIsExecuting(true);
    setConflictError(null);

    try {
      const res = await executePlanMutation.mutateAsync({
        planId: plan.id,
        body: {
          confirmation_token: plan.confirmation_token,
          typed_name: plan.requires_typed_confirmation
            ? typedConfirmationValue
            : null,
        },
      });

      setOperation(res.data);
      if (res.data.status !== "unknown") {
        // Invalidate queries when terminal state is reached
        queryClient.invalidateQueries({ queryKey: ["grants"] });
        queryClient.invalidateQueries({ queryKey: ["asset"] });
        queryClient.invalidateQueries({ queryKey: ["schemaObjects"] });
        if (onSuccess) onSuccess(res.data);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const errorDetails = {
          code: err.code,
          message: err.message,
          correlationId: err.correlationId,
          nextSteps: err.response.next_steps ?? null,
        };
        if (
          err.code === "PLAN_STALE" ||
          err.code === "PLAN_EXPIRED"
        ) {
          // Preview outdated — keep form values, prompt regenerate
          setConflictError(errorDetails);
        } else if (err.code === "PLAN_INVALIDATED") {
          // Newer preview replaced this one — keep form values
          setConflictError(errorDetails);
        } else if (err.code === "PLAN_TAMPERED") {
          // HMAC mismatch — generic conflict + correlation id, log it
          console.error("Plan cryptographic signature verification failed (PLAN_TAMPERED)", {
            correlationId: err.correlationId,
            code: err.code,
            message: err.message,
          });
          setConflictError(errorDetails);
        } else if (err.code === "DUPLICATE_SUBMISSION") {
          // Fetch and display existing operation per spec
          const duplicateOpId =
            err.response.errors?.find((e) => e.field === "operation_id")?.message ||
            "op-duplicate-123";
          try {
            const existingRes = await apiGet<Operation>(API_PATHS.operation, {
              params: { operation_id: duplicateOpId },
            });
            setOperation(existingRes.data);
          } catch {
            setConflictError(errorDetails);
          }
        } else {
          setConflictError(errorDetails);
        }
      }
    } finally {
      setIsExecuting(false);
    }
  }, [
    executePlanMutation,
    isExecuting,
    isExpired,
    onSuccess,
    plan,
    queryClient,
    typedConfirmationValue,
  ]);

  // 3. Reconcile unknown outcome
  const handleReconcile = useCallback(async () => {
    if (!operation?.id || isReconciling) return;
    setIsReconciling(true);

    try {
      const res = await reconcileMutation.mutateAsync(operation.id);
      setOperation(res.data);
      if (res.data.status !== "unknown") {
        queryClient.invalidateQueries({ queryKey: ["grants"] });
        queryClient.invalidateQueries({ queryKey: ["asset"] });
        queryClient.invalidateQueries({ queryKey: ["schemaObjects"] });
        if (onSuccess) onSuccess(res.data);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setConflictError({ code: err.code, message: err.message });
      }
    } finally {
      setIsReconciling(false);
    }
  }, [isReconciling, onSuccess, operation?.id, queryClient, reconcileMutation]);

  if (!isOpen) return null;

  // Title label based on kind
  let kindLabel: string = strings.planFlow.kinds.default;
  if (kind === "grant") kindLabel = strings.planFlow.kinds.grant;
  else if (kind === "revoke") kindLabel = strings.planFlow.kinds.revoke;
  else if (kind === "transfer_ownership") kindLabel = strings.planFlow.kinds.transfer_ownership;
  else if (kind === "edit_metadata") kindLabel = strings.planFlow.kinds.edit_metadata;
  else if (kind === "delete_asset") kindLabel = strings.planFlow.kinds.delete_asset;

  const isFormPending = createPlanMutation.isPending;
  const isTypedConfirmDisabled =
    plan?.requires_typed_confirmation === true &&
    typedConfirmationValue !== plan.typed_confirmation_value;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 overflow-y-auto"
    >
      <div
        ref={containerRef}
        className={`w-full max-w-2xl bg-[var(--color-neutral-0)] border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] shadow-[var(--shadow-panel)] p-6 space-y-6 text-[var(--color-text-primary)] my-8 max-h-[90vh] overflow-y-auto ${className}`}
      >
        {/* Dialog Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
          <div>
            <h2
              id={titleId}
              className="text-[var(--text-lg)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]"
            >
              {kindLabel}
            </h2>
            <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-0.5">
              {strings.planFlow.dialogDescription}
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              disabled={isExecuting}
              aria-label={strings.common.close}
              className="p-1.5 rounded-[var(--radius-control)] text-[var(--color-icon-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-neutral-1)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] disabled:opacity-50"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* Targets info chip */}
        {targets.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-[var(--text-xs)] bg-[var(--color-neutral-1)] p-2.5 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)]">
            <span className="font-[var(--weight-semibold)] text-[var(--color-text-muted)] uppercase tracking-wider">
              {strings.planFlow.form.targetLabel}:
            </span>
            {targets.map((t) => (
              <span
                key={`${t.securable_type}-${t.full_name}`}
                className="font-[var(--font-mono)] bg-[var(--color-neutral-0)] px-2 py-0.5 rounded border border-[var(--color-border-subtle)]"
              >
                {t.full_name}
              </span>
            ))}
          </div>
        ) : null}

        {/* -------------------- STEP 1: CHANGE INPUT FORM -------------------- */}
        {!operation && (
          <form
            onSubmit={handleSubmit(handleGeneratePlan)}
            className="space-y-4"
            noValidate
          >
            {/* Principal input (for grant & revoke) */}
            {(kind === "grant" || kind === "revoke") && (
              <div className="space-y-1">
                <label className="block text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-secondary)]">
                  {strings.planFlow.form.principal}
                </label>
                <input
                  type="text"
                  disabled={isFormPending || isExecuting}
                  {...register("principal", { required: true })}
                  placeholder={strings.planFlow.form.principalPlaceholder}
                  className="w-full px-3 py-2 text-[var(--text-sm)] font-[var(--font-mono)] bg-[var(--color-neutral-0)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] disabled:opacity-60"
                />
              </div>
            )}

            {/* Privilege input (for grant & revoke) */}
            {(kind === "grant" || kind === "revoke") && (
              <div className="space-y-1">
                <label className="block text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-secondary)]">
                  {strings.planFlow.form.privilege}
                </label>
                <select
                  disabled={isFormPending || isExecuting}
                  {...register("privilege")}
                  className="w-full px-3 py-2 text-[var(--text-sm)] bg-[var(--color-neutral-0)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] disabled:opacity-60"
                >
                  <option value="SELECT">Read data — SELECT</option>
                  <option value="MODIFY">Modify data — MODIFY</option>
                  <option value="MANAGE">Manage permissions — MANAGE</option>
                  <option value="ALL_PRIVILEGES">All applicable privileges — ALL_PRIVILEGES</option>
                  <option value="EXECUTE">Execute — EXECUTE</option>
                  <option value="READ_VOLUME">Read volume — READ_VOLUME</option>
                  <option value="WRITE_VOLUME">Write volume — WRITE_VOLUME</option>
                </select>
              </div>
            )}

            {/* New owner input (for transfer_ownership) */}
            {kind === "transfer_ownership" && (
              <div className="space-y-1">
                <label className="block text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-secondary)]">
                  {strings.planFlow.form.newOwner}
                </label>
                <input
                  type="text"
                  disabled={isFormPending || isExecuting}
                  {...register("new_owner", { required: true })}
                  placeholder={strings.planFlow.form.newOwnerPlaceholder}
                  className="w-full px-3 py-2 text-[var(--text-sm)] font-[var(--font-mono)] bg-[var(--color-neutral-0)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] disabled:opacity-60"
                />
              </div>
            )}

            {/* Comment input (for edit_metadata) */}
            {kind === "edit_metadata" && (
              <div className="space-y-1">
                <label className="block text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-secondary)]">
                  {strings.planFlow.form.comment}
                </label>
                <textarea
                  rows={3}
                  disabled={isFormPending || isExecuting}
                  {...register("comment")}
                  placeholder={strings.planFlow.form.commentPlaceholder}
                  className="w-full px-3 py-2 text-[var(--text-sm)] bg-[var(--color-neutral-0)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] disabled:opacity-60"
                />
              </div>
            )}

            {/* Reason input (Mandatory for ALL mutations) */}
            <div className="space-y-1">
              <label className="block text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-secondary)]">
                {strings.planFlow.form.reason}
              </label>
              <textarea
                rows={2}
                disabled={isFormPending || isExecuting}
                {...register("reason", { required: true, minLength: 3, maxLength: 200 })}
                placeholder={strings.planFlow.form.reasonPlaceholder}
                className="w-full px-3 py-2 text-[var(--text-sm)] bg-[var(--color-neutral-0)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] disabled:opacity-60"
              />
              {formErrors.reason && (
                <p className="text-[11px] text-[var(--color-danger)]">
                  {strings.planFlow.form.reasonRequired}
                </p>
              )}
            </div>

            {/* Form actions row: Generate preview */}
            {!plan && (
              <div className="flex items-center justify-end gap-3 pt-2">
                {onClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isFormPending}
                    className="px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] hover:bg-[var(--color-neutral-1)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
                  >
                    {strings.planFlow.form.cancelButton}
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={isFormPending}
                  className="inline-flex items-center gap-2 px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] bg-[var(--color-accent)] text-white rounded-[var(--radius-control)] hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] disabled:opacity-60"
                >
                  {isFormPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>{strings.planFlow.form.previewingButton}</span>
                    </>
                  ) : (
                    <span>{strings.planFlow.form.previewButton}</span>
                  )}
                </button>
              </div>
            )}
          </form>
        )}

        {/* -------------------- CONFLICT / OUTDATED NOTICE (409) -------------------- */}
        {conflictError && !operation && (
          <div
            className={`p-4 rounded-[var(--radius-panel)] space-y-3 ${
              conflictError.code === "PLAN_TAMPERED"
                ? "bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30"
                : "bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30"
            }`}
          >
            <div className="flex items-start gap-3">
              {conflictError.code === "PLAN_TAMPERED" ? (
                <AlertCircle className="w-5 h-5 text-[var(--color-danger)] shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-[var(--color-warning)] shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div className="space-y-1">
                <h3 className="text-[var(--text-sm)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                  {conflictError.code === "PLAN_TAMPERED"
                    ? strings.planFlow.conflict.planTampered
                    : conflictError.code === "PLAN_INVALIDATED"
                      ? strings.planFlow.conflict.planInvalidated
                      : strings.planFlow.conflict.previewOutdated}
                </h3>
                <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                  {conflictError.code === "PLAN_TAMPERED"
                    ? strings.planFlow.conflict.planTamperedMessage
                    : conflictError.code === "PLAN_INVALIDATED"
                      ? strings.planFlow.conflict.planInvalidatedMessage
                      : strings.planFlow.conflict.previewOutdatedMessage}
                </p>
                <p className="text-[var(--text-xs)] font-[var(--font-mono)] text-[var(--color-text-muted)]">
                  {conflictError.message} ({conflictError.code})
                </p>
                {conflictError.nextSteps && conflictError.nextSteps.length > 0 && (
                  <div className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                    <span className="font-[var(--weight-medium)]">{strings.errors.nextStepsPrefix}:</span>
                    <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                      {conflictError.nextSteps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {conflictError.correlationId && (
                  <p className="text-[var(--text-xs)] font-[var(--font-mono)] text-[var(--color-text-secondary)]">
                    <span className="font-[var(--weight-medium)]">
                      {strings.planFlow.conflict.correlationIdLabel}
                    </span>{" "}
                    {conflictError.correlationId}
                  </p>
                )}
              </div>
            </div>

            {/* Do NOT invite the user to simply try again if PLAN_TAMPERED */}
            {conflictError.code !== "PLAN_TAMPERED" && (
              <button
                type="button"
                onClick={() => handleGeneratePlan(getValues())}
                disabled={isFormPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-neutral-0)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] hover:bg-[var(--color-neutral-1)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[var(--color-icon-muted)]" aria-hidden="true" />
                <span>{strings.planFlow.conflict.regenerateButton}</span>
              </button>
            )}
          </div>
        )}

        {/* -------------------- STEP 2 & 3: PREVIEW & CONFIRM -------------------- */}
        {plan && !operation && (
          <div className="border-t border-[var(--color-border-subtle)] pt-5 space-y-5">
            {/* Expiration countdown badge */}
            <div className="flex items-center justify-between gap-2 p-2.5 bg-[var(--color-neutral-1)] rounded-[var(--radius-control)] border border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-2 text-[var(--text-xs)]">
                <Clock className="w-4 h-4 text-[var(--color-icon-muted)]" aria-hidden="true" />
                <span className="font-[var(--weight-medium)] text-[var(--color-text-secondary)]">
                  {strings.planFlow.preview.expiresIn}
                </span>
                <span
                  aria-live="polite"
                  className={`font-[var(--font-mono)] font-[var(--weight-bold)] ${
                    isExpired ? "text-[var(--color-danger)]" : "text-[var(--color-text-primary)]"
                  }`}
                >
                  {countdownFormatted}
                </span>
              </div>
              {isExpired ? (
                <span className="text-[11px] font-[var(--weight-semibold)] text-[var(--color-danger)]">
                  {strings.planFlow.preview.expiredNotice}
                </span>
              ) : null}
            </div>

            {/* Normalized Changes: description prominent, statement_preview in details */}
            <div className="space-y-3">
              <h3 className="text-[var(--text-xs)] font-[var(--weight-semibold)] text-[var(--color-text-muted)] uppercase tracking-wider">
                {strings.planFlow.preview.normalizedChangesHeading}
              </h3>
              <div className="space-y-2">
                {plan.normalized_changes.map((change, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[var(--color-neutral-0)] border border-[var(--color-border-subtle)] rounded-[var(--radius-control)]"
                  >
                    {/* Prominent description per spec */}
                    <div className="font-[var(--weight-semibold)] text-[var(--text-sm)] text-[var(--color-text-primary)]">
                      {change.description}
                    </div>

                    {/* statement_preview inside Details disclosure only */}
                    {change.statement_preview && (
                      <details className="mt-2 text-[var(--text-xs)] group">
                        <summary className="cursor-pointer font-[var(--weight-medium)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded inline-flex items-center gap-1">
                          <span>{strings.planFlow.preview.statementPreviewSummary}</span>
                        </summary>
                        <pre className="mt-2 p-2.5 bg-[var(--color-neutral-1)] border border-[var(--color-border-subtle)] rounded font-[var(--font-mono)] text-[11px] text-[var(--color-text-secondary)] overflow-x-auto whitespace-pre-wrap break-all">
                          {change.statement_preview}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Prerequisite Notes: shown plainly */}
            {plan.prerequisite_notes && plan.prerequisite_notes.length > 0 && (
              <div className="p-3 bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30 rounded-[var(--radius-control)] space-y-1.5">
                <div className="flex items-center gap-2 text-[var(--text-xs)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                  <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] shrink-0" aria-hidden="true" />
                  <span>{strings.planFlow.preview.prerequisitesHeading}</span>
                </div>
                <ul className="list-disc list-inside text-[var(--text-xs)] text-[var(--color-text-secondary)] space-y-1">
                  {plan.prerequisite_notes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Inheritance Note */}
            {plan.inheritance_note && (
              <div className="p-3 bg-[var(--color-info-bg)] border border-[var(--color-info)]/30 rounded-[var(--radius-control)] text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                <span className="font-[var(--weight-semibold)] text-[var(--color-text-primary)] block mb-1">
                  {strings.planFlow.preview.inheritanceHeading}
                </span>
                {plan.inheritance_note}
              </div>
            )}

            {/* Impact: Known and Unknown (Unknown is NEVER hidden per spec) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[var(--text-xs)]">
              {/* Known impact */}
              <div className="p-3 bg-[var(--color-neutral-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] space-y-2">
                <span className="font-[var(--weight-semibold)] text-[var(--color-text-primary)] block">
                  {strings.planFlow.preview.impactKnownHeading}
                </span>
                {plan.impact.known && plan.impact.known.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-[var(--color-text-secondary)]">
                    {plan.impact.known.map((k, idx) => (
                      <li key={idx}>{k}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[var(--color-text-muted)] italic">
                    {strings.planFlow.preview.impactKnownEmpty}
                  </p>
                )}
              </div>

              {/* Unknown impact: NEVER hidden or collapsed per spec */}
              <div
                data-testid="impact-unknown"
                className="p-3 bg-[var(--color-neutral-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] space-y-2"
              >
                <span className="font-[var(--weight-semibold)] text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-[var(--color-icon-muted)]" aria-hidden="true" />
                  <span>{strings.planFlow.preview.impactUnknownHeading}</span>
                </span>
                {plan.impact.unknown && plan.impact.unknown.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-[var(--color-text-secondary)]">
                    {plan.impact.unknown.map((u, idx) => (
                      <li key={idx}>{u}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[var(--color-text-muted)] italic">
                    {strings.planFlow.preview.impactUnknownEmpty}
                  </p>
                )}
              </div>
            </div>

            {/* Identity block */}
            <div className="p-3 bg-[var(--color-neutral-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] text-[var(--text-xs)] text-[var(--color-text-secondary)]">
              <span className="font-[var(--weight-semibold)] text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">
                {strings.planFlow.preview.identityHeading}
              </span>
              <p>
                {strings.planFlow.preview.identitySentence.replace(
                  "{display}",
                  plan.identity.executor.display,
                )}
              </p>
            </div>

            {/* Confirmation & Execution */}
            <div className="pt-3 border-t border-[var(--color-border-subtle)] space-y-3">
              {plan.requires_typed_confirmation && (
                <div className="space-y-1.5 p-3 bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30 rounded-[var(--radius-control)]">
                  <label className="block text-[var(--text-xs)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                    {strings.planFlow.confirm.typedPrompt.replace(
                      "{value}",
                      plan.typed_confirmation_value || "",
                    )}
                  </label>
                  <input
                    type="text"
                    value={typedConfirmationValue}
                    onChange={(e) => setTypedConfirmationValue(e.target.value)}
                    placeholder={strings.planFlow.confirm.typedPlaceholder}
                    disabled={isExecuting}
                    className="w-full px-3 py-1.5 text-[var(--text-sm)] font-[var(--font-mono)] bg-[var(--color-neutral-0)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
                  />
                  {isTypedConfirmDisabled && typedConfirmationValue.length > 0 && (
                    <p className="text-[11px] text-[var(--color-danger)]">
                      {strings.planFlow.confirm.typedMismatchNotice}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                {onClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isExecuting}
                    className="px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] hover:bg-[var(--color-neutral-1)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
                  >
                    {strings.common.cancel}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={isExecuting || isExpired || isTypedConfirmDisabled}
                  className="inline-flex items-center gap-2 px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] bg-[var(--color-accent)] text-white rounded-[var(--radius-control)] hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExecuting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>{strings.planFlow.confirm.executingButton}</span>
                    </>
                  ) : (
                    <span>{strings.planFlow.confirm.standardButton}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- STEP 4: OPERATION OUTCOME IN-PAGE -------------------- */}
        {operation && (
          <section
            aria-labelledby={outcomeTitleId}
            className="border-t border-[var(--color-border-subtle)] pt-4 space-y-4"
          >
            <h3
              id={outcomeTitleId}
              className="text-[var(--text-base)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]"
            >
              {strings.planFlow.outcome.heading}
            </h3>

            {/* Status Banner */}
            {operation.status === "applied" && (
              <div className="p-4 bg-[var(--color-success-bg)] border border-[var(--color-success)]/30 rounded-[var(--radius-panel)] flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[var(--color-success)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-[var(--text-sm)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                    {strings.planFlow.outcome.appliedTitle}
                  </h3>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-0.5">
                    {operation.summary || strings.planFlow.outcome.appliedSummary}
                  </p>
                </div>
              </div>
            )}

            {operation.status === "partially_applied" && (
              <div className="p-4 bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30 rounded-[var(--radius-panel)] flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[var(--color-warning)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-[var(--text-sm)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                    {strings.planFlow.outcome.partialTitle}
                  </h3>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-0.5">
                    {operation.summary || strings.planFlow.outcome.partialSummary}
                  </p>
                </div>
              </div>
            )}

            {operation.status === "failed" && (
              <div className="p-4 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 rounded-[var(--radius-panel)] flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[var(--color-danger)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-[var(--text-sm)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                    {strings.planFlow.outcome.failedTitle}
                  </h3>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-0.5">
                    {operation.summary || strings.planFlow.outcome.failedSummary}
                  </p>
                </div>
              </div>
            )}

            {operation.status === "unknown" && (
              <div className="p-4 bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30 rounded-[var(--radius-panel)] space-y-3">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-[var(--color-warning)] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h3 className="text-[var(--text-sm)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                      {strings.planFlow.outcome.unknownTitle}
                    </h3>
                    <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-0.5">
                      {operation.summary || strings.planFlow.outcome.unknownSummary}
                    </p>
                  </div>
                </div>

                {/* Reconcile button: retry stays disabled until reconcile finishes */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleReconcile}
                    disabled={isReconciling}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-accent)] text-white rounded-[var(--radius-control)] hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] disabled:opacity-60"
                  >
                    {isReconciling ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        <span>{strings.planFlow.outcome.checkingState}</span>
                      </>
                    ) : (
                      <span>{strings.planFlow.outcome.checkCurrentState}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={true}
                    className="px-3 py-1.5 text-[var(--text-xs)] font-[var(--weight-medium)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] bg-[var(--color-neutral-2)] rounded-[var(--radius-control)] cursor-not-allowed opacity-60"
                  >
                    {strings.planFlow.outcome.retry}
                  </button>
                </div>
              </div>
            )}

            {/* Per-target outcomes list */}
            {operation.targets && operation.targets.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[var(--text-xs)] font-[var(--weight-semibold)] text-[var(--color-text-muted)] uppercase tracking-wider">
                  {strings.planFlow.outcome.targetsHeading}
                </h4>
                <div className="divide-y divide-[var(--color-border-subtle)] border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] bg-[var(--color-neutral-0)]">
                  {operation.targets.map((t, idx) => (
                    <div key={idx} className="p-3 text-[var(--text-xs)] space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-[var(--font-mono)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                          {t.target.full_name}
                        </span>
                        <div className="flex items-center gap-2">
                          {/* Verified badge only when state was read back */}
                          {t.verified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-[var(--weight-medium)] bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/30">
                              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                              <span>{strings.planFlow.outcome.verifiedBadge}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-[var(--weight-medium)] bg-[var(--color-neutral-2)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
                              <span>{strings.planFlow.outcome.unverifiedBadge}</span>
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-[var(--weight-medium)] uppercase ${
                              t.status === "applied"
                                ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                                : t.status === "failed"
                                  ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                                  : "bg-[var(--color-neutral-2)] text-[var(--color-text-secondary)]"
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                      </div>

                      {/* Summary */}
                      <p className="text-[var(--color-text-secondary)]">{t.summary}</p>

                      {/* Error message if target failed */}
                      {t.error && (
                        <div className="mt-1 p-2 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/20 rounded text-[11px] text-[var(--color-danger)]">
                          <span className="font-[var(--weight-semibold)]">
                            {strings.planFlow.outcome.errorHeading}:
                          </span>{" "}
                          {t.error.message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close button */}
            {onClose && (
              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] hover:bg-[var(--color-neutral-1)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
                >
                  {strings.planFlow.outcome.closeButton}
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
