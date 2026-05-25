# lifeline-app — Operational Architecture Memory
# AI development memory for the patient and donor-facing PWA

---

## What This App Is

lifeline-app is what real people open when they are scared, sick, or trying to help someone.

A blood seeker opens it when a family member needs blood tomorrow.
A donor opens it to check if they're eligible and whether anyone needs help today.
A patient opens it to see their health history before a doctor's visit.

This is not a social app. It is not a health tracker. It is not a marketplace.

It is a coordination layer between people in need and people who can help — wrapped in the lightest, calmest interface possible.

Every design and architecture decision must serve that reality.

---

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 + Radix UI + shadcn/ui components
- TanStack Query for server state (Supabase)
- Wouter for routing
- React Hook Form + Zod for forms
- Sonner for toasts
- Framer Motion for meaningful transitions (not decoration)
- Supabase for auth, DB, storage
- localStorage for offline-first local state (health store, commitments, profile)

Deployment: Railway (moving from Replit).

---

## User Onboarding Philosophy

Onboarding is 2 screens. That is the ceiling — not a starting point.

**Screen 1** (required): name, gender, age, city. Work location is optional.
**Screen 2** (skippable): blood group, donated before, known health issues.

Blood group can be "I don't know" — never block onboarding on health information the user may genuinely not have. The field `bloodGroupUnknown` is a first-class state, not a workaround.

`donationCount` starts at 0 on LifeLine, always. Previous donations declared at signup go into `preLifelineDonations` — displayed separately, never counted in platform stats. This distinction is architecturally enforced in `UserProfile` and must not be collapsed.

A LifelineID (`LL-XXXXXXXX`) is generated locally on first profile load if missing. The character set deliberately excludes `I`, `O`, `0`, `1` to prevent visual confusion in India where users read IDs aloud or write them by hand.

**Onboarding rules:**
- Never add a third step without explicit instruction
- Never require email — phone is the primary Indian identity
- Never require blood group to complete signup
- Never block the home screen pending profile completion
- Profile completion is nudged, never enforced

---

## Identity Architecture

There are two identity layers that coexist:

| Layer | What It Is | Where It Lives |
|-------|-----------|----------------|
| Auth session | Supabase session (email/phone + JWT) | Supabase + memory |
| User profile | Health identity + donation history | localStorage + Supabase sync |

`ProfileContext` owns both. It reads the Supabase session AND local storage on init. They are not the same thing. A user can be authenticated without having a complete profile — that is a valid, handled state.

`lifeline_id` is the human-readable health identity (`LL-XXXXXXXX`). It is generated client-side on first load and persisted in localStorage. It is NOT the Supabase `user.id`. When syncing to Supabase, store it as a column on the user record.

`abha_id` is reserved for India's Ayushman Bharat Health Account. It is a placeholder in Phase 1 — do not build ABHA linking until Phase 2.

---

## Blood Donation Coordination Philosophy

The core blood donation flow has three tiers. These are non-negotiable:

| Tier | Response Time | Platform Fee | Who It's For |
|------|-------------|-------------|-------------|
| `scheduled` | 3–7 days | ₹99 | Planned procedures, advance notice |
| `urgent` | 48–72 hours | ₹299 (deposit held) | Time-sensitive, priority matching |
| `emergency` | 2–4 hours | ₹499 (priority deposit) | Critical — broadcast to all donors in city |

The fee is a coordination/platform fee, never payment for blood. This language must be consistent in all UI copy. Emergency tier broadcasts to all available donors in the city — no radius cap. All other tiers use the 10km default radius, expandable to 50km.

### Commitment lifecycle
```
donor sees request → commits → committed
      ↓
requester confirmed / admin confirms → awaiting_confirmation
      ↓
donor marks donated → completed
  or
no-show → missed
```

Commitments are stored in localStorage via `lib/commitments.ts`. They are not yet DB-persisted as a primary record — the localStorage is the source of truth for donor-side commitment state. The DB holds `donation_confirmations`, which are the post-donation records.

`seen_ids` (localStorage) tracks which requests the donor has already seen — prevents the same request appearing "new" on refresh.

