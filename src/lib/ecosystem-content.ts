// ── Ecosystem Content Slots ─────────────────────────────────────────
// Lightweight admin-controlled dynamic content for home page banners
// and ecosystem announcements.
//
// LAYER 1: localStorage (admin-injected, highest priority)
// LAYER 2: API fetch (from admin backend)
// LAYER 3: Static fallback (hardcoded defaults)
//
// All layers gracefully degrade — never show broken states.

export interface EcosystemContentSlot {
  id: string;
  slot: "banner_hero" | "banner_secondary" | "announcement";
  active: boolean;
  priority: number;
  title: string;
  subtitle?: string;
  description?: string;
  image_url?: string;
  cta_label?: string;
  cta_type?: "in_app_page" | "external_url" | "register_form";
  cta_url?: string;
  bg_gradient?: string;
  icon_name?: string;
  expires_at?: string;
  created_at?: string;
}

const STORE_KEY = "lifeline_ecosystem_content";

// ── LocalStorage Admin Content ──────────────────────────────────────

export function getLocalContentSlots(): EcosystemContentSlot[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const slots = JSON.parse(raw) as EcosystemContentSlot[];
    const now = Date.now();
    return slots
      .filter((s) => {
        if (!s.active) return false;
        if (s.expires_at && new Date(s.expires_at).getTime() < now) return false;
        return true;
      })
      .sort((a, b) => b.priority - a.priority);
  } catch {
    return [];
  }
}

export function setLocalContentSlots(slots: EcosystemContentSlot[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(slots));
}

export function clearLocalContentSlots(): void {
  localStorage.removeItem(STORE_KEY);
}

// ── Merged Content (combines all layers) ────────────────────────────

export interface MergedBannerData {
  banners: Array<{
    title: string;
    description?: string;
    image_url?: string;
    bg_gradient?: string;
    icon?: string;
    label?: string;
    cta_label?: string;
    cta_type?: "in_app_page" | "external_url" | "register_form";
    cta_url?: string;
    is_sponsored?: boolean;
    id?: string;
  }>;
  source: "admin_local" | "admin_api" | "default_static";
}

const DAY_BANNERS = [
  {
    label: "Health Camp",
    bg_gradient: "from-primary to-red-800",
    icon: "Stethoscope",
    title: "Free Health Camp",
    description: "Blood tests, BP check & more — join us this Sunday",
    cta_label: "Register Free",
  },
  {
    label: "NGO Drive",
    bg_gradient: "from-red-700 to-rose-900",
    icon: "Heart",
    title: "NGO Donation Drive",
    description: "Give the gift of life. Camps across 20 Indian cities.",
    cta_label: "Find Nearest Camp",
  },
  {
    label: "Hospital Partner",
    bg_gradient: "from-rose-800 to-primary",
    icon: "Building",
    title: "Apollo × LifeLine",
    description: "Priority access & fast-track matching for registered donors.",
    cta_label: "Learn More",
  },
];

export function getDefaultStaticBanners(): MergedBannerData {
  return {
    banners: DAY_BANNERS,
    source: "default_static",
  };
}

// ── Admin API fetch (layer 2) ─────────────────────────────────────────

export async function fetchApiBanners(): Promise<MergedBannerData | null> {
  try {
    const res = await fetch("/api/ads/live");
    if (!res.ok) return null;
    const data = await res.json() as {
      ads?: Array<{ id: string; title: string; description: string | null; banner_url: string; cta_type: string; cta_url: string | null; is_sponsored: boolean }>;
      default_banners?: Array<{ id: string; title: string; description: string | null; image_url: string; cta_url: string | null }>;
    };
    const ads = data.ads ?? [];
    const banners = data.default_banners ?? [];

    if (ads.length > 0) {
      return {
        banners: ads.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description ?? undefined,
          image_url: a.banner_url,
          cta_label: a.cta_type === "register_form" ? "Register Free" : a.cta_type === "external_url" ? "Learn More" : "View",
          cta_type: a.cta_type as "in_app_page" | "external_url" | "register_form" | undefined,
          cta_url: a.cta_url ?? undefined,
          is_sponsored: a.is_sponsored,
        })),
        source: "admin_api",
      };
    }

    if (banners.length > 0) {
      return {
        banners: banners.map((b) => ({
          id: b.id,
          title: b.title,
          description: b.description ?? undefined,
          image_url: b.image_url,
        })),
        source: "admin_api",
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ── Get best available banners (async) ──────────────────────────────

export async function getBestBannersAsync(): Promise<MergedBannerData> {
  const localSlots = getLocalContentSlots();
  if (localSlots.length > 0) {
    return {
      banners: localSlots.map((s) => ({
        title: s.title,
        description: s.description ?? s.subtitle,
        image_url: s.image_url,
        bg_gradient: s.bg_gradient,
        icon: s.icon_name,
        label: s.slot === "banner_hero" ? "Featured" : "Announcement",
        cta_label: s.cta_label,
        cta_type: s.cta_type,
        cta_url: s.cta_url,
        id: s.id,
      })),
      source: "admin_local",
    };
  }

  const apiResult = await fetchApiBanners();
  if (apiResult) return apiResult;

  return getDefaultStaticBanners();
}

// ── Sync convenience (kept for backward compat) ─────────────────────

export function getBestBanners(): MergedBannerData {
  const localSlots = getLocalContentSlots();
  if (localSlots.length > 0) {
    return {
      banners: localSlots.map((s) => ({
        title: s.title,
        description: s.description ?? s.subtitle,
        image_url: s.image_url,
        bg_gradient: s.bg_gradient,
        icon: s.icon_name,
        label: s.slot === "banner_hero" ? "Featured" : "Announcement",
        cta_label: s.cta_label,
        cta_type: s.cta_type,
        cta_url: s.cta_url,
        id: s.id,
      })),
      source: "admin_local",
    };
  }

  return getDefaultStaticBanners();
}
