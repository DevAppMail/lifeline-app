import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { generateLifelineId } from "@/lib/lifeline-id";
import type { EmergencyContact } from "@/types/health";

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export type { EmergencyContact };

export interface UserProfile {
  name: string;
  gender: "male" | "female" | "other" | "";
  age: number | "";
  city: string;
  workLocation: string;
  bloodGroup: BloodGroup | "";
  donatedBefore: boolean | null;
  hasHealthIssues: boolean | null;
  phone: string;
  // LifeLine-only confirmed donations (incremented only via dual confirmation)
  donationCount: number;
  streakMonths: number;
  // Pre-LifeLine: declared at signup, displayed separately, never counted in stats
  preLifelineDonations: number;
  // Last confirmed donation date (ISO date string "YYYY-MM-DD") for eligibility countdown
  lastDonationDate?: string;
  // User-editable health notes (synced to backend)
  healthNotes?: string;
  // Health identity — Phase 1
  lifeline_id?: string;
  abha_id?: string; // placeholder for future ABHA linking
  allergies?: string[];
  chronic_conditions?: string[];
  preferred_language?: string;
  profile_photo_url?: string;
  profile_photo_source?: "camera" | "gallery" | "google_profile" | "future_import";
  profile_photo_uploaded_at?: string;
  profile_photo_updated_at?: string;
  emergency_contacts?: EmergencyContact[];
}

interface ProfileContextType {
  profile: UserProfile | null;
  isAuthenticated: boolean;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (partial: Partial<UserProfile>) => void;
  clearProfile: () => Promise<void>;
  isLoading: boolean;
  federatedToken: string | null;
  bffFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const DEFAULTS: Partial<UserProfile> = {
  donationCount: 0,
  streakMonths: 0,
  preLifelineDonations: 0,
};

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [federatedToken, setFederatedToken] = useState<string | null>(() => localStorage.getItem("lifeline_federated_token"));

  const callIdentityBridge = useCallback(async (supabaseToken: string, lifelineId?: string, name?: string) => {
    try {
      const res = await fetch("/api/app/identity/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lifeline_id: lifelineId, name }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("lifeline_federated_token", data.token);
        setFederatedToken(data.token);
      }
    } catch {
      // Bridge unreachable — carry on without federated token
    }
  }, []);

  const bffFetch = useCallback(async (path: string, options?: RequestInit): Promise<Response> => {
    const token = localStorage.getItem("lifeline_federated_token");
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string>),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(path, { ...options, headers });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const stored = localStorage.getItem("lifeline_profile");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Generate LifeLine ID on first load if missing
          if (!parsed.lifeline_id) {
            parsed.lifeline_id = generateLifelineId();
            localStorage.setItem("lifeline_profile", JSON.stringify(parsed));
          }
          setProfileState({ ...DEFAULTS, ...parsed });
        } catch { /* ignore corrupt data */ }
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (event === "SIGNED_OUT") {
        setProfileState(null);
        localStorage.removeItem("lifeline_profile");
        localStorage.removeItem("lifeline_federated_token");
        setFederatedToken(null);
      }
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.access_token) {
        const stored = localStorage.getItem("lifeline_profile");
        const p = stored ? JSON.parse(stored) as Partial<UserProfile> : {};
        await callIdentityBridge(session.access_token, p.lifeline_id, p.name);
      }
    });

    return () => subscription.unsubscribe();
  }, [callIdentityBridge]);

  // Re-bridge on session change (initial load)
  useEffect(() => {
    if (session?.access_token && profile) {
      const existing = localStorage.getItem("lifeline_federated_token");
      if (!existing) {
        callIdentityBridge(session.access_token, profile.lifeline_id, profile.name);
      }
    }
  }, [session?.access_token, profile?.lifeline_id, callIdentityBridge]);

  const setProfile = (newProfile: UserProfile) => {
    const merged: UserProfile = {
      ...DEFAULTS,
      ...newProfile,
      lifeline_id: newProfile.lifeline_id ?? generateLifelineId(),
    };
    setProfileState(merged);
    localStorage.setItem("lifeline_profile", JSON.stringify(merged));
  };

  const updateProfile = (partial: Partial<UserProfile>) => {
    setProfileState((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      localStorage.setItem("lifeline_profile", JSON.stringify(updated));
      return updated;
    });
  };

  const clearProfile = async () => {
    await supabase.auth.signOut();
    setProfileState(null);
    localStorage.removeItem("lifeline_profile");
  };

  return (
    <ProfileContext.Provider value={{
      profile,
      isAuthenticated: session !== null,
      setProfile,
      updateProfile,
      clearProfile,
      isLoading,
      federatedToken,
      bffFetch,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
};
