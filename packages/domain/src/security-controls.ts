export const SECURITY_CONTROL_IDS = [
  "zero-trust-per-request-authz",
  "supabase-rls-object-authorization",
  "object-property-redaction",
  "least-privilege-service-role",
  "input-validation",
  "idempotent-mutations",
  "signed-webhooks",
  "rate-limited-endpoints",
  "audit-trail",
  "security-event-monitoring",
  "secure-headers-csp",
  "secrets-out-of-browser",
  "dependency-scanning",
  "static-analysis",
  "storage-signed-urls",
  "supabase-auth-required",
  "hashed-invitation-token",
  "email-bound-token-acceptance",
  "seat-limit-revalidation",
  "fail-closed-provisioning",
  "bootstrap-shared-secret",
  "incident-response-runbook"
] as const;

export type SecurityControlId = (typeof SECURITY_CONTROL_IDS)[number];

export type SecurityControl = {
  id: SecurityControlId;
  nistCsfFunction: "govern" | "identify" | "protect" | "detect" | "respond" | "recover";
  owaspReference: string;
  implementation: string;
};

export const SECURITY_BASELINE = [
  {
    id: "zero-trust-per-request-authz",
    nistCsfFunction: "protect",
    owaspReference: "OWASP ASVS 5.0 / NIST SP 800-207",
    implementation: "Every request resolves an ActorContext and authorizes the exact object/action."
  },
  {
    id: "supabase-rls-object-authorization",
    nistCsfFunction: "protect",
    owaspReference: "OWASP API1:2023 Broken Object Level Authorization",
    implementation: "RLS policies enforce organization-scoped reads/writes independently of the UI."
  },
  {
    id: "object-property-redaction",
    nistCsfFunction: "protect",
    owaspReference: "OWASP API3:2023 Broken Object Property Level Authorization",
    implementation: "Public profiles and DTOs redact contact fields until the match unlock state."
  },
  {
    id: "least-privilege-service-role",
    nistCsfFunction: "protect",
    owaspReference: "OWASP API5:2023 Broken Function Level Authorization",
    implementation: "Service-role credentials are server-only and never exposed to browser bundles."
  },
  {
    id: "input-validation",
    nistCsfFunction: "protect",
    owaspReference: "OWASP ASVS 5.0 validation requirements",
    implementation: "API route handlers validate payload shape before repository commands."
  },
  {
    id: "idempotent-mutations",
    nistCsfFunction: "protect",
    owaspReference: "OWASP API6:2023 Sensitive Business Flows",
    implementation: "User-facing mutations require a persisted idempotency key before side effects."
  },
  {
    id: "signed-webhooks",
    nistCsfFunction: "protect",
    owaspReference: "OWASP API10:2023 Unsafe Consumption of APIs",
    implementation: "DocuSeal webhook state changes require provider signature verification."
  },
  {
    id: "rate-limited-endpoints",
    nistCsfFunction: "protect",
    owaspReference: "OWASP API4:2023 Unrestricted Resource Consumption",
    implementation: "Mutation and webhook endpoints carry explicit rate-limit policies."
  },
  {
    id: "audit-trail",
    nistCsfFunction: "detect",
    owaspReference: "OWASP ASVS 5.0 logging requirements",
    implementation: "Security and compliance mutations create audit_events records."
  },
  {
    id: "security-event-monitoring",
    nistCsfFunction: "detect",
    owaspReference: "NIST CSF 2.0 Detect",
    implementation: "Failed authz, webhook verification and quota events are monitored."
  },
  {
    id: "secure-headers-csp",
    nistCsfFunction: "protect",
    owaspReference: "OWASP API8:2023 Security Misconfiguration",
    implementation: "Next.js emits nonce-based CSP plus frame, MIME, referrer and permission headers."
  },
  {
    id: "secrets-out-of-browser",
    nistCsfFunction: "protect",
    owaspReference: "OWASP ASVS 5.0 secrets management",
    implementation: "Privileged Supabase keys are read only by server runtimes."
  },
  {
    id: "dependency-scanning",
    nistCsfFunction: "identify",
    owaspReference: "OWASP API8:2023 Security Misconfiguration",
    implementation: "Dependabot monitors npm/pnpm and GitHub Actions dependencies."
  },
  {
    id: "static-analysis",
    nistCsfFunction: "identify",
    owaspReference: "OWASP ASVS 5.0 verification automation",
    implementation: "CodeQL analyzes TypeScript/JavaScript on PRs and main."
  },
  {
    id: "storage-signed-urls",
    nistCsfFunction: "protect",
    owaspReference: "OWASP API3:2023 Broken Object Property Level Authorization",
    implementation: "Private document objects are served through actor-scoped signed URLs."
  },
  {
    id: "supabase-auth-required",
    nistCsfFunction: "protect",
    owaspReference: "OWASP ASVS 5.0 authentication requirements",
    implementation: "Provisioning routes require a validated Supabase Auth bearer token before side effects."
  },
  {
    id: "hashed-invitation-token",
    nistCsfFunction: "protect",
    owaspReference: "OWASP ASVS 5.0 credential storage requirements",
    implementation: "Invitation acceptance stores only SHA-256 token hashes and compares them inside the database."
  },
  {
    id: "email-bound-token-acceptance",
    nistCsfFunction: "protect",
    owaspReference: "OWASP API2:2023 Broken Authentication",
    implementation: "An invitation token can only provision the Supabase Auth user whose email matches the invite."
  },
  {
    id: "seat-limit-revalidation",
    nistCsfFunction: "protect",
    owaspReference: "OWASP API6:2023 Sensitive Business Flows",
    implementation: "Corporate seat limits are checked again at invitation acceptance time."
  },
  {
    id: "fail-closed-provisioning",
    nistCsfFunction: "protect",
    owaspReference: "OWASP API1:2023 Broken Object Level Authorization",
    implementation: "Authenticated users without a provisioned workspace profile receive no preview workspace data."
  },
  {
    id: "bootstrap-shared-secret",
    nistCsfFunction: "protect",
    owaspReference: "OWASP ASVS 5.0 administrative interface requirements",
    implementation: "Admin bootstrap requires a server-configured one-time operational secret in addition to Supabase Auth."
  },
  {
    id: "incident-response-runbook",
    nistCsfFunction: "respond",
    owaspReference: "NIST CSF 2.0 Respond/Recover",
    implementation: "Security incidents have triage, containment, rotation and communication steps."
  }
] as const satisfies readonly SecurityControl[];
