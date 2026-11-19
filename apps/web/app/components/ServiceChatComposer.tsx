"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { browserRouteHeaders, getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { ServiceChatRealtimeConfig } from "../lib/service-chat-realtime";

type ChatMessageRecord = {
  id: string;
  matchId: string;
  authorId: string | null;
  body: string;
  visibility: "admin_only" | "customer_visible";
  createdAt: string;
};

type ServiceChatComposerProps = {
  actorUserId: string;
  /** How the other side of the match is shown on their messages. */
  counterpartyLabel?: string;
  initialMessages: ChatMessageRecord[];
  matchId: string;
  realtimeConfig: ServiceChatRealtimeConfig | null;
  roleLabel: "Corporate" | "NGO";
};

type MessageResponse =
  | {
      message: ChatMessageRecord;
      runtime: "preview-route-handler" | "supabase-rpc";
    }
  | {
      error: string;
    };

type MessagesResponse =
  | {
      messages: ChatMessageRecord[];
      runtime: "preview-route-handler" | "supabase-rest";
    }
  | {
      error: string;
    };

type RealtimeState = "off" | "connecting" | "live" | "error";

export function ServiceChatComposer({
  actorUserId,
  counterpartyLabel = "the other party",
  initialMessages,
  matchId,
  realtimeConfig,
  roleLabel
}: ServiceChatComposerProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageRecord[]>(() => sortMessages(initialMessages));
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>(realtimeConfig ? "connecting" : "off");
  const [retryToken, setRetryToken] = useState(0);
  const [pending, setPending] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const idempotencyPrefix = useMemo(() => stableId(), []);
  const trimmedDraft = draft.trim();

  async function requestHeaders(contentTypeJson = false): Promise<Record<string, string>> {
    return browserRouteHeaders({
      config: realtimeConfig,
      contentTypeJson,
      previewUserId: actorUserId
    });
  }

  async function refreshMessages() {
    const headers = await requestHeaders();
    if (realtimeConfig && !headers.authorization) return false;

    const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}/messages`, {
      headers
    });
    const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as MessagesResponse;
    if (!response.ok || "error" in payload) return false;

    setMessages(sortMessages(payload.messages));
    return true;
  }

  useEffect(() => {
    if (!realtimeConfig) {
      setRealtimeState("off");
      return;
    }

    const supabase = getBrowserSupabaseClient(realtimeConfig);
    // `retryToken` is in the deps: bumping it tears the channel down and
    // resubscribes. Without it a dead channel stayed dead for the session.
    void retryToken;

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    setRealtimeState("connecting");
    channel = supabase
      .channel(`match-messages:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `match_id=eq.${matchId}`,
          schema: "public",
          table: "messages"
        },
        (payload) => {
          const message = messageFromRealtimeRecord(payload.new);
          if (!message || message.matchId !== matchId) return;

          setMessages((current) => mergeMessages(current, [message]));
        }
      )
      .subscribe((subscriptionStatus) => {
        if (cancelled) return;
        if (subscriptionStatus === "SUBSCRIBED") {
          setRealtimeState("live");
          void refreshMessages();
          return;
        }
        if (subscriptionStatus === "CHANNEL_ERROR" || subscriptionStatus === "TIMED_OUT") {
          setRealtimeState("error");
          return;
        }
        if (subscriptionStatus === "CLOSED") {
          setRealtimeState("off");
        }
      });

    return () => {
      cancelled = true;
      setRealtimeState("off");
      if (channel) void supabase.removeChannel(channel);
    };
  }, [matchId, realtimeConfig, retryToken]);

  /**
   * Make "Live sync retrying" true. The label said it; nothing did it. A dead
   * channel meant the thread silently stopped delivering — the worst failure
   * mode for a chat, because it looks identical to nobody having replied.
   *
   * While the channel is down we poll the same endpoint the thread already
   * uses, so messages keep arriving, and we retry the subscription with a
   * backoff. Polling stops the moment the channel is live again.
   */
  useEffect(() => {
    if (!realtimeConfig) return;
    if (realtimeState !== "error") return;

    let cancelled = false;
    const poll = window.setInterval(() => {
      if (!cancelled) void refreshMessages();
    }, POLL_INTERVAL_MS);
    // Capped: a channel that cannot come back should not turn into a
    // reconnect storm against Supabase.
    const resubscribe = window.setTimeout(() => {
      if (!cancelled) setRetryToken((current) => current + 1);
    }, RESUBSCRIBE_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearTimeout(resubscribe);
    };
  }, [realtimeState, realtimeConfig, matchId]);

  async function postMessage(body: string): Promise<boolean> {
    const headers = await requestHeaders(true);
    if (realtimeConfig && !headers.authorization) {
      setStatus("Message failed: auth_required");
      return false;
    }

    const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}/messages`, {
      method: "POST",
      headers: {
        ...headers,
        "idempotency-key": `${idempotencyPrefix}-message-${Date.now()}`
      },
      body: JSON.stringify({ body })
    });
    const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as MessageResponse;

    if (!response.ok || "error" in payload) {
      setStatus(`Message failed: ${"error" in payload ? payload.error : response.status}`);
      return false;
    }

    setMessages((current) => mergeMessages(current, [payload.message]));
    if (payload.runtime === "supabase-rpc") {
      void refreshMessages();
      startRefresh(() => router.refresh());
    }
    return true;
  }

  async function submit() {
    if (!trimmedDraft) {
      setStatus("Please write a message first.");
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      if (await postMessage(trimmedDraft)) {
        setDraft("");
        setStatus("Message added to the match thread.");
      }
    } catch {
      setStatus("Message failed: network_error");
    } finally {
      setPending(false);
    }
  }

  /** C2: bring the sur.plus service into the thread instead of DMing a person.
   *  Posts a visible request — Ops already sees the thread, so this flags it. */
  async function bringInService() {
    setPending(true);
    setStatus(null);
    try {
      if (await postMessage("sur.plus, could you join this match and help us here?")) {
        setStatus("sur.plus was asked to join this thread.");
      }
    } catch {
      setStatus("Message failed: network_error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="grid max-h-64 gap-3 overflow-y-auto pr-1">
        {messages.map((message) => (
          <ChatMessage
            counterpartyLabel={counterpartyLabel}
            isOwn={message.authorId === actorUserId}
            key={message.id}
            message={message}
            roleLabel={roleLabel}
          />
        ))}
      </div>
      <div className="mt-4 grid gap-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm font-semibold text-muted-foreground" htmlFor={`service-chat-${matchId}`}>
            Message the thread
          </label>
          <p className="text-xs text-muted-foreground">{syncLabel(realtimeState, Boolean(realtimeConfig))}</p>
        </div>
        <Textarea
          className="min-h-24 resize-y"
          disabled={pending || isRefreshing}
          id={`service-chat-${matchId}`}
          maxLength={2000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message the other party — or ask sur.plus to help with timing, documents or logistics."
          value={draft}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button disabled={pending || isRefreshing} onClick={() => void bringInService()} type="button" variant="outline">
            Bring in sur.plus
          </Button>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">{trimmedDraft.length}/2000</p>
            <Button disabled={pending || isRefreshing} onClick={() => void submit()} type="button">
              {pending ? "Sending..." : "Send message"}
            </Button>
          </div>
        </div>
        {status ? (
          <p className="text-sm text-muted-foreground" role="status">
            {status}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ChatMessage({
  counterpartyLabel,
  isOwn,
  message,
  roleLabel
}: {
  counterpartyLabel: string;
  isOwn: boolean;
  message: ChatMessageRecord;
  roleLabel: "Corporate" | "NGO";
}) {
  const name = isOwn
    ? `You · ${roleLabel}`
    : message.authorId === null
      ? "sur.plus"
      : counterpartyLabel;

  return (
    <div className={`rounded-sm border p-3 ${isOwn ? "border-primary bg-muted" : "border-border bg-muted"}`}>
      <p className="text-xs font-medium text-muted-foreground">{name}</p>
      <p className="mt-1 wrap-break-word text-sm leading-6 text-muted-foreground">{message.body}</p>
    </div>
  );
}

function stableId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

function mergeMessages(current: ChatMessageRecord[], incoming: ChatMessageRecord[]): ChatMessageRecord[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => {
    byId.set(message.id, message);
  });

  return sortMessages([...byId.values()]);
}

function sortMessages(messages: ChatMessageRecord[]): ChatMessageRecord[] {
  return [...messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

/** Polling cadence while the realtime channel is down. */
const POLL_INTERVAL_MS = 5_000;
/** Wait before rebuilding a failed channel, so an outage is not a retry storm. */
const RESUBSCRIBE_DELAY_MS = 8_000;

function syncLabel(state: RealtimeState, enabled: boolean): string {
  if (!enabled) return "Saved thread";
  if (state === "live") return "Live sync";
  if (state === "connecting") return "Connecting live";
  // Now true rather than decorative: the effect above polls and resubscribes.
  if (state === "error") return "Live sync retrying — messages still arrive";

  return "Live sync paused";
}

/**
 * Defence in depth. RLS on `messages` already keeps admin_only notes away from
 * a customer, and Supabase applies it to postgres_changes too — but the row
 * hands us the visibility and this used to check only that the value was one of
 * the two, then render either. If realtime's RLS ever came loose, an internal
 * Ops note would appear in the customer's thread. One guard is not a boundary
 * when a second one is sitting right there unused.
 *
 * Ops reads admin_only through the server-rendered thread, not this channel.
 */
function messageFromRealtimeRecord(record: Record<string, unknown>): ChatMessageRecord | null {
  const visibility = record.visibility;
  if (visibility !== "customer_visible") return null;

  const id = stringValue(record.id);
  const matchId = stringValue(record.match_id);
  const body = stringValue(record.body);
  const createdAt = stringValue(record.created_at);
  if (!id || !matchId || !body || !createdAt) return null;

  const authorId = record.author_id === null ? null : stringValue(record.author_id);
  if (authorId === undefined) return null;

  return {
    id,
    matchId,
    authorId,
    body,
    visibility,
    createdAt
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
