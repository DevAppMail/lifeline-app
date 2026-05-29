// ── OAuth Profile Bridge ───────────────────────────────────────────
// Passes OAuth provider profile data (name, email, avatar) from the
// auth callback page to the onboarding page via sessionStorage.
// Designed for extensibility — future providers (Apple, DigiLocker,
// ABHA, etc.) use the same interface.

import type { User } from "@supabase/supabase-js";

const OAUTH_PROFILE_KEY = "lifeline_oauth_profile";

export interface OAuthProfile {
  name: string;
  email: string;
  avatar_url?: string;
  provider: string;
}

export function storeOAuthProfile(user: User, provider: string): void {
  const profile: OAuthProfile = {
    name: user.user_metadata?.full_name || user.user_metadata?.name || "",
    email: user.email || "",
    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
    provider,
  };
  try {
    sessionStorage.setItem(OAUTH_PROFILE_KEY, JSON.stringify(profile));
  } catch { /* sessionStorage unavailable */ }
}

export function getOAuthProfile(): OAuthProfile | null {
  try {
    const raw = sessionStorage.getItem(OAUTH_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OAuthProfile;
  } catch {
    return null;
  }
}

export function clearOAuthProfile(): void {
  try {
    sessionStorage.removeItem(OAUTH_PROFILE_KEY);
  } catch { /* silent */ }
}

export function getOAuthProvider(user: User): string | null {
  const identities = user.identities || [];
  const oauth = identities.find(
    (id) => id.provider !== "email" && id.provider !== "phone"
  );
  return oauth?.provider || null;
}

export function isOAuthUser(user: User): boolean {
  return getOAuthProvider(user) !== null;
}
