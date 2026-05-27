const RSVP_KEY = "lifeline_event_rsvps";
const PARTICIPATION_KEY = "lifeline_event_participation";

export interface EventRSVP {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventType: string;
  status: "going" | "maybe" | "declined";
  respondedAt: string;
}

export function getRSVPs(): EventRSVP[] {
  try {
    return JSON.parse(localStorage.getItem(RSVP_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function setRSVP(eventId: string, title: string, date: string, eventType: string, status: EventRSVP["status"]): void {
  const all = getRSVPs().filter(r => r.eventId !== eventId);
  all.unshift({ eventId, eventTitle: title, eventDate: date, eventType, status, respondedAt: new Date().toISOString() });
  localStorage.setItem(RSVP_KEY, JSON.stringify(all));
}

export function getRSVP(eventId: string): EventRSVP | undefined {
  return getRSVPs().find(r => r.eventId === eventId);
}

export function recordParticipation(eventId: string, eventTitle: string, eventDate: string): void {
  const all: { eventId: string; eventTitle: string; eventDate: string; recordedAt: string }[] = [];
  try {
    const raw = localStorage.getItem(PARTICIPATION_KEY);
    if (raw) all.push(...JSON.parse(raw));
  } catch { /* silent */ }

  if (!all.some(p => p.eventId === eventId)) {
    all.unshift({ eventId, eventTitle, eventDate, recordedAt: new Date().toISOString() });
    localStorage.setItem(PARTICIPATION_KEY, JSON.stringify(all));
  }
}

export function getParticipationHistory(): { eventId: string; eventTitle: string; eventDate: string; recordedAt: string }[] {
  try {
    return JSON.parse(localStorage.getItem(PARTICIPATION_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function getUpcomingRSVPs(): EventRSVP[] {
  return getRSVPs().filter(r => {
    if (r.status === "declined") return false;
    return new Date(r.eventDate) >= new Date();
  }).sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
}
