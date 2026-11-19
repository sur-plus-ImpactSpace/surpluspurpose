import type {
  AgentAttachment,
  AgentFinding,
  DocumentKind,
  DocumentStatus,
  LoopRiskLevel
} from "./model";

export const AGENT_TASK_TYPES = [
  "match_review",
  "message_draft",
  "social_ad",
  "ops_summary",
  "surplus_intake"
] as const;

export type AgentTaskType = (typeof AGENT_TASK_TYPES)[number];

export const AGENT_TASK_LIMITS = {
  maxPromptLength: 4000,
  maxAttachments: 5,
  maxAttachmentBytes: 10_000_000
} as const;

export const AGENT_TARGET_TYPES = ["match", "listing", "document"] as const;

export type AgentTargetType = (typeof AGENT_TARGET_TYPES)[number];

export type AgentRunInput = {
  taskType: AgentTaskType;
  title?: string;
  prompt: string;
  targetType?: AgentTargetType;
  targetId?: string;
  attachments?: AgentAttachment[];
};

export type AgentPlanDocument = {
  kind: DocumentKind;
  title: string;
  status: Extract<DocumentStatus, "draft">;
  matchId: string | null;
  storagePath: string | null;
  mime: string | null;
  sizeBytes: number | null;
};

export type AgentPlanProposedAction = {
  label: string;
  description: string;
  riskLevel: LoopRiskLevel;
  targetType: string | null;
  targetId: string | null;
  proposedPayload: Record<string, unknown>;
};

export type AgentPlan = {
  title: string;
  summary: string;
  findings: AgentFinding[];
  document: AgentPlanDocument | null;
  proposedActions: AgentPlanProposedAction[];
};

export function isAgentTaskType(value: string): value is AgentTaskType {
  return AGENT_TASK_TYPES.includes(value as AgentTaskType);
}

export function normalizeAgentRunInput(input: AgentRunInput): AgentRunInput | undefined {
  if (!isAgentTaskType(input.taskType)) return undefined;

  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > AGENT_TASK_LIMITS.maxPromptLength) return undefined;

  const attachments = input.attachments ?? [];
  if (attachments.length > AGENT_TASK_LIMITS.maxAttachments) return undefined;
  if (
    attachments.some(
      (attachment) =>
        !attachment.name.trim() ||
        !attachment.mime.trim() ||
        attachment.sizeBytes < 0 ||
        attachment.sizeBytes > AGENT_TASK_LIMITS.maxAttachmentBytes
    )
  ) {
    return undefined;
  }

  return {
    ...input,
    title: input.title?.trim(),
    prompt,
    targetId: input.targetId?.trim(),
    attachments: attachments.map((attachment) => ({
      name: attachment.name.trim(),
      mime: attachment.mime.trim(),
      sizeBytes: attachment.sizeBytes
    }))
  };
}

export function createDeterministicAgentPlan(input: AgentRunInput): AgentPlan {
  const task = normalizeAgentRunInput(input);
  if (!task) throw new Error("invalid_agent_task");

  if (task.taskType === "social_ad") return createSocialAdPlan(task);
  if (task.taskType === "ops_summary") return createOpsSummaryPlan(task);
  if (task.taskType === "surplus_intake") return createSurplusIntakePlan(task);

  return createMatchMessagePlan(task);
}

