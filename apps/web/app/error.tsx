"use client";

import { ErrorPanel } from "@/components/error-panel";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-paper p-8">
      <div className="mx-auto max-w-3xl pt-20">
        <ErrorPanel message={error.message} retry={reset} />
      </div>
    </div>
  );
}
