// ── Basic Matching Engine (Sprint 1) ────────────────────────────────
// Filters and ranks donors for blood requests.
// Blood compatibility → availability → cooldown → radius → urgency ranking.

import {
  type BloodRequestFull,
  type BloodGroup,
  type MatchResult,
  type MatchingConfig,
  type RequestTier,
  isBloodCompatible,
  isRareBlood,
} from "@/types/fulfillment";
import { isDonorAvailableForTier, isDonorInCooldown } from "@/lib/donor-availability";

// ── Donor Record (MVP shape — should merge with real donor DB) ─────

export interface DonorRecord {
  id: string;
  name: string;
  blood_group: BloodGroup;
  city: string;
  lat?: number;
  lng?: number;
  availability_toggle: boolean;
  last_donation_date?: string;
  availability_mode: string;
  reliability_tier?: string;
}

// ── Blood Compatibility Matrix ─────────────────────────────────────

export function findCompatibleBloodGroups(patientBlood: BloodGroup): BloodGroup[] {
  const all: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  return all.filter((donor) => isBloodCompatible(donor, patientBlood));
}

// ── Radius Filter ───────────────────────────────────────────────────

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateDistance(donorCity: string, hospitalCity: string): number {
  // MVP: use city-level estimation if exact coords not available
  if (donorCity === hospitalCity) return Math.random() * 8 + 1; // 1-9 km within city
  return Math.random() * 20 + 10; // 10-30 km between cities
}

// ── Main Matching Function ──────────────────────────────────────────

export function findMatchingDonors(
  request: BloodRequestFull,
  availableDonors: DonorRecord[],
  config?: Partial<MatchingConfig>
): MatchResult[] {
  const cfg: MatchingConfig = {
    radius_km: config?.radius_km ?? request.current_radius_km,
    max_results: config?.max_results ?? 20,
    include_time_incompatible: config?.include_time_incompatible ?? request.tier === "emergency",
    require_availability: config?.require_availability ?? true,
    tier: request.tier,
  };

  const compatibleGroups = findCompatibleBloodGroups(request.blood_group);

  // Phase 1: Filter
  const eligible = availableDonors.filter((donor) => {
    // Blood compatibility
    if (!compatibleGroups.includes(donor.blood_group)) return false;

    // Availability toggle
    if (!donor.availability_toggle) return false;

    // Availability mode
    if (cfg.require_availability && !isDonorAvailableForTier(cfg.tier, {
      mode: donor.availability_mode as any,
      weekly_schedule: {
        monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
      },
      temporarily_unavailable: false,
      max_travel_radius_km: 10,
      preferred_time_of_day: "flexible",
      updated_at: new Date().toISOString(),
    })) return false;

    // Cooldown check
    const cooldown = isDonorInCooldown(donor.last_donation_date);
    if (cooldown.inCooldown) return false;

    return true;
  });

  // Phase 2: Score & Rank
  const results: MatchResult[] = eligible.map((donor) => {
    const distance = donor.lat && donor.lng && request.hospital_lat && request.hospital_lng
      ? haversineDistance(donor.lat, donor.lng, request.hospital_lat, request.hospital_lng)
      : estimateDistance(donor.city, request.hospital_city);

    // Availability confidence
    let availabilityConfidence = 0.6;
    if (donor.availability_mode === "always") availabilityConfidence += 0.3;
    if (donor.reliability_tier === "high") availabilityConfidence += 0.1;
    if (donor.reliability_tier === "moderate") availabilityConfidence += 0.05;
    if (donor.reliability_tier === "low") availabilityConfidence -= 0.2;

    const timeCompatible = distance <= cfg.radius_km;

    return {
      donor_id: donor.id,
      donor_name: donor.name,
      blood_group: donor.blood_group,
      distance_km: Math.round(distance * 10) / 10,
      availability_confidence: Math.min(1, Math.max(0, availabilityConfidence)),
      match_rank: 0, // set below
      time_compatible: timeCompatible,
    };
  });

  // Phase 3: Rank
  const sorted = results.sort((a, b) => {
    // Exact match first
    const aExact = a.blood_group === request.blood_group ? 1 : 0;
    const bExact = b.blood_group === request.blood_group ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    // Time compatible
    if (a.time_compatible !== b.time_compatible) return a.time_compatible ? -1 : 1;

    // Distance
    if (a.distance_km !== b.distance_km) return a.distance_km - b.distance_km;

    // Availability confidence
    return b.availability_confidence - a.availability_confidence;
  });

  // Assign ranks
  return sorted.slice(0, cfg.max_results).map((r, i) => ({
    ...r,
    match_rank: i + 1,
  }));
}

// ── Radius Suggestion ───────────────────────────────────────────────

export function suggestRadius(
  requestTier: RequestTier,
  currentRadius: number,
  rareBlood: boolean
): number {
  const defaults: Record<RequestTier, number[]> = {
    scheduled: [5, 10, 25, 50],
    urgent: [10, 25, 50],
    emergency: [10, 25, 50],
  };

  const tiers = defaults[requestTier];
  const currentIdx = tiers.indexOf(currentRadius);

  if (rareBlood) {
    return tiers[Math.min(currentIdx + 2, tiers.length - 1)]; // Skip faster
  }

  if (currentIdx < tiers.length - 1) {
    return tiers[currentIdx + 1];
  }

  return currentRadius; // Already max
}

// ── Helpers for page integration ────────────────────────────────────

export function getMatchedDonorsCount(request: BloodRequestFull, availableCount: number): { compatible: number; contacted: number; committed: number } {
  return {
    compatible: Math.min(availableCount, 20),
    contacted: request.donors_contacted,
    committed: request.donors_committed,
  };
}
