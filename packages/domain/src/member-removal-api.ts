export type MemberRemovalCommand = { idempotencyKey: string; userId: string };

export type MemberRemovalCommandResult =
  | { ok: true; command: MemberRemovalCommand }
  | { ok: false; reason: "missing_idempotency_key" | "invalid_user_id"; status: 422 | 428 };

/** Pure shape check of "remove this colleague". Same-company and not-self rules live in the repository and remove_company_member. */
export function parseMemberRemovalCommand(
  headers: { get(name: string): string | null },
  userId: unknown
): MemberRemovalCommandResult {
  const idempotencyKey = headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) return { ok: false, reason: "missing_idempotency_key", status: 428 };
  if (typeof userId !== "string" || !userId.trim()) return { ok: false, reason: "invalid_user_id", status: 422 };

  return { ok: true, command: { idempotencyKey, userId: userId.trim() } };
}
