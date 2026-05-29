// ── Context-Aware Breadcrumb Navigation ────────────────────────────
// Maps routes to breadcrumb labels and parent relationships.
// Designed for future module expansion without redesign.

import { useLocation } from "wouter";
import { useMemo } from "react";

export interface BreadcrumbSegment {
  label: string;
  path: string;
}

export interface BreadcrumbData {
  segments: BreadcrumbSegment[];
  currentLabel: string;
  backLabel: string | null;
  backPath: string | null;
  /** Top-level section this page belongs to (Home, Requests, Health, etc.) */
  section: string | null;
}

interface RouteEntry {
  label: string;
  parent: string | null;
  section: string | null;
}

// ── Route Map ────────────────────────────────────────────────────────
// Path patterns → breadcrumb metadata.
// Matched in order — first match wins. Dynamic segments use prefix matching.

const ROUTE_MAP: [string, RouteEntry][] = [
  // Public / auth — no breadcrumb
  ["/login",            { label: "", parent: null, section: null }],
  ["/onboarding",       { label: "", parent: null, section: null }],
  ["/auth/callback",    { label: "", parent: null, section: null }],

  // Top-level (section roots)
  ["/home",             { label: "Dashboard", parent: null, section: "Home" }],
  ["/donate",           { label: "Donor Hub", parent: "/home", section: "Donate" }],
  ["/requests",         { label: "Blood Requests", parent: "/home", section: "Requests" }],
  ["/notifications",    { label: "Notifications", parent: "/home", section: "Home" }],
  ["/profile",          { label: "My Profile", parent: "/home", section: "Profile" }],

  // Blood request flow
  ["/request-blood",        { label: "New Blood Request", parent: "/home", section: "Requests" }],
  ["/request-confirmation", { label: "Request Confirmed", parent: "/request-blood", section: "Requests" }],
  ["/request-status",       { label: "Request Status", parent: "/home", section: "Requests" }],

  // Individual request detail — show in context
  ["/requests/",        { label: "Request Details", parent: "/requests", section: "Requests" }],
  ["/request-status/",  { label: "Request Details", parent: "/request-status", section: "Requests" }],

  // Doctor / Appointment flow
  ["/book-doctor",          { label: "Find a Doctor", parent: "/home", section: "Health" }],
  ["/doctor/",              { label: "Doctor Profile", parent: "/book-doctor", section: "Health" }],
  ["/book-appointment/",    { label: "Book Appointment", parent: "/book-doctor", section: "Health" }],
  ["/booking-confirmed",    { label: "Booking Confirmed", parent: "/book-appointment/", section: "Health" }],

  // Health module
  ["/health",               { label: "Health Dashboard", parent: "/home", section: "Health" }],
  ["/health-timeline",      { label: "Health Timeline", parent: "/health", section: "Health" }],
  ["/follow-ups",           { label: "Follow-ups", parent: "/health", section: "Health" }],
  ["/providers",            { label: "My Providers", parent: "/health", section: "Health" }],
  ["/care-circle",          { label: "Care Circle", parent: "/profile", section: "Profile" }],

  // Events
  ["/events",           { label: "Community Events", parent: "/home", section: "Home" }],
  ["/events/",          { label: "Event Details", parent: "/events", section: "Home" }],

  // Voluntary donation
  ["/voluntary-donation", { label: "Record Donation", parent: "/donate", section: "Donate" }],
];

// ── Path Matching ────────────────────────────────────────────────────

function matchRoute(path: string): RouteEntry | null {
  // Exact match first
  for (const [pattern, entry] of ROUTE_MAP) {
    if (pattern === path) return entry;
  }
  // Prefix match for dynamic segments (e.g., /requests/abc123)
  for (const [pattern, entry] of ROUTE_MAP) {
    if (pattern.endsWith("/") && path.startsWith(pattern)) return entry;
  }
  return null;
}

function getParentPath(currentPath: string, parentPattern: string | null): string | null {
  if (!parentPattern) return null;
  // If parent ends with "/", it's a prefix — keep the current path's dynamic part
  // but navigate to the parent listing. Just return the clean parent path.
  return parentPattern;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useBreadcrumb(): BreadcrumbData {
  const [location] = useLocation();
  return useMemo(() => {
    const entry = matchRoute(location);

    // Pages with no breadcrumb (auth, onboarding, 404)
    if (!entry || !entry.label) {
      return {
        segments: [],
        currentLabel: "",
        backLabel: null,
        backPath: null,
        section: null,
      };
    }

    const backPath = getParentPath(location, entry.parent);

    // Build segment chain
    const segments: BreadcrumbSegment[] = [];
    let currentParent = entry.parent;

    // Walk up one level for "← Back to [parent]" label
    if (currentParent) {
      const parentEntry = matchRoute(currentParent);
      if (parentEntry?.label) {
        segments.unshift({ label: parentEntry.label, path: currentParent });
      }
    }

    const backLabel = segments.length > 0 ? segments[0].label : null;

    return {
      segments,
      currentLabel: entry.label,
      backLabel,
      backPath,
      section: entry.section,
    };
  }, [location]);
}

export default useBreadcrumb;
