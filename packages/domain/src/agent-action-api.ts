export const AGENT_ACTION_IDEMPOTENCY_HEADER = "idempotency-key";

export const AGENT_ACTION_OPERATIONS = ["approve", "reject", "execute"] as const;
export type AgentActionOperation = (typeof AGENT_ACTION_OPERATIONS)[number];

export type AgentActionHeaderReader = {
  get(name: string): string | null;
};

export type AgentActionCommand = {
  idempotencyKey: string;
  actionId: string;
  operation: AgentActionOperation;
};

export type AgentActionCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_action_id"
  | "invalid_operation";

export type AgentActionCommandResult =
  | { ok: true; command: AgentActionCommand }
  | { ok: false; reason: AgentActionCommandErrorReason; status: 400 | 422 | 428 };

export function parseAgentActionCommand(
  headers: AgentActionHeaderReader,
  input: {
    actionId: unknown;
    operation: unknown;
  }
): AgentActionCommandResult {
  const idempotencyKey = headers.get(AGENT_ACTION_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }

  if (typeof input.actionId !== "string" || !input.actionId.trim()) {
    return { ok: false, reason: "invalid_action_id", status: 400 };
  }
  if (typeof input.operation !== "string" || !isAgentActionOperation(input.operation)) {
    return { ok: false, reason: "invalid_operation", status: 422 };
  }

  return {
    ok: true,
    command: {
      idempotencyKey,
      actionId: input.actionId.trim(),
      operation: input.operation
    }
  };
}

export function isAgentActionOperation(value: string): value is AgentActionOperation {
  return AGENT_ACTION_OPERATIONS.includes(value as AgentActionOperation);
}