### Eligibility
Whole blood donation cooldown: **90 days**.
`calcEligibility(lastDonationDate)` in `donate.tsx` is the single calculation. The result drives the entire donor availability state. Do not duplicate this logic elsewhere.

`lastDonationDate` is set from two sources:
- Pre-LifeLine: declared at signup as approximate month/year (stored as YYYY-MM-15 approximation)
- Post-LifeLine: set from confirmed `donation_confirmations` records

Only confirmed LifeLine donations increment `donationCount`. Pre-LifeLine declarations are shown separately and never enter platform stats.

---

## Appointment Booking Philosophy

Appointments in lifeline-app connect patients to lifeline-pro providers.

The booking flow: `providers page → doctor-profile → book-doctor → book-appointment → booking-confirmed`

Key rules:
- Show provider availability slots, not a raw calendar — users should not have to figure out when a doctor is free
- Booking-confirmed is a moment, not a form — confirmation page is celebratory and simple
- `appointment_source` for patient-initiated bookings is always `patient`
- The appointment is created in the lifeline-pro DB, not locally — it must appear in the provider's queue

Appointments appear on the user's health timeline as `type: "appointment"` entries. They must be added to the local health store on booking confirmation.

---

## Health Timeline Philosophy

The health timeline is the user's personal medical continuity record. It is the most trusted surface in the app.

`TimelineEntryType` values: `donation | appointment | follow_up | encounter | prescription | report | health_note | home_visit | lab_test`

Timeline is stored in localStorage via `health-store.ts` (`lifeline_health_timeline`). It is append-only — entries are added, never updated in-place (use the `filter + prepend` pattern already established). The only exception is `is_placeholder: true` entries which are replaced when the real data arrives.

**What goes on the timeline:**
- Every confirmed donation
- Every booked/completed appointment
- Every accepted follow-up
- Provider-issued encounters (once the pro integration is complete)
- User-added health notes

**What does NOT go on the timeline:**
- Cancelled or missed events that were never acted upon
- Speculative future events not yet confirmed
- Notifications or messages

The timeline is a health record, not a chat history. Only clinically meaningful events belong.

---

## Donor Engagement Philosophy

Engagement must be earned, not manufactured.

### Badge progression (recognition, not gamification)
```
0 donations     → New Donor
1–3 donations   → Active Donor
4–10 donations  → Verified Hero
11+ donations   → Lifesaver Elite
```

Badges are visual recognition — they are shown on the donor page. They are NOT used to gate features, unlock content, or create streak anxiety. A donor who skips 6 months is still a Verified Hero.

### The celebration moment
When a donation is confirmed, a single celebration is shown — confetti, count increment, lives saved. This is `postState: "celebration"` in `donate.tsx`. It fires once, per confirmed donation, via the pending celebrations queue in localStorage.

The celebration is **one moment** for **one real act**. It is not a loop, not a score, not a leaderboard. Do not build daily streaks, push notifications pressuring donors, or "you haven't donated in X days" messages.

### Perks and coupons
Donors receive pharmacy discounts, lab test discounts, and health drink offers. These are tangible, practical benefits — not points, not virtual rewards. Keep them practical and Indian-context relevant.

### Availability toggle
`availability_toggle` on the donor record is the donor's real-time opt-in for notifications. When off, no donor-matching notifications are sent. Respect this completely — never notify an unavailable donor.

---

## Notification Philosophy

Notifications serve coordination, not engagement.

**What warrants a notification:**
- A blood request matching your blood group within your radius
- Your follow-up appointment is tomorrow (one reminder, not three)
- Your donation was confirmed by the requester
- A provider has sent a follow-up recommendation

**What never warrants a notification:**
- "You haven't logged in in a while"
- "Check out new donors near you"
- Promotional messages from ads or health camps
- Badge unlocks or streak milestones

Notification delivery goes through MSG91 SMS. SMS is mission-critical — a missed notification may mean a missed donation. Log every send attempt. Failed sends must surface in admin, not silently disappear.

The `availability_toggle` on the donor record is the master gate. Check it before every donor notification. No exceptions.

---

## Health Camp and Events Philosophy

Events (`events`, `event-detail` pages) are health camps, blood drives, and donation events.

