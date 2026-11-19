import {
  AGENT_TARGET_TYPES,
  isAgentTaskType,
  normalizeAgentRunInput,
  type AgentRunInput,
  type AgentTargetType
} from "./agent-planner";
import type { AgentAttachment } from "./model";

export const AGENT_RUN_IDEMPOTENCY_HEADER = "idempotency-key";

export type HeaderReader = {
  get(name: string): string | null;
};

export type AgentRunCommand = {
  idempotencyKey: string;
  input: AgentRunInput;
};

export type AgentRunCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_payload"
  | "invalid_task";

export type AgentRunCommandResult =
  | { ok: true; command: AgentRunCommand }
  | { ok: false; reason: AgentRunCommandErrorReason; status: 400 | 422 | 428 };

export function parseAgentRunCommand(headers: HeaderReader, body: unknown): AgentRunCommandResult {
  const idempotencyKey = headers.get(AGENT_RUN_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }

  const payload = objectPayload(body);
  if (!payload) return { ok: false, reason: "invalid_payload", status: 400 };

  const taskType = payload.taskType;
  const prompt = payload.prompt;
  if (typeof taskType !== "string" || !isAgentTaskType(taskType) || typeof prompt !== "string") {
    return { ok: false, reason: "invalid_task", status: 422 };
  }

  const title = optionalString(payload.title);
  if (title === null) return { ok: false, reason: "invalid_payload", status: 400 };

  const targetType = optionalTargetType(payload.targetType);
  if (targetType === null) return { ok: false, reason: "invalid_payload", status: 400 };

  const targetId = optionalString(payload.targetId);
  if (targetId === null) return { ok: false, reason: "invalid_payload", status: 400 };

  const attachments = attachmentsPayload(payload.attachments);
  if (!attachments) return { ok: false, reason: "invalid_payload", status: 400 };

  const input = normalizeAgentRunInput({
    taskType,
    title,
    prompt,
    targetType,
    targetId,
    attachments
  });
  if (!input) return { ok: false, reason: "invalid_task", status: 422 };

  return {
    ok: true,
    command: {
      idempotencyKey,
      input
    }
  };
}

function objectPayload(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalTargetType(value: unknown): AgentTargetType | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;

  return AGENT_TARGET_TYPES.includes(value as AgentTargetType) ? (value as AgentTargetType) : null;
}

function attachmentsPayload(value: unknown): AgentAttachment[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return undefined;

  const attachments: AgentAttachment[] = [];
  for (const item of value) {
    const attachment = objectPayload(item);
    if (
      !attachment ||
      typeof attachment.name !== "string" ||
      typeof attachment.mime !== "string" ||
      typeof attachment.sizeBytes !== "number"
    ) {
      return undefined;
    }

    attachments.push({
      name: attachment.name,
      mime: attachment.mime,
      sizeBytes: attachment.sizeBytes
    });
  }

  return attachments;
}
