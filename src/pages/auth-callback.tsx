import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Droplet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/context/profile-context";
import type { Session } from "@supabase/supabase-js";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { profile, updateProfile } = useProfile();
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    let handled = false;

    async function handleSession(session: Session) {
      if (handled) return;
      handled = true;

      setStatus("Loading your profile…");

      try {
        const res = await fetch(
          `/api/users/lookup?email=${encodeURIComponent(session.user.email!)}`
        );

        if (res.ok) {
          const data = await res.json() as {
            user: { name?: string; blood_group?: string; location?: string };
            donor: { lifeline_donations: number; pre_lifeline_donations: number; last_donation_date: string | null } | null;
          };
          updateProfile({
            ...(data.user?.blood_group ? { bloodGroup: data.user.blood_group as any } : {}),
            ...(data.user?.location ? { city: data.user.location } : {}),
            ...(data.donor ? {
              donationCount: data.donor.lifeline_donations,
              preLifelineDonations: data.donor.pre_lifeline_donations,
              lastDonationDate: data.donor.last_donation_date ?? undefined,
            } : {}),
          });
          // Returning user with a name → home; otherwise complete onboarding
          setLocation(profile?.name || data.user?.name ? "/home" : "/onboarding");
        } else {
          // 404 — new signup, no backend record yet
          setLocation("/onboarding");
        }
      } catch {
        setLocation(profile?.name ? "/home" : "/onboarding");
      }
    }

    // Primary: listen for the SIGNED_IN event that fires when Supabase
    // exchanges the URL hash tokens on page load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) handleSession(session);
      }
    );

    // Fallback: the listener above may miss the event if it fires before
    // this effect runs. Check the current session immediately.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 text-center">
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary/30"
      >
        <Droplet className="w-8 h-8 text-white fill-white/60" />
      </motion.div>
      <p className="text-base font-semibold text-foreground">{status}</p>
      <p className="text-sm text-muted-foreground mt-1">Just a moment…</p>
    </div>
  );
}
