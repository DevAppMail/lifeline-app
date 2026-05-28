import { getTimeline, getFollowUps, getProviders } from "./health-store";
import { getActiveMedications } from "./medication-store";
import type { FollowUpRequest, LinkedProvider } from "@/types/health";
import type { MedicationSchedule } from "./medication-store";

export interface CareInsight {
  type:
    | "care_gap"
    | "missed_follow_up"
    | "medication_adherence"
    | "recurring_provider"
    | "follow_up_completion"
    | "upcoming_continuity";
  title: string;
  description: string;
  severity: "positive" | "info" | "gentle" | "attention";
  timestamp: string;
  actionable?: boolean;
  actionRoute?: string;
  actionLabel?: string;
}

interface ProviderVisitStats {
  name: string;
  lastVisit: string | null;
  totalVisits: number;
  hasFollowUp: boolean;
}

export function getProviderVisitStats(): ProviderVisitStats[] {
  const timeline = getTimeline();
  const providers = getProviders();
  const followUps = getFollowUps();

  const stats = new Map<string, { name: string; lastVisit: string | null; totalVisits: number; hasFollowUp: boolean }>();

  for (const prov of providers) {
    stats.set(prov.name, { name: prov.name, lastVisit: null, totalVisits: 0, hasFollowUp: false });
  }

  for (const entry of timeline) {
    if (!entry.provider) continue;
    const existing = stats.get(entry.provider);
    if (existing) {
      existing.totalVisits++;
      if (!existing.lastVisit || entry.date > existing.lastVisit) {
        existing.lastVisit = entry.date;
      }
    } else {
      stats.set(entry.provider, { name: entry.provider, lastVisit: entry.date, totalVisits: 1, hasFollowUp: false });
    }
  }

  for (const fu of followUps) {
    if (fu.status === "accepted" || fu.status === "pending_approval") {
      const existing = stats.get(fu.provider_name);
      if (existing) existing.hasFollowUp = true;
    }
  }

  return Array.from(stats.values()).sort((a, b) => (b.totalVisits - a.totalVisits));
}

export function getCareGaps(): CareInsight[] {
  const insights: CareInsight[] = [];
  const timeline = getTimeline();
  const now = Date.now();

  const appointments = timeline.filter(e => e.type === "appointment" && e.status === "completed");
  const lastAppt = appointments.length > 0
    ? appointments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;

  if (lastAppt) {
    const monthsSince = (now - new Date(lastAppt.date).getTime()) / (30 * 86400000);
    if (monthsSince > 6) {
      insights.push({
        type: "care_gap",
        title: "Time for a check-up",
        description: `It's been ${Math.round(monthsSince)} months since your last visit. Regular check-ups help catch issues early.`,
        severity: "gentle",
        timestamp: new Date().toISOString(),
        actionable: true,
        actionRoute: "/book-doctor",
        actionLabel: "Book a visit",
      });
    }
  } else {
    insights.push({
      type: "care_gap",
      title: "Welcome to your health journey",
      description: "Start building your health timeline by booking a consultation or adding a health note.",
      severity: "info",
      timestamp: new Date().toISOString(),
      actionable: true,
      actionRoute: "/book-doctor",
      actionLabel: "Find a doctor",
    });
  }

  return insights;
}

export function getMissedFollowUpInsights(): CareInsight[] {
  const insights: CareInsight[] = [];
  const followUps = getFollowUps();
  const now = Date.now();

  for (const fu of followUps) {
    if (fu.status !== "accepted" || !fu.recommended_date) continue;
    const dueDate = new Date(fu.recommended_date).getTime();
    if (now > dueDate) {
      const daysOverdue = Math.round((now - dueDate) / 86400000);
      insights.push({
        type: "missed_follow_up",
        title: `Follow-up overdue with ${fu.provider_name}`,
        description: daysOverdue === 1
          ? `Your follow-up was due yesterday. ${getFollowUpPurpose(fu.reason)}`
          : `Your follow-up is ${daysOverdue} days overdue. ${getFollowUpPurpose(fu.reason)}`,
        severity: daysOverdue > 7 ? "attention" : "gentle",
        timestamp: fu.recommended_date,
        actionable: true,
        actionRoute: "/follow-ups",
        actionLabel: daysOverdue > 7 ? "Reschedule now" : "View details",
      });
    }
  }

  return insights;
}

export function getMedicationAdherenceInsights(): CareInsight[] {
  const insights: CareInsight[] = [];
  const meds = getActiveMedications();
  const now = Date.now();

  for (const med of meds) {
    if (med.status !== "active") continue;
    if (med.endDate && new Date(med.endDate).getTime() < now) {
      insights.push({
        type: "medication_adherence",
        title: `${med.drugName} course completed`,
        description: `Your ${med.drugName} course ended on ${new Date(med.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`,
        severity: "positive",
        timestamp: med.endDate,
      });
    }
  }

  return insights;
}

