"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error.tsx] caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full rounded-2xl border border-red-500/40 bg-slate-900 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 font-bold">
            !
          </div>
          <h1 className="text-lg font-semibold text-white">Runtime error</h1>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-slate-500">Message</p>
          <pre className="text-sm text-red-300 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
            {error.name}: {error.message}
          </pre>
        </div>

        {error.digest && (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-slate-500">Digest</p>
            <p className="text-xs font-mono text-slate-400">{error.digest}</p>
          </div>
        )}

        {error.stack && (
          <details open className="space-y-2">
            <summary className="text-xs uppercase tracking-wider text-slate-500 cursor-pointer select-none">
              Stack trace
            </summary>
            <pre className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={reset}
            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors"
          >
            Hard reload
          </button>
        </div>
      </div>
    </div>
  );
}