Ads from the admin ad platform may appear in the app — they are health-adjacent, verified by admin before going live. They are shown via the `/ads/live` endpoint, which falls back to `default_banners` when no paid ads are live.

**Rules for events and ads:**
- Events are informational — they require no user commitment to view
- Ads must not feel like ads — they are health service announcements
- Never show ads inside the blood request flow or donation commitment flow
- Never personalize ads using health data
- Ad impressions and clicks go to `ad_analytics` — do not roll your own analytics

---

## Emergency Request Handling

Emergency tier requests (`type: "emergency"`) have specific behavior differences:

- No radius cap — broadcast to all available donors in the city
- ₹499 priority deposit is held (not charged) at request creation
- Response window is 2–4 hours — the UI must reflect urgency without panic
- Emergency requests must surface at the top of the donor's request list, visually distinct

In the UI, emergency requests use `text-primary` and `border-primary` (the LifeLine red brand color). Never use generic red — use the design token.

If no donor commits within 2 hours, the admin wave escalation system takes over. The app's job is to show the request status accurately, not to manage escalation.

---

## Mobile-First Design Philosophy

Most users are on Android, 3G/4G, in Tier 2–3 Indian cities.

### Non-negotiables
- Touch targets minimum 44×44px — no hover-only interactions
- No layout that requires horizontal scrolling
- Forms must work with autocomplete on Android Chrome
- Blood group selection must be tap-based (large tiles), never a dropdown
- Amount/number inputs must use `inputMode="numeric"` on mobile

### Performance
- Keep bundle size below 500KB initial load
- No heavy libraries for things shadcn/Radix already handles
- Skeleton loaders on all data-fetching pages — never show an empty page
- Images lazy-loaded with explicit dimensions to prevent layout shift
- Framer Motion is already in the bundle — use it for transitions, don't add another animation library

### Offline awareness
The localStorage-first architecture (health store, commitments, profile) means core features work without connectivity. Do not break this by moving local-first data to server-only. When adding Supabase sync, sync is additive — local data is still the source of truth for the donor's own device.

---

## Care Circle Philosophy

`care-circle.tsx` implements a trusted personal network for healthcare decisions.

`CareCircleRole` values: `spouse | parent | child | sibling | caregiver | guardian | friend | other`

Care circle members have granular permissions:
- `is_emergency_contact` — shown to providers in emergencies
- `can_view_records` — can see the user's health timeline
- `can_manage_appointments` — can book/cancel on behalf of the user

This is a healthcare network, not a social network. There is no feed, no social discovery, no sharing to friends. It is strictly for coordinated care of one person.

Care circle is stored in localStorage (`lifeline_care_circle`). It is not yet synced to Supabase — do not build that sync until it is explicitly requested.

---

## Continuity-First UX Principles

The app should feel like it remembers the user, even between sessions.

- Profile loads from localStorage immediately, before Supabase resolves — no blank state flash
- Commitments persist across sessions — a donor who committed yesterday sees it on re-open
- Health timeline is always there — no "sign in to see your history" if the data is local
- Follow-ups persist as `pending_approval` until explicitly acted on — never silently expire them locally
- `is_placeholder: true` timeline entries hold space until real data arrives — remove them on sync, don't let placeholders accumulate

The worst UX failure is a user who sees an empty screen where their health history was. Guard against data loss, localStorage parse failures (always try/catch), and silent sync failures.

---

## Trust and Transparency Expectations

This app handles health data and coordinates medical emergencies. Trust is the product.

### What the app never does
- Never sells, rents, or shares health data
- Never shows one user's data to another user
- Never uses health data to personalize ads
- Never stores credit card numbers (Razorpay handles payment)
- Never communicates uncertainty as certainty (eligibility, wait times, match guarantees)

### What the app always does
- Shows the platform fee clearly before payment — no hidden charges
- Shows the `waived` status on NGO/CSR requests accurately
- Makes donation count and eligibility calculation transparent — the user can see the math
- Uses real wait-time estimates from request tier definitions, not optimistic marketing copy

### Consent for health data
`ProviderConsent` (in `types/health.ts`) is the foundation for granting providers access to the user's timeline. It is marked: "Foundation for future consent management — do not overbuild yet." Do not build the full consent UI until Phase 2. The type exists to anchor the schema.

