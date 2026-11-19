export type InvitationAcceptanceToken = {
  token: string;
  tokenHash: string;
};

const tokenBytes = 32;

export async function createInvitationAcceptanceToken(): Promise<InvitationAcceptanceToken> {
  const bytes = new Uint8Array(tokenBytes);
  crypto.getRandomValues(bytes);
  const token = base64Url(bytes);

  return {
    token,
    tokenHash: await hashInvitationAcceptanceToken(token)
  };
}

export async function hashInvitationAcceptanceToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