export function getUpcomingContinuityInsights(): CareInsight[] {
  const insights: CareInsight[] = [];
  const followUps = getFollowUps();
  const now = Date.now();

  const upcoming = followUps
    .filter(f => f.status === "accepted" && f.recommended_date && new Date(f.recommended_date).getTime() > now)
    .sort((a, b) => new Date(a.recommended_date!).getTime() - new Date(b.recommended_date!).getTime());

  for (const fu of upcoming) {
    if (!fu.recommended_date) continue;
    const daysUntil = Math.round((new Date(fu.recommended_date).getTime() - now) / 86400000);
    if (daysUntil <= 7) {
      insights.push({
        type: "upcoming_continuity",
        title: `Follow-up with ${fu.provider_name} soon`,
        description: daysUntil === 0
          ? "Scheduled for today"
          : daysUntil === 1
            ? "Scheduled for tomorrow"
            : `Scheduled in ${daysUntil} days`,
        severity: daysUntil <= 1 ? "attention" : "info",
        timestamp: fu.recommended_date,
        actionable: true,
        actionRoute: "/follow-ups",
        actionLabel: "View details",
      });
    }
  }

  return insights;
}

export function getFollowUpCompletionInsights(): CareInsight[] {
  const insights: CareInsight[] = [];
  const followUps = getFollowUps();

  const completed = followUps.filter(f => f.status === "accepted" || f.status === "expired");
  const total = followUps.length;

  if (total > 0) {
    const rate = Math.round((completed.length / total) * 100);
    if (rate >= 80) {
      insights.push({
        type: "follow_up_completion",
        title: "Great follow-up adherence",
        description: `You've responded to ${completed.length} of ${total} follow-up recommendations.`,
        severity: "positive",
        timestamp: new Date().toISOString(),
      });
    }
  }

  return insights;
}

export function getAllCareInsights(): CareInsight[] {
  return [
    ...getCareGaps(),
    ...getMissedFollowUpInsights(),
    ...getMedicationAdherenceInsights(),
    ...getUpcomingContinuityInsights(),
    ...getFollowUpCompletionInsights(),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function getProviderContinuityLabel(providerName: string): string {
  const stats = getProviderVisitStats();
  const prov = stats.find(p => p.name === providerName);
  if (!prov || !prov.lastVisit) return "First visit";
  const monthsSince = Math.round((Date.now() - new Date(prov.lastVisit).getTime()) / (30 * 86400000));
  if (monthsSince === 0) return "Visited this month";
  if (monthsSince === 1) return "Visited last month";
  if (monthsSince < 6) return `Visited ${monthsSince} months ago`;
  return `Visited ${monthsSince} months ago`;
}

function getFollowUpPurpose(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("bp") || lower.includes("blood pressure")) return "Regular monitoring helps manage your blood pressure effectively.";
  if (lower.includes("sugar") || lower.includes("diabetes") || lower.includes("diabetic")) return "Consistent follow-ups are key to managing diabetes.";
  if (lower.includes("thyroid")) return "Thyroid levels should be checked periodically to ensure proper medication dosage.";
  if (lower.includes("heart") || lower.includes("cardiac")) return "Cardiac follow-ups help track your recovery and prevent complications.";
  if (lower.includes("lab") || lower.includes("test") || lower.includes("report")) return "Reviewing test results with your doctor ensures timely adjustments to your care plan.";
  if (lower.includes("pain")) return "Ongoing pain management follow-ups help optimize your treatment approach.";
  if (lower.includes("wound") || lower.includes("dressing")) return "Regular wound checks are important for proper healing.";
  if (lower.includes("vaccine") || lower.includes("vaccination")) return "Staying up to date with vaccinations protects your long-term health.";
  if (lower.includes("dental") || lower.includes("tooth")) return "Regular dental check-ups prevent complications and maintain oral health.";
  if (lower.includes("eye") || lower.includes("vision")) return "Routine eye exams help detect changes in vision and eye health early.";
  if (lower.includes("cancer") || lower.includes("oncology")) return "Regular oncology follow-ups are essential for monitoring your recovery.";
  if (lower.includes("therapy") || lower.includes("physio")) return "Consistent therapy sessions support steady improvement in mobility and function.";
  if (lower.includes("check") || lower.includes("review") || lower.includes("follow")) return "Regular check-ups help your provider track your health over time.";
  return "This follow-up helps your provider ensure your treatment is on track.";
}
