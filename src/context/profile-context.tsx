import React, { createContext, useContext, useState, useEffect } from "react";
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
  emergency_contacts?: EmergencyContact[];
}

interface ProfileContextType {
  profile: UserProfile | null;
  isAuthenticated: boolean;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (partial: Partial<UserProfile>) => void;
  clearProfile: () => Promise<void>;
  isLoading: boolean;
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "SIGNED_OUT") {
        setProfileState(null);
        localStorage.removeItem("lifeline_profile");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
