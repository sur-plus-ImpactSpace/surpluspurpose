"use client";

import { Button } from "@/components/ui/button";
import { useEffect } from "react";

/**
 * Customer-facing error boundary. Reports the error to /api/client-error so it
 * shows up in the server logs (lightweight, no external service), then offers
 * retry — never a stack trace.
 */
export default function ErrorBoundary({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        digest: error.digest ?? null,
        message: error.message?.slice(0, 500) ?? "unknown",
        url: window.location.pathname
      })
    }).catch(() => {});
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
      <div className="max-w-md text-center">
        <p className="text-xs font-medium text-primary">sur.plus</p>
        <h1 className="mt-3 text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The error has been logged and we will look into it. Your data is safe — please try
          again, or write to{" "}
          <a className="font-semibold text-primary" href="mailto:service@surpluspurpose.com">
            service@surpluspurpose.com
          </a>{" "}
          if it keeps happening{error.digest ? ` (reference ${error.digest})` : ""}.
        </p>
        <Button
 className="mt-5"
 onClick={() => reset()}
 type="button">
          Try again
        </Button>
      </div>
    </main>
  );
}
