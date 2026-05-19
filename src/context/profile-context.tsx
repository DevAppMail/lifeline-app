import React, { createContext, useContext, useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

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
          setProfileState({ ...DEFAULTS, ...JSON.parse(stored) });
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
    const merged = { ...DEFAULTS, ...newProfile };
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
