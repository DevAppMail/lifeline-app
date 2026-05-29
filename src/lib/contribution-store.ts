import type { ContributionRecord, ContributionType, ContributionMemory } from "@/types/contribution";
import { CONTRIBUTION_TYPE_META } from "@/types/contribution";
import { addTimelineEntry, generateId } from "@/lib/health-store";

const STORAGE_KEY = "lifeline_contribution_memory";

function read(): ContributionRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(records: ContributionRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function addContribution(params: {
  type: ContributionType;
  lifelineId: string;
  donorName: string;
  requestId?: string;
  donationDate: string;
  location?: string;
  organizer?: string;
  donationCardUrl?: string;
  donationPhotoUrl?: string;
  notes?: string;
}): ContributionRecord {
  const records = read();
  const record: ContributionRecord = {
    id: generateId(),
    type: params.type,
    lifelineId: params.lifelineId,
    requestId: params.requestId,
    donorName: params.donorName,
    donationDate: params.donationDate,
    recordedAt: new Date().toISOString(),
    location: params.location,
    organizer: params.organizer,
    donationCardUrl: params.donationCardUrl,
    donationPhotoUrl: params.donationPhotoUrl,
  };
  records.push(record);
  write(records);

  const meta = CONTRIBUTION_TYPE_META[params.type];
  addTimelineEntry({
    id: record.id,
    type: meta.timelineType === "donation_recorded" ? "donation" : "health_note",
    date: params.donationDate,
    title: meta.title,
    subtitle: params.location ?? meta.subtitle,
    location: params.location,
    notes: params.notes,
  });

  return record;
}

export function getContributions(): ContributionRecord[] {
  return read().sort((a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime());
}

export function getContributionById(id: string): ContributionRecord | undefined {
  return read().find((c) => c.id === id);
}

export function getDonationCount(): number {
  return read().filter((c) =>
    c.type === "emergency_fulfillment" ||
    c.type === "independent_donation" ||
    c.type === "camp_donation",
  ).length;
}

export function getContributionMemory(): ContributionMemory {
  const records = read();
  const donations = records.filter((c) =>
    c.type === "emergency_fulfillment" ||
    c.type === "independent_donation" ||
    c.type === "camp_donation",
  );
  return {
    contributions: donations,
    totalCount: donations.length,
    lastDonationDate: donations.length > 0
      ? donations.sort((a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime())[0].donationDate
      : null,
    consecutiveMonths: calcConsecutiveMonths(donations),
  };
}

function calcConsecutiveMonths(records: ContributionRecord[]): number {
  if (records.length === 0) return 0;
  const dates = records.map((r) => {
    const d = new Date(r.donationDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const unique = [...new Set(dates)].sort().reverse();
  let count = 0;
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  for (const month of unique) {
    if (count === 0 && month !== current) break;
    const expected = count === 0
      ? current
      : decrementMonth(unique[count - 1]);
    if (month === expected) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function decrementMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function markAppreciationGenerated(recordId: string): void {
  const records = read();
  const idx = records.findIndex((r) => r.id === recordId);
  if (idx >= 0) {
    records[idx].appreciationGeneratedAt = new Date().toISOString();
    write(records);
  }
}

export function getTotalContributionsByType(): Record<ContributionType, number> {
  const records = read();
  return {
    emergency_fulfillment: records.filter((r) => r.type === "emergency_fulfillment").length,
    independent_donation: records.filter((r) => r.type === "independent_donation").length,
    camp_donation: records.filter((r) => r.type === "camp_donation").length,
    medical_deferral: records.filter((r) => r.type === "medical_deferral").length,
    commitment_accepted: records.filter((r) => r.type === "commitment_accepted").length,
  };
}

export function clearAllContributions(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function updateDonorLastDonationDate(lifelineId: string, donationDate: string): boolean {
  try {
    const profile = JSON.parse(localStorage.getItem("lifeline_profile") ?? "{}");
    const current = profile.lastDonationDate ?? "";
    if (current && new Date(donationDate) <= new Date(current)) {
      return false;
    }
    profile.lastDonationDate = donationDate;
    localStorage.setItem("lifeline_profile", JSON.stringify(profile));
    fetch("/api/donors/update-last-donation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lifeline_id: lifelineId, last_donation_date: donationDate }),
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}
