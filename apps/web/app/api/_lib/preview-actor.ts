import type { ActorContext, RepositoryData, User } from "@surplus/domain";

const DEFAULT_PREVIEW_USER_ID = "usr-corporate-acme";

export function resolvePreviewActor(data: RepositoryData, preferredUserId: string | null): ActorContext | null {
  const requestedUserId = preferredUserId?.trim() || DEFAULT_PREVIEW_USER_ID;
  const user = data.users.find((item) => item.id === requestedUserId);

  if (!user) return null;
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

  return null;
}

function isCorporateUser(user: User): user is User & { role: "corporate"; companyId: string } {
  return user.role === "corporate" && Boolean(user.companyId);
}

function isNgoUser(user: User): user is User & { role: "ngo"; ngoId: string } {
  return user.role === "ngo" && Boolean(user.ngoId);
}
