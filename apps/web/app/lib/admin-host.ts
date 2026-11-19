/**
 * The admin area lives on its own host (e.g. admin.surpluspurpose.com) of the same
 * deployment. Set SURPLUS_ADMIN_HOST to turn the split on; unset (local dev, preview
 * deployments) everything stays reachable from one host.
 */
export function adminHostFromEnv(): string | null {
  const host = process.env.SURPLUS_ADMIN_HOST?.trim().toLowerCase();

  return host ? host : null;
}

export function hostName(hostHeader: string | null | undefined): string {
  return (hostHeader ?? "").split(":")[0]?.trim().toLowerCase() ?? "";
}