---

## Phased Architecture — Do Not Jump Ahead

`types/health.ts` documents the roadmap explicitly. Respect it.

| Phase | What It Includes |
|-------|----------------|
| Phase 1 (now) | LifelineID, basic profile, health timeline (local), care circle, linked providers, follow-ups |
| Phase 2 | ABHA linking, insurance claims, provider consent management |
| Phase 3 | Provider-issued prescriptions, care programs (multi-session) |
| Phase 4 | Wearable data (HealthKit, Google Fit, manual entry) |

The stub types (`AbhaLink`, `InsuranceClaim`, `Prescription`, `CareProgram`, `WearableSnapshot`) exist to anchor the schema contracts for when their phases arrive. Do not implement them early. Do not delete them as "unused."

---

## Calm UX Principles

The app is opened during stressful moments. Design for calm.

- **One action per screen.** The blood request flow does one thing per step.
- **No decision fatigue.** Tier selection uses clear labels, times, and fees — not abstract options.
- **No urgency theater.** Emergency tier is urgent because the situation is — the UI does not manufacture urgency for non-emergency cases.
- **Errors must resolve, not alarm.** "Something went wrong, try again" is not an error message. Explain what failed and what the user can do.
- **Loading is acknowledged.** Never show a blank screen. Skeleton loaders on all async data.
- **Celebration is proportional.** Confirmed donation gets a celebration. Following up on an appointment gets a toast. Completing onboarding gets a welcome. Scale the response to the action.
- **Dark mode is supported** — all color usage must work in both modes. Never hardcode `text-gray-600` without a dark variant.

---

## Lightweight Modular Architecture Philosophy

### Folder roles
- `src/pages/` — route-level components, kept thin. No business logic.
- `src/hooks/` — all reusable stateful logic. One concern per hook. Prefix with `use`.
- `src/lib/` — pure functions and stateful singletons (supabase client, health-store, commitments). No React in lib files.
- `src/context/` — React context providers for truly global state (profile, auth).
- `src/components/ui/` — shadcn/Radix primitives. Never modified directly. Add new components alongside them.
- `src/types/` — TypeScript-only. No runtime code.

### Local state rules
- `health-store.ts` is the localStorage gateway for health data. All reads and writes go through it — never `localStorage.getItem("lifeline_health_timeline")` directly in a component.
- `commitments.ts` is the localStorage gateway for donor commitments. Same rule.
- Profile context is the gateway for user profile. Never read `localStorage.getItem("lifeline_profile")` outside of it.

### What reuse means here
Before writing a new component:
1. Check `src/components/ui/` — shadcn/Radix covers most UI primitives
2. Check if the page pattern exists (skeleton → data → empty state) and copy it
3. Check if the localStorage access pattern exists in `health-store.ts` and add to it, don't parallel it

### Supabase call rules
All Supabase calls go through the `supabase` client from `src/lib/supabase.ts`. TanStack Query manages server state. Never call Supabase directly in a component body — always in a `useQuery` / `useMutation` hook.

---

## Things Intentionally Not Built Here

| Pattern | Why |
|---------|-----|
| Social feed / activity of other donors | Not a social network |
| Leaderboards | Dignity over competition |
| Daily push notifications / engagement nudges | Respect for the user's time and attention |
| In-app video consultation | Consultation links go to external provider |
| Health data selling or analytics targeting | Non-negotiable — trust is the product |
| Blood group verification at signup | Users may genuinely not know — never block on this |
| Gamified streaks that create anxiety | Badges recognize real acts, they don't pressure future ones |
| ABHA integration (Phase 1) | Phase 2 — stub type exists, implementation deferred |
| Insurance claim handling (Phase 1) | Phase 2 — same |

---

## Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=
VITE_MSG91_TEMPLATE_ID=
VITE_RAZORPAY_KEY_ID=
```

---

Last updated: 2026-05-23
Part of the LifeLine ecosystem — see `/Desktop/lifeline/CLAUDE.md` for ecosystem-wide rules.
Companion: `/Desktop/lifeline-pro/CLAUDE.md` for the provider operational model.
