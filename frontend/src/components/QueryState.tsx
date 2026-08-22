import type { ReactNode } from "react";
import { ApiError } from "../api/client";

/**
 * The two states every screen backed by the API has to render.
 *
 * Before this, failures were swallowed by `.catch(() => undefined)` and the
 * page carried on showing whatever stale data it already had, so a backend
 * that was down looked identical to one with nothing to report.
 */

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="bp-card border-dashed px-6 py-10 text-center">
      <p className="text-sm text-ink-300 font-mono">{label}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiError = error instanceof ApiError ? error : null;
  const message =
    error instanceof Error ? error.message : "Something went wrong loading this screen.";

  return (
    <div className="bp-card border-dashed border-red-500/40 px-6 py-8 text-center">
      <p className="text-sm text-red-400">{message}</p>
      {apiError?.requestId && (
        <p className="mt-1 text-[11px] font-mono text-ink-500">
          Reference: {apiError.requestId}
        </p>
      )}
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-4 text-xs">
          Try again
        </button>
      )}
    </div>
  );
}

/** Inline banner for a failed write, where the surrounding form must stay put. */
export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : "The request failed.";
  return (
    <div className="rounded-sm border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">
      {message}
    </div>
  );
}

/** Renders `children` only once a query has resolved successfully. */
export function QueryState({
  isLoading,
  error,
  onRetry,
  loadingLabel,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  loadingLabel?: string;
  children: ReactNode;
}) {
  if (isLoading) return <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  return <>{children}</>;
}