function createSurplusIntakePlan(input: AgentRunInput): AgentPlan {
  let rows: unknown;
  try {
    rows = JSON.parse(input.prompt);
  } catch {
    rows = [];
  }
  const candidates = Array.isArray(rows) ? rows : [];

  const proposedActions: AgentPlanProposedAction[] = candidates
    .slice(0, 40)
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}))
    .map((rec) => {
      const title = String(rec.title ?? "").trim();
      // The upload resolves free-text categories to stable catalogue ids
      // (categoryId/subcategoryId). Store the ids, not the raw labels — that is
      // what the database and matching expect. subcategoryId may be null when
      // the uploader left the mandatory field blank.
      const categoryId = String(rec.categoryId ?? "").trim() || "other";
      const subcategoryId = String(rec.subcategoryId ?? "").trim();
      return {
        label: `Create listing: ${title || "untitled"}`,
        description: "Create a surplus listing from the uploaded list after human approval.",
        riskLevel: "medium" as const,
        targetType: "listing",
        targetId: null,
        proposedPayload: {
          title,
          category: categoryId,
          subcategory: subcategoryId || undefined,
          quantity: Math.max(1, Math.round(Number(rec.quantity ?? 1) || 1)),
          unit: String(rec.unit ?? "units").trim() || "units",
          unitValue: Math.max(0, Number(rec.unitValue ?? 0) || 0),
          condition: String(rec.condition ?? "Good").trim() || "Good",
          weightKg: Math.max(0, Number(rec.weightKg ?? 0) || 0),
          categoryDetails: String(rec.categoryDetails ?? "").trim(),
          city: String(rec.city ?? "").trim(),
          country: String(rec.country ?? "").trim(),
          eligibilityUsable: true,
          eligibilityPolicyFit: true,
          eligibilityOwnership: true
        }
      };
    })
    .filter((action) => String((action.proposedPayload as Record<string, unknown>).title).length > 0);

  const count = proposedActions.length;
  return {
    title: input.title || "Surplus intake",
    summary: `Drafted ${count} listing${count === 1 ? "" : "s"} from the uploaded list. Each stays pending until you approve it.`,
    findings: [
      {
        label: "Human approval required",
        detail:
          "The Copilot drafts listings from your file, but nothing is created until you approve each action.",
        severity: "warning"
      }
    ],
    document: null,
    proposedActions
  };
}

function createMatchMessagePlan(input: AgentRunInput): AgentPlan {
  const title = input.title || "Review match next step";
  const body = [
    "Draft for human review:",
    input.prompt,
    "Please confirm before contact data, commitments or logistics details change."
  ].join("\n\n");

  return {
    title,
    summary: "Prepared a match-review draft. The message remains blocked until a human approves it.",
    findings: [
      {
        label: "Human approval required",
        detail: "The agent may draft the next step, but it cannot send messages or change match state.",
        severity: "warning"
      },
      attachmentFinding(input.attachments ?? [])
    ],
    document: null,
    proposedActions: [
      {
        label: "Send reviewed match message",
        description: "Create a customer-visible match message only after human approval.",
        riskLevel: "medium",
        targetType: "message",
        targetId: input.targetType === "match" ? input.targetId ?? null : null,
        proposedPayload: { body }
      }
    ]
  };
}

function createSocialAdPlan(input: AgentRunInput): AgentPlan {
  const title = input.title || "Draft social impact post";
  const body = [
    "Draft social copy for human review:",
    input.prompt,
    "Reviewer checklist: verify item count, NGO permission, impact methodology and brand-safe wording before publishing."
  ].join("\n\n");

  return {
    title,
    summary: "Created a social-ad draft. Publishing remains behind an explicit approval and execution step.",
    findings: [
      {
        label: "Green-claims boundary",
        detail: "Impact claims must stay evidence-backed and reviewer-approved before publication.",
        severity: "risk"
      },
      attachmentFinding(input.attachments ?? [])
    ],
    document: {
      kind: "social_ad",
      title,
      status: "draft",
      matchId: input.targetType === "match" ? input.targetId ?? null : null,
      storagePath: null,
      mime: "text/markdown",
      sizeBytes: body.length
    },
    proposedActions: [
      {
        label: "Publish reviewed social-ad draft",
        description: "Mark the social-ad document as published only after human approval.",
        riskLevel: "high",
        targetType: "document",
        targetId: null,
        proposedPayload: {
          status: "published",
          channel: "manual_review",
          body,
          complianceNote: "External network posting must use the approved document state."
        }
      }
    ]
  };
}

function createOpsSummaryPlan(input: AgentRunInput): AgentPlan {
  return {
    title: input.title || "Review operational summary",
    summary: "Prepared an internal operations summary for review.",
    findings: [
      {
        label: "No external action",
        detail: "This task creates reviewable context only; it does not write to customers or external systems.",
        severity: "info"
      },
      attachmentFinding(input.attachments ?? [])
    ],
    document: null,
    proposedActions: [
      {
        label: "Acknowledge reviewed operations summary",
        description: "Record that a human reviewed the summary.",
        riskLevel: "low",
        targetType: null,
        targetId: null,
        proposedPayload: { note: input.prompt }
      }
    ]
  };
}

function attachmentFinding(attachments: AgentAttachment[]): AgentFinding {
  if (!attachments.length) {
    return {
      label: "Evidence",
      detail: "No attachments were supplied for this run.",
      severity: "info"
    };
  }

  return {
    label: "Attachment boundary",
    detail: `${attachments.length} attachment(s) are available to the run and remain review context only.`,
    severity: "warning"
  };
}
