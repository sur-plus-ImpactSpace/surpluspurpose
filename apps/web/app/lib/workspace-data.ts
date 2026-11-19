import {
  PLAN_ENTITLEMENTS,
  createInMemoryRepository,
  createSeedData,
  createSupabaseRestRepository,
  fetchOpenNeedsDirectoryWithSupabase,
  type ActorContext,
  type OpenNeedRow,
  type PlanTier,
  type RepositoryData,
  type SupabaseRestConfig,
  type SurplusRepository,
  type User
} from "@surplus/domain";

export type WorkspaceDataSource = "supabase" | "preview";
export type WorkspaceRole = ActorContext["role"];

export type WorkspaceData = {
  actor: ActorContext;
  data: RepositoryData;
  repository: SurplusRepository;
  /**
   * The browsable needs directory, populated only for a corporate that cannot
   * yet contact an NGO — i.e. registered but not on Seed or Tree. Paying tiers
   * reach NGOs through matches and never pay for this round trip. Null
   * everywhere else.
   */
  openNeeds: OpenNeedRow[] | null;
  source: WorkspaceDataSource;
  warning: string | null;
};

export class WorkspaceProfileMissingError extends Error {
  constructor(readonly userId: string) {
    super("Authenticated user has no workspace profile");
    this.name = "WorkspaceProfileMissingError";
  }
}

const DEFAULT_PREVIEW_USER_ID = "usr-corporate-acme";
const DEFAULT_ROLE: WorkspaceRole = "corporate";

export async function loadWorkspaceData(options: {
  authorization?: string;
  preferredRole?: WorkspaceRole;
  preferredUserId?: string;
} = {}): Promise<WorkspaceData> {
  const config = supabaseConfigFromEnv(options.authorization);
  const preferredRole = options.preferredRole ?? roleFromEnv() ?? DEFAULT_ROLE;
  const preferredUserId = options.preferredUserId ?? process.env.SURPLUS_APP_USER_ID;

  if (config) {
    try {
      const { data, repository } = await createSupabaseRestRepository(config);
      const actor = resolveActor(data, preferredRole, preferredUserId);

      return {
        actor,
        data,
        repository,
        openNeeds: await loadOpenNeeds(config, actor, data),
        source: "supabase",
        warning: null
      };
    } catch (error) {
      console.error("Supabase workspace data load failed", error);
      if (options.authorization) throw error;
      // Fail loud: when Supabase is configured, production must never silently
      // degrade to preview data — customers could mistake seed data for their
      // own. Pure demo deployments (no Supabase env) are unaffected; explicit
      // opt-in via SURPLUS_ALLOW_PREVIEW_FALLBACK keeps the old behavior.
      if (!previewFallbackAllowed()) throw error;

      const preview = previewWorkspaceData(preferredRole);
      return {
        ...preview,
        warning: supabaseWarning(error)
      };
    }
  }

  return previewWorkspaceData(preferredRole);
}

/**
 * What a registered corporate browses instead of an empty workspace. Only
 * fetched for a plan without contact access, so paying tiers skip the round
 * trip. Best-effort: a failure logs and the card renders empty rather than
 * taking the whole workspace down.
 */
async function loadOpenNeeds(
  config: SupabaseRestConfig,
  actor: ActorContext,
  data: RepositoryData
): Promise<OpenNeedRow[] | null> {
  if (actor.role !== "corporate") return null;

  const company = data.companies.find((item) => item.id === actor.companyId);
  // Fail closed: an unknown plan is treated as unpaid, never as a paying tier.
  const plan: PlanTier = company?.plan ?? "registered";
  if (PLAN_ENTITLEMENTS[plan].ngoContactAccess) return null;

  try {
    return await fetchOpenNeedsDirectoryWithSupabase(config);
  } catch (error) {
    console.error("Open needs directory load failed", error);
    return null;
  }
}

function previewFallbackAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.SURPLUS_ALLOW_PREVIEW_FALLBACK === "true";
}

function supabaseWarning(error: unknown): string {
  if (process.env.NODE_ENV === "production") {
    return "Supabase data load failed; check server logs.";
  }

  return error instanceof Error ? error.message : "Supabase data load failed";
}

export async function loadCorporateWorkspaceData(): Promise<WorkspaceData & {
  actor: Extract<ActorContext, { role: "corporate" }>;
}> {
  const workspace = await loadWorkspaceData({ preferredRole: "corporate" });
  if (workspace.actor.role !== "corporate") {
    throw new Error("No corporate user is available for the workspace auth boundary");
  }

  return {
    ...workspace,
    actor: workspace.actor
  };
}

