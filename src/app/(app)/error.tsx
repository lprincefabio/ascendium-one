"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({ error, reset }: { error: Error & { status?: number; digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // In production builds the message/name are masked; the digest set on ForbiddenError is the stable signal.
  const forbidden =
    error.digest === "FORBIDDEN" ||
    error.name === "ForbiddenError" ||
    error.status === 403 ||
    error.message === "You do not have permission to perform this action";

  return (
    <div className="card mx-auto mt-12 max-w-lg p-8 text-center">
      {forbidden ? (
        <>
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">403 — Restricted</p>
          <h1 className="mt-2 text-2xl font-bold">Outside your authorised scope</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            This area of Ascendium One requires a role you do not hold. Every access attempt is recorded in the audit trail.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold uppercase tracking-widest text-red-600 dark:text-red-400">Error</p>
          <h1 className="mt-2 text-2xl font-bold">Something went wrong</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{error.message || "An unexpected error occurred."}</p>
        </>
      )}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button onClick={reset} className="btn btn-primary">Try again</button>
        <Link href="/" className="btn btn-ghost">Return to Ascendium One</Link>
      </div>
    </div>
  );
}
