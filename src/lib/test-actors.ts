// ── Test Actors for Operational QA ─────────────────────────────────
// Persistable localStorage configurations for repeated testing sessions.
// Run `setupDonorActor()` or `setupRequesterActor()` from browser console.

const DEV_BYPASS_KEY = "DEV_BYPASS";
const PROFILE_KEY = "lifeline_profile";
const AVAIL_KEY = "lifeline_donor_availability";
const STATE_KEY = "lifeline_donor_operational_state";

interface ActorProfile {
  name: string;
  phone: string;
  age: number;
  gender: string;
  city: string;
  bloodGroup: string;
  donationCount: number;
  preLifelineDonations: number;
  lastDonationDate?: string;
}

function persistActor(
  bypass: boolean,
  profile: ActorProfile,
  availability: Record<string, unknown>,
  operational: Record<string, unknown>
): void {
  if (bypass) localStorage.setItem(DEV_BYPASS_KEY, "true");
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(AVAIL_KEY, JSON.stringify(availability));
  localStorage.setItem(STATE_KEY, JSON.stringify(operational));
  console.log(`[TestActor] Setup complete for ${profile.name}`);
}

// ── Donor Actor ────────────────────────────────────────────────────

export function setupDonorActor(): void {
  persistActor(
    true,
    {
      name: "Test Donor Rahul",
      phone: "+919876543210",
      age: 28,
      gender: "male",
      city: "Mumbai",
      bloodGroup: "O+",
      donationCount: 3,
      preLifelineDonations: 5,
      lastDonationDate: "2026-02-15",
    },
    {
      active: true,
      mode: "always",
      weekly_schedule: {
        monday: [{ start: "09:00", end: "17:00" }],
        tuesday: [{ start: "09:00", end: "17:00" }],
        wednesday: [{ start: "09:00", end: "17:00" }],
        thursday: [{ start: "09:00", end: "17:00" }],
        friday: [{ start: "09:00", end: "17:00" }],
        saturday: [],
        sunday: [],
      },
      temporarily_unavailable: false,
      max_travel_radius_km: 10,
      preferred_time_of_day: "flexible",
      updated_at: new Date().toISOString(),
    },
    {
      state: "available",
      availability_mode: "always",
      consecutive_ghosts: 0,
      total_commitments: 3,
      successful_donations: 3,
      reliability_tier: "high",
    }
  );
}

// ── Cooldown Donor Actor ───────────────────────────────────────────

export function setupCooldownDonorActor(): void {
  persistActor(
    true,
    {
      name: "Test Donor Priya",
      phone: "+919876543211",
      age: 32,
      gender: "female",
      city: "Delhi",
      bloodGroup: "A+",
      donationCount: 1,
      preLifelineDonations: 2,
      lastDonationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
    {
      active: true,
      mode: "always",
      weekly_schedule: {
        monday: [{ start: "09:00", end: "17:00" }],
        tuesday: [{ start: "09:00", end: "17:00" }],
        wednesday: [{ start: "09:00", end: "17:00" }],
        thursday: [{ start: "09:00", end: "17:00" }],
        friday: [{ start: "09:00", end: "17:00" }],
        saturday: [],
        sunday: [],
      },
      temporarily_unavailable: false,
      max_travel_radius_km: 10,
      preferred_time_of_day: "flexible",
      updated_at: new Date().toISOString(),
    },
    {
      state: "cooldown",
      availability_mode: "always",
      consecutive_ghosts: 0,
      total_commitments: 1,
      successful_donations: 1,
      reliability_tier: "moderate",
    }
  );
}

// ── Requester Actor ────────────────────────────────────────────────

export function setupRequesterActor(): void {
  persistActor(
    true,
    {
      name: "Test Requester Anita",
      phone: "+919876543212",
      age: 35,
      gender: "female",
      city: "Mumbai",
      bloodGroup: "B+",
      donationCount: 0,
      preLifelineDonations: 0,
      lastDonationDate: undefined,
    },
    {
      active: false,
      mode: "unavailable",
      weekly_schedule: {
        monday: [], tuesday: [], wednesday: [], thursday: [], friday: [],
        saturday: [], sunday: [],
      },
      temporarily_unavailable: false,
      max_travel_radius_km: 10,
      preferred_time_of_day: "flexible",
      updated_at: new Date().toISOString(),
    },
    {
      state: "available",
      availability_mode: "unavailable",
      consecutive_ghosts: 0,
      total_commitments: 0,
      successful_donations: 0,
      reliability_tier: "unproven",
    }
  );
}

// ── Fresh Donor Actor (no history) ─────────────────────────────────

export function setupFreshDonorActor(): void {
  persistActor(
    true,
    {
      name: "Test Donor New",
      phone: "+919876543213",
      age: 22,
      gender: "male",
      city: "Bangalore",
      bloodGroup: "AB+",
      donationCount: 0,
      preLifelineDonations: 0,
    },
    {
      active: true,
      mode: "always",
      weekly_schedule: {
        monday: [{ start: "09:00", end: "17:00" }],
        tuesday: [{ start: "09:00", end: "17:00" }],
        wednesday: [{ start: "09:00", end: "17:00" }],
        thursday: [{ start: "09:00", end: "17:00" }],
        friday: [{ start: "09:00", end: "17:00" }],
        saturday: [],
        sunday: [],
      },
      temporarily_unavailable: false,
      max_travel_radius_km: 10,
      preferred_time_of_day: "flexible",
      updated_at: new Date().toISOString(),
    },
    {
      state: "available",
      availability_mode: "always",
      consecutive_ghosts: 0,
      total_commitments: 0,
      successful_donations: 0,
      reliability_tier: "unproven",
    }
  );
}

// ── Clean slate ────────────────────────────────────────────────────

export function resetAllTestState(): void {
  const keys = [
    DEV_BYPASS_KEY, PROFILE_KEY, AVAIL_KEY, STATE_KEY,
    "lifeline_blood_requests", "lifeline_donor_assignments",
    "lifeline_audit_log", "lifeline_escalations",
    "lifeline_notification_queue", "lifeline_commitments",
    "lifeline_health_timeline", "lifeline_care_circle",
  ];
  keys.forEach((k) => localStorage.removeItem(k));
  console.log("[TestActor] All test state reset");
}

// Expose globally for console use
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__testActors = {
    setupDonorActor,
    setupCooldownDonorActor,
    setupRequesterActor,
    setupFreshDonorActor,
    resetAllTestState,
  };
}