export type PulseListing = {
  title: string;
  category: string;
  quantity: number;
  unitValue: number;
};

/**
 * Demo sandbox data for the public /demo route: always the in-memory seed
 * workspace, never Supabase — regardless of environment configuration.
 * An optional Pulse assessment listing is injected so visitors coming from
 * the impact calculator see THEIR surplus inside the workspace.
 */
export function loadDemoWorkspaceData(
  preferredRole: WorkspaceRole = DEFAULT_ROLE,
  options: { pulseListing?: PulseListing; sandbox?: { data: RepositoryData; repository: SurplusRepository } } = {}
): WorkspaceData {
  // A visitor's own sandbox keeps what they did; without one the page is a fresh seed.
  const data = options.sandbox?.data ?? createSeedData();
  if (options.pulseListing && !data.listings.some((listing) => listing.id === "lst-pulse-assessment")) {
    data.listings.unshift({
      id: "lst-pulse-assessment",
      companyId: "co-acme",
      title: options.pulseListing.title,
      category: options.pulseListing.category,
      subcategory: null,
      quantity: options.pulseListing.quantity,
      unit: "units",
      unitValue: options.pulseListing.unitValue,
      city: "Your site",
      country: "Germany",
      condition: "Good",
      state: "open",
      availableUntil: null,
      pickupWindow: "",
      packaging: "",
      weightKg: 0,
      categoryDetails: "Imported from your Pulse assessment.",
      photos: [],
      attachments: [],
      reviewFlags: [],
      eligibility: { usable: true, policyFit: true, ownership: true },
      createdAt: new Date().toISOString()
    });
  }

  return {
    actor: resolveActor(data, preferredRole, undefined),
    data,
    repository: options.sandbox?.repository ?? createInMemoryRepository(data),
    openNeeds: null,
    source: "preview",
    warning: null
  };
}

function previewWorkspaceData(preferredRole: WorkspaceRole = DEFAULT_ROLE): WorkspaceData {
  const data = createSeedData();

  return {
    actor: resolveActor(data, preferredRole, undefined),
    data,
    repository: createInMemoryRepository(data),
    openNeeds: null,
    source: "preview",
    warning: null
  };
}

function supabaseConfigFromEnv(authorization?: string): SupabaseRestConfig | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = authorization ? anonKey : (process.env.SUPABASE_SERVICE_ROLE_KEY ?? anonKey);

  if (!url || !key) return null;

  return authorization ? { url, key, authorization } : { url, key };
}

function roleFromEnv(): WorkspaceRole | undefined {
  const role = process.env.SURPLUS_APP_ROLE;
  return role === "corporate" || role === "ngo" || role === "admin" || role === "editor" ? role : undefined;
}

function resolveActor(
  data: RepositoryData,
  preferredRole: WorkspaceRole,
  preferredUserId?: string
): ActorContext {
  const preferredUser = preferredUserId ? data.users.find((item) => item.id === preferredUserId) : undefined;
  if (preferredUserId && !preferredUser) {
    throw new WorkspaceProfileMissingError(preferredUserId);
  }

  const user =
    preferredUser ??
    data.users.find((item) => item.role === preferredRole) ??
    data.users.find((item) => item.id === DEFAULT_PREVIEW_USER_ID) ??
    data.users[0];

  if (!user) {
    throw new Error("No user is available for the workspace auth boundary");
  }
  if (isCorporateUser(user)) {
    return {
      role: "corporate",
      userId: user.id,
      companyId: user.companyId
    };
  }
  if (isNgoUser(user)) {
    return {
      role: "ngo",
      userId: user.id,
      ngoId: user.ngoId
    };
  }
  if (user.role === "admin") {
    return {
      role: "admin",
      userId: user.id
    };
  }
  if (user.role === "editor") {
    return {
      role: "editor",
      userId: user.id
    };
  }

  throw new Error(`User ${user.id} has an invalid workspace role`);
}

function isCorporateUser(user: User): user is User & { role: "corporate"; companyId: string } {
  return user.role === "corporate" && Boolean(user.companyId);
}

function isNgoUser(user: User): user is User & { role: "ngo"; ngoId: string } {
  return user.role === "ngo" && Boolean(user.ngoId);
}
