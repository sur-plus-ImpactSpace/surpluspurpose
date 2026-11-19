"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type CopilotTask = {
  taskType: "match_review" | "message_draft" | "social_ad";
  label: string;
  hint: string;
  prompt: string;
};

const TASKS: CopilotTask[] = [
  {
    taskType: "message_draft",
    label: "Draft CSRD note & reply",
    hint: "Summary and customer reply for the current match.",
    prompt: "Draft the CSRD note summary and a service reply for this match."
  },
  {
    taskType: "match_review",
    label: "Review match & next step",
    hint: "Checklist of what is missing before the next confirmation.",
    prompt: "Review this match and propose the next step with a checklist."
  },
  {
    taskType: "social_ad",
    label: "Draft impact card",
    hint: "Social-media impact card from the match figures.",
    prompt: "Draft a social-media impact card for this match."
  }
];

/**
 * The visible entry point to the AI Copilot promised on the landing page.
 * Every task creates an agent run whose proposals land in the approval loop —
 * the Copilot never executes anything without a human decision (invariant 4).
 */
export function CopilotLauncher({
  actorUserId,
  authConfig,
  matchId,
  matchTitle,
  socialCardsAllowed
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  matchId: string | null;
  matchTitle: string | null;
  /** planAllows(plan, "social_media_cards"): the server refuses the task otherwise (plan_required). */
  socialCardsAllowed: boolean;
}) {
  const router = useRouter();
  const [pendingTask, setPendingTask] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const idempotencyPrefix = useMemo(() => stableId(), []);

  async function launch(task: CopilotTask) {
    setPendingTask(task.taskType);
    setStatus(null);
    try {
      const headers = await browserRouteHeaders({
        config: authConfig,
        contentTypeJson: true,
        previewUserId: actorUserId
      });
      if (authConfig && !headers.authorization) {
        setStatus("Copilot failed: auth_required");
        return;
      }

      const response = await fetch("/api/agent-runs", {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-copilot-${task.taskType}-${Date.now()}`
        },
        body: JSON.stringify({
          taskType: task.taskType,
          prompt: task.prompt,
          ...(matchId ? { targetType: "match", targetId: matchId } : {})
        })
      });
      const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as {
        error?: string;
      };

      if (!response.ok || payload.error) {
        setStatus(`Copilot failed: ${payload.error ?? response.status}`);
        return;
      }

      setStatus("Copilot proposal ready — review and approve it in the loop below.");
      router.refresh();
    } catch {
      setStatus("Copilot failed: network_error");
    } finally {
      setPendingTask(null);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground">
        AI Copilot
      </p>
      <h2 className="mt-2 text-xl font-semibold">Let the Copilot draft it</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {matchTitle ? (
          <>
            Drafts for <strong>{matchTitle}</strong> — nothing is executed without your
            approval.
          </>
        ) : (
          <>Drafts listings, CSRD notes and impact copy — nothing is executed without your approval.</>
        )}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {TASKS.filter((task) => task.taskType !== "social_ad" || socialCardsAllowed).map((task) => (
          <button
            className="rounded-lg border border-border bg-muted p-3 text-left hover:border-border disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pendingTask !== null}
            key={task.taskType}
            onClick={() => void launch(task)}
            type="button"
          >
            <p className="text-sm font-semibold">
              {pendingTask === task.taskType ? "Drafting…" : task.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{task.hint}</p>
          </button>
        ))}
      </div>
      {status ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}

function stableId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}
