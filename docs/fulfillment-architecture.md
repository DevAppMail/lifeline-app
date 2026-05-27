# Blood Fulfillment System — Foundation Architecture v1

> *An intelligent emergency healthcare fulfillment orchestration system.*
> 
> *Not a social app. Not a broadcast tool. A coordination layer between people in need and people who can help.*

---

## Table of Contents

1. [Request Intake Engine](#s1--request-intake-engine)
2. [Fulfillment Confidence Engine (FCE)](#s2--fulfillment-confidence-engine-fce)
3. [Temporal Availability Engine (TAE)](#s3--temporal-availability-engine-tae)
4. [Donor Operational State Model](#s4--donor-operational-state-model)
5. [Escalation Wave Engine](#s5--escalation-wave-engine)
6. [Adaptive Radius Expansion Logic](#s6--adaptive-radius-expansion-logic)
7. [Emergency Notification System](#s7--emergency-notification-system)
8. [Donor Fatigue Prevention System](#s8--donor-fatigue-prevention-system)
9. [Trust & Fraud Prevention Layer](#s9--trust--fraud-prevention-layer)
10. [Blood Bank / Hospital Fallback Layer](#s10--blood-bank--hospital-fallback-layer)
11. [Emergency UX Flow](#s11--emergency-ux-flow)
12. [Request Lifecycle State Machine](#s12--request-lifecycle-state-machine)
13. [Donor Response Lifecycle](#s13--donor-response-lifecycle)
14. [Multi-Donor Coordination Logic](#s14--multi-donor-coordination-logic)
15. [Rare Blood Escalation Logic](#s15--rare-blood-escalation-logic)
16. [Failure-State Recovery Logic](#s16--failure-state-recovery-logic)
17. [Entity & Data Model Recommendations](#s17--entity--data-model-recommendations)
18. [AI Integration Points (Future)](#s18--ai-integration-points-future)
19. [MVP vs. Future-Phase Separation](#s19--mvp-vs-future-phase-separation)
20. [Critical Risks](#s20--critical-risks)
21. [Recommended Implementation Order](#s21--recommended-implementation-order)

---

## S1 — Request Intake Engine

### Core Philosophy

The person filling out this form is likely in emotional distress. A family member may be in surgery, an accident victim needs blood, or a child is critically ill. The form must feel like a calm, competent assistant — not another obstacle.

**Design principles:**
- Every field must justify its existence against: "Will this help find blood faster?"
- Defaults and smart inferences eliminate cognitive load
- Urgency level determines how much information is required vs. optional
- Never ask for information the system already knows (profile, location)
- The form adapts in real time to the severity of the situation

### 1.1 Required Fields

These are never optional, regardless of tier:

| Field | Rationale | UX Treatment |
|-------|-----------|-------------|
| Patient name | Legal/identity requirement | Free text, with "self" quick-fill |
| Blood group | Core matching criterion | Large tile grid, tap-optimized, includes "I don't know" |
| Units needed (1-5) | Determines donor count needed | Stepper, defaults to 1. Warning shown at 3+ |
| Hospital name | Where donor must go | Typeahead with common hospitals, free-text fallback |
| Hospital city | Geographic anchor for donor search | Auto-detect from profile or GPS. Editable. |
| Requester phone | Contact for coordination | Auto-filled from profile. Read-only confirmation. |
| Tier selection | Fee, timeframe, escalation path | 3 clear cards with ₹, time, and use case |

### 1.2 Optional Fields (Shown Based on Tier)

| Field | Scheduled | Urgent | Emergency |
|-------|-----------|--------|-----------|
| Required date | **Required** | **Required** | Auto: today |
| Required time | Optional | **Strongly recommended** | Auto: ASAP |
| Doctor's note / prescription | **Required** | **Required** | Optional (can submit after) |
| Patient relationship | Recommended | Recommended | Recommended |
| Patient age | Optional | Optional | **Required** (pediatric handling) |
| Selfie/identity verification | **Required** | **Required** | Optional |
| Additional notes | Optional | Optional | Optional |

### 1.3 Emergency Severity Levels

The existing 3-tier system (Scheduled / Urgent / Emergency) is correct. However, the intake engine should do **dynamic tier recommendation** based on user input:

```
Time needed < 24h          → Recommend Emergency
Time needed 24-72h         → Recommend Urgent
Time needed > 72h          → Recommend Scheduled
Patient is child           → Flag for priority
Rare blood type            → Flag for early escalation
Known hospital stockout    → Flag for fastest tier
```

The user can override, but the system should guide. Users under stress may not know which tier to choose.

### 1.4 Time-Needed Logic

```
required_date + required_time → computed deadline (ISO timestamp)

For emergency:
  deadline = now + 4h (hard limit for emergency tier)
  system treats "ASAP" as now + 2h for escalation purposes
  deadline is internal — user sees "within 2-4 hours"

For urgent:
  deadline = user-specified date/time
  if no time specified, default to 6PM on specified date

For scheduled:
  deadline = user-specified date (end of day)
```

**Internal fields (not shown to user):**
- `fulfillment_deadline`: The absolute latest time blood must be available
- `escalation_trigger_at`: When wave escalation begins (deadline minus buffer)
- `hospital_prep_time`: 30 min buffer for hospital to prepare

### 1.5 Hospital / Location Handling

**Three-tier hospital input:**

1. **Typeahead search** — Query against known hospital database (Supabase `hospitals` table). Shows name + city + known blood bank availability (if available).
2. **Free-text** — If hospital not in database, accept free text + city. Mark as `unverified_hospital`.
3. **GPS pin** — Allow user to drop a pin if location is ambiguous (emergency scene, not a hospital).

**Hospital data model (new):**
```typescript
interface Hospital {
  id: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  has_blood_bank: boolean;
  blood_bank_phone?: string;
  verified: boolean;
  created_at: string;
}
```

### 1.6 Doctor Note Verification

**Current state:** Document upload + emergency skip.

**Designed state — tiered verification:**

| Level | Method | When Required |
|-------|--------|--------------|
| L1 — Self-declared | User states diagnosis/need | All tiers |
| L2 — Document upload | Photo of prescription/hospital letter | Scheduled, Urgent |
| L3 — Verified document | Upload + optional manual admin review | Auto-escalated suspicious requests |
| L4 — Hospital cross-check | Admin calls hospital to verify | Emergency, rare blood, flagged requests |

**Implementation:**
- L1 + L2 are always collected (emergency can skip during intake but must complete within 2h)
- L3 triggered by fraud scoring (see [S9 — Fraud Prevention](#s9--trust--fraud-prevention-layer))
- L4 is manual admin workflow (Supabase dashboard), only for high-severity or suspicious cases
- Document images stored in Supabase Storage under `blood_requests/{request_id}/`
- OCR extraction for hospital name, doctor name, date (future AI enhancement)

### 1.7 Duplicate-Request Prevention

**Prevention mechanisms:**

1. **Phone + blood group + hospital + date dedup**: If the same requester phone creates a request for the same blood group at the same hospital within 7 days, warn and block.
2. **Same-family detection**: If phone numbers in care circle match another active request's requester, flag as potential duplicate.
3. **Active request check**: A requester can only have 1 active emergency request at a time. Urgent/scheduled limit: 2 concurrent.
4. **Duplicate score**: On submission, system checks open requests in the same city for same blood group and flags if identical patient name + hospital match found.

### 1.8 Family-Member Handling

**Role selection** helps the system understand context:

```typescript
type PatientRelationship = "self" | "spouse" | "child" | "parent" | "sibling" | "friend" | "colleague" | "stranger" | "other";
```

**Behavioral differences by relationship:**
- `self`: Requester is also patient. No additional coordination needed.
- `child`: Pediatric alert. Age field required. System may handle differently (child needs often feel more urgent).
- `spouse / parent / sibling`: Can pull from care circle for coordination.
- `friend / colleague / stranger`: Higher fraud scrutiny. May require document upload regardless of tier.

### 1.9 Pediatric / Emergency Special Handling

When `patient_relationship = "child"` or `patient_age < 18`:

- **Auto-prioritize** within tier (pediatric requests sort above adult in donor matching)
- **Age field required** — system needs to know if neonate (needs special blood products), infant, child, or adolescent
- **Hospital must have pediatric ward** — filter hospitals without pediatric capability (future)
- **Special messaging** — donor communication includes "child patient" context so donors understand the sensitivity
- **Quantity limits** — pediatric units needed max 2 (neonates often need smaller volumes)
- **Emergency pediatric override** — if child and emergency, wave escalation starts at Wave 2 instead of Wave 1

### 1.10 Rare Blood Logic

**Rare blood types** (defined as prevalence < 5% in Indian population):
- B- (~2%), AB+ (~2%), AB- (~1%), A- (~1%), O- (~1%)

**Automatic handling:**
1. When rare blood is selected, system displays: "This is a rare blood type. We will expand search radius automatically."
2. `rare_blood_flag = true` on the request
3. Adaptive radius starts at 25km instead of 5km
4. Escalation waves trigger 2x faster
5. Blood bank fallback checked immediately (not after waves fail)
6. Donors with rare blood types get priority placement in matching (their scarcity makes them more valuable for matching rare requests)
7. System maintains a `rare_blood_donor_pool` — pre-qualified donors with rare blood types who have opted into emergency-only rapid response

---

## S2 — Fulfillment Confidence Engine (FCE)

### Core Concept

The FCE produces a **Fulfillment Confidence Score (FCS)** — a 0.0–1.0 probability estimate that a given request will be fulfilled before its deadline.

This score drives:
- Whether to show "Low viability" warnings to the requester
- When to trigger escalation waves
- When to activate blood bank fallback
- Whether to suggest tier upgrades
- Whether to pre-warn about refund eligibility

### 2.1 Scoring Model

```
FCS = w1·donorDensity + w2·donorAvailability + w3·timeFeasibility 
      + w4·radiusCoverage + w5·responseProbability + w6·rareBloodPenalty
      + w7·historicalFillRate + w8·seasonalAdjustment
```

| Factor | Weight | Description |
|--------|--------|------------|
| `donorDensity` | 0.25 | Number of eligible donors per km² within radius |
| `donorAvailability` | 0.20 | % of matched donors currently available (not in cooldown, toggle on) |
| `timeFeasibility` | 0.15 | Time remaining vs. estimated time-to-fulfill (decays as deadline approaches) |
| `radiusCoverage` | 0.10 | Current search radius / estimated minimum needed radius |
| `responseProbability` | 0.10 | Historical response rate of matched donors (weighted by recency) |
| `rareBloodPenalty` | 0.05 | Multiplier: 1.0 for common, 0.6 for rare, 0.3 for very rare (AB-) |
| `historicalFillRate` | 0.10 | % of similar requests (same city, tier, blood group) that were fulfilled |
| `seasonalAdjustment` | 0.05 | Known seasonal shortages (festival season, monsoon, exam season) |

**Total must sum to 1.0.**

### 2.2 Scoring Tiers

| Score Range | Label | UX Behavior |
|-------------|-------|-------------|
| 0.80–1.00 | **High confidence** | Standard operation. No warnings. |
| 0.60–0.79 | **Moderate confidence** | Requester sees subtle note: "We are actively searching for donors" |
| 0.40–0.59 | **Low confidence** | Warning banner: "Due to low donor availability in your area, fulfillment may take longer. We recommend: [suggestions]" |
| 0.20–0.39 | **Very low confidence** | Strong warning + blood bank fallback pre-activated + admin notified + requester offered refund option |
| 0.00–0.19 | **Critical** | Request may be non-viable. Admin intervention required. Full refund if paid. |

### 2.3 Score Recalculation Triggers

FCS is not static — it recalculates on these events:

- New donor within radius becomes available (score increases)
- A donor commits (score increases significantly)
- A donor un-commits or ghosts (score decreases)
- Time passes (score decays as deadline approaches)
- Radius expands (score may increase if new donors found)
- Escalation wave fires (score may increase)
- Blood bank fallback activates (score resets to fallback probability)

### 2.4 "Low Viability" UX

When FCS < 0.40:

1. **Requester sees:** Calm, non-alarming message: "We're working hard to find donors. Here's what's happening: [reason]. You may want to also check with [local blood bank name]."
2. **Donors never see this** — don't reduce donor motivation by showing doubt
3. **Admin sees:** Dashboard alert with FCS breakdown
4. **System action:** 
   - Pre-activates blood bank fallback
   - Expands radius one level regardless of wave timing
   - Pings high-reliability donors outside normal radius with special request
   - Sends SMS to requester with blood bank contact info as backup

### 2.5 Radius Legic

The engine doesn't just check raw donor count — it models **effective coverage**:

- Urban: 5km radius may contain 50+ donors → high density score
- Semi-urban: 5km may contain 5-10 donors → moderate
- Rural: 5km may contain 0-2 donors → low density, triggers auto-expansion

**Travel feasibility model:**
```
estimated_travel_time = distance / avg_speed(city, time_of_day)
travel_feasible = estimated_travel_time < (deadline - now - hospital_prep_time)
```

At night (10PM–6AM), average speed is higher (less traffic) but donor willingness is lower — adjust expectations accordingly.

### 2.6 Failure Thresholds & Refund Behavior

| Condition | Refund | Pre-Warning |
|-----------|--------|-------------|
| No donor found before deadline | Full refund | Yes, at T-2h |
| Donor found but didn't show | Full refund | Yes, at T-1h |
| Partial fulfillment (< units needed) | Pro-rated refund | Yes, at submission |
| Request cancelled by requester before any donor commits | Full refund | N/A |
| Request cancelled after donor committed | Partial (₹50 processing fee) | Yes |
| Fake request detected | No refund + account flag | No |
| Blood bank sourced successfully (external) | Full refund | N/A |

### 2.7 Blood Bank Fallback Triggers

| Trigger Condition | Action |
|-------------------|--------|
| FCS < 0.30 at T-4h | Auto query blood bank database |
| FCS < 0.20 at T-2h | Priority blood bank escalation (phone call by admin) |
| No donors found after Wave 3 | Immediate blood bank escalation |
| Rare blood + FCS < 0.50 | Blood bank query at submission time |
| Hospital has own blood bank | Connect requester to hospital blood bank directly |

---

## S3 — Temporal Availability Engine (TAE)

### Core Concept

Donors are real people with jobs, families, and lives. The TAE models **when a donor can actually donate** — not just whether they're available at all.

### 3.1 Availability Schema

```typescript
interface DonorAvailability {
  // General availability pattern
  always_available: boolean;
  
  // Weekly schedule
  weekly_schedule: {
    monday: TimeRange[];
    tuesday: TimeRange[];
    wednesday: TimeRange[];
    thursday: TimeRange[];
    friday: TimeRange[];
    saturday: TimeRange[];
    sunday: TimeRange[];
  };
  
  // Emergency override
  emergency_only: boolean;
  
  // Temporary unavailability
  temporarily_unavailable: boolean;
  unavailable_until?: string; // ISO date
  unavailable_reason?: string; // "travel", "sick", "personal"
  
  // Travel preferences
  max_travel_radius_km: number; // default 10, max 50
  preferred_travel_mode?: "public_transit" | "private_vehicle" | "any";
  
  // Time preferences
  preferred_time_of_day: "morning" | "afternoon" | "evening" | "night" | "flexible";
  
  // Fresh blood commitment
  can_donate_on_demand: boolean; // Can come within 2 hours of notification?
  
  updated_at: string;
}
```

```typescript
interface TimeRange {
  start: string; // "09:00" in 24h format
  end: string;   // "17:00" in 24h format
}
```

### 3.2 Time-Window Matching Algorithm

When a blood request has a required date + time:

```
for each eligible donor in radius:
  donor_local_avail = weekly_schedule[day_of_week]
  
  if donor.always_available:
    mark as "time_compatible"
    continue
    
  if donor.emergency_only AND request.tier != "emergency":
    skip — only notify for emergencies
    
  if donor.temporarily_unavailable AND unavailable_until > request_time:
    skip
    
  if request_time overlaps any TimeRange in donor_local_avail:
    mark as "time_compatible"
  else:
    mark as "time_incompatible" but still eligible for emergency override
```

**Emergency override:** For emergency-tier requests, `time_incompatible` donors are still notified (emergency transcends schedule), but notified **after** compatible donors.

### 3.3 Fresh-Blood Requirement Handling

Some medical situations require fresh blood (< 7 days old), typically for:
- Neonatal transfusions
- Massive transfusion protocols
- Thalassemia patients
- Cardiac surgery

**How the system handles this:**
1. Optional field on request: `fresh_blood_required: boolean`
2. When true, notification includes: "Fresh blood needed — donation needed within next 6 hours"
3. Donors who donated in last 7 days are filtered out (their blood is still being tested/processed, or they may be ineligible)
4. Donors who donated 90+ days ago are ideal (proven safe donor, no recent loss)
5. Priority goes to donors with recent negative test results (if available)

### 3.4 Time-Sensitive Surgery Handling

For scheduled surgeries (C-sections, bypass surgeries, etc.):

1. `required_date` is fixed, `time_window` is flexible (surgery may be morning or afternoon)
2. System matches donors who can donate **24-48 hours before surgery** (fresh blood with processing time)
3. Notification includes surgery context: "Blood needed for planned surgery on [date]"
4. Less urgency in tone — this is planned, not emergent

### 3.5 Availability Confidence Scoring

How sure are we that a donor will actually be available when needed?

```typescript
function calcAvailabilityConfidence(donor: DonorProfile, request: Request): number {
  let confidence = 0.5; // baseline
  
  if (donor.always_available) confidence += 0.3;
  if (donor.donor_score > 80) confidence += 0.1; // high reliability
  if (donor.last_response_time < 10) confidence += 0.1; // responds within 10 min
  
  if (request.tier === "emergency" && donor.emergency_only) confidence += 0.2;
  if (request.required_time && !timeOverlapsSchedule(donor, request)) confidence -= 0.3;
  
  if (donor.response_rate < 0.5) confidence -= 0.2; // responds less than 50%
  
  return Math.max(0, Math.min(1, confidence));
}
```

### 3.6 Notification Suppression for Unavailable Donors

**Hard rules (never notify):**
- `temporarily_unavailable = true` and `unavailable_until > now`
- `availability_toggle = false`
- Donor is in 90-day cooldown
- Donor has `seen_ids` for this request (already saw it, didn't act)

**Soft rules (notify last):**
- `emergency_only = true` and tier is Scheduled or Urgent
- `max_travel_radius_km < distance_to_hospital`
- `preferred_time_of_day` doesn't match request time (unless emergency)

### 3.7 Operational Donor Ranking

When sorting donors for notification order:

```
rank = (availability_confidence × 0.4) 
      + (response_probability × 0.3) 
      + (donor_score_normalized × 0.15) 
      + (distance_proximity_normalized × 0.1)
      + (recency_boost × 0.05)

recency_boost: donors who haven't been notified recently get a small boost (fairness)
```

---

## S4 — Donor Operational State Model

### 4.1 State Definitions

```
┌──────────────────────────────────────────────────────────────┐
│                    DONOR STATE MACHINE                       │
│                                                              │
│  ┌──────────────────┐                                        │
│  │   REGISTERED     │  - Has completed onboarding            │
│  │                  │  - Blood group known or unknown        │
│  └────────┬─────────┘                                        │
│           │                                                   │
│           ▼                                                   │
│  ┌──────────────────┐    ┌──────────────────┐                │
│  │ AVAILABLE_NOW    │◄──►│ AVAILABLE_TODAY  │  - Time-based   │
│  │ - Toggle ON      │    │ - Has time window │    transitions  │
│  │ - Not in cooldown│    │   scheduled today │                │
│  └────────┬─────────┘    └────────┬─────────┘                │
│           │                       │                           │
│           ▼                       ▼                           │
│  ┌──────────────────┐    ┌──────────────────┐                │
│  │ SCHEDULED_AVAIL  │    │ EMERGENCY_ONLY   │  - Only notified│
│  │ - Future window  │    │ - Tier: emergency│    for emergency │
│  │ - Known schedule │    │ - Ignores others │    requests      │
│  └────────┬─────────┘    └────────┬─────────┘                │
│           │                       │                           │
│           ▼                       ▼                           │
│  ┌──────────────────┐    ┌──────────────────┐                │
│  │    COOLDOWN      │    │ TEMP_UNAVAILABLE │  - Self-managed │
│  │ - 90-day lock    │    │ - Manual toggle  │    or auto      │
│  │ - Auto-clears    │    │ - Reason: travel,│                │
│  │   after 90 days  │    │   sick, personal │                │
│  └──────────────────┘    └──────────────────┘                │
│                                                              │
│  ┌──────────────────┐    ┌──────────────────┐                │
│  │    INACTIVE      │    │   UNREACHABLE    │  - Notifications│
│  │ - No login 30d+  │    │ - SMS failing     │    bouncing    │
│  │ - Nudge cycle    │    │ - Phone changed   │                │
│  └──────────────────┘    └──────────────────┘                │
│                                                              │
│  Quality layers (orthogonal to state):                       │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ HIGH_RELIABILITY │  │ LOW_RELIABILITY  │  - Statistical   │
│  │ - Responds ≥80%  │  │ - Ghosts ≥40%    │    layer only    │
│  │ - Shows up ≥90%  │  │ - Never confirms │                  │
│  └──────────────────┘  └──────────────────┘                 │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 State Transitions

| From | To | Trigger |
|------|----|---------|
| REGISTERED | AVAILABLE_NOW | Donor sets toggle ON, no cooldown |
| REGISTERED | TEMP_UNAVAILABLE | Donor sets toggle OFF |
| AVAILABLE_NOW | COOLDOWN | Donation confirmed → 90-day timer starts |
| AVAILABLE_NOW | TEMP_UNAVAILABLE | Donor manually toggles OFF |
| AVAILABLE_TODAY | COOLDOWN | Donation confirmed |
| AVAILABLE_TODAY | AVAILABLE_NOW | Time window passes → still available generally |
| TEMP_UNAVAILABLE | AVAILABLE_NOW | Donor toggles ON / timer expires |
| COOLDOWN | AVAILABLE_NOW | 90 days elapsed + toggle still ON |
| AVAILABLE_NOW | INACTIVE | No login for 30 days |
| INACTIVE | AVAILABLE_NOW | User logs in |
| AVAILABLE_NOW | UNREACHABLE | SMS delivery fails 3+ times |
| UNREACHABLE | AVAILABLE_NOW | SMS delivery succeeds |

### 4.3 Cooldown Logic

**Current rule:** 90 days (whole blood, Indian standards).

**Edge cases:**
- Platelet / plasma donors: 14-day cooldown (different blood component — future phase)
- Donor who attempted but didn't actually donate: No cooldown (system must handle `missed` vs `completed` distinction)
- `calcEligibility(lastDonationDate)` remains the single source of truth

**Implementation:**
- `lastDonationDate` is set on confirmed donation completion
- System checks: `Date.now() - lastDonationDate >= 90 * 24 * 60 * 60 * 1000`
- Cooldown is a hard block — no override. Even emergency override cannot bypass cooldown.
- Donor sees countdown on their dashboard

### 4.4 Reliability Scoring

```typescript
interface DonorReliabilityScore {
  overall: number; // 0-100
  
  // Component scores
  response_rate: number; // % of notifications responded to in last 10
  show_rate: number;     // % of commitments where donor showed up
  on_time_rate: number;  // % of donations completed within window
  commitment_rate: number; // % of accepted requests that ended in commitment
  
  // Decay factors
  last_response_date?: string;
  consecutive_ghosts: number;
  total_commitments: number;
  
  // Computed
  tier: "high" | "moderate" | "low" | "unproven";
}
```

**Tier computation:**
| Score | Tier | Behavior |
|-------|------|----------|
| 80-100 | High | Notified in Wave 1. Featured in matches. |
| 50-79 | Moderate | Standard notification. Wave 2. |
| 1-49 | Low | Only notified when donor shortage. Wave 3. |
| 0 (no data) | Unproven | New donor. Gets chance but not priority. |

### 4.5 Responsiveness Scoring

Measured as: **Time from notification to response action.**

```
responsiveness = weighted average of last 5 response times:
  < 2 min  → 100
  2-10 min → 80
  10-30 min → 60
  30-60 min → 40
  1-4h → 20
  > 4h or no response → 0
```

Faster responders get notified earlier (they're more reliable channels for time-sensitive needs).

### 4.6 Ghosting / No-Response Handling

**Ghosting = donor commits but doesn't show up, and doesn't communicate.**

| Consecutive Ghosts | Actions |
|-------------------|---------|
| 1 | Warning notification. Score penalty. |
| 2 | 7-day cool period (cannot accept new requests). Score penalty doubled. |
| 3 | 30-day cool period. Admin notification. |
| 4+ | Account flagged. Manual review required for reactivation. |

**No-response (never committed) ≠ ghosting.** A donor who simply doesn't respond is not penalized — they may have been busy. Only committed-then-no-show is penalized.

### 4.7 Fatigue Detection

Donor fatigue = being notified too often and becoming desensitized.

```
fatigue_score = number_of_notifications_last_7_days / notification_frequency_tolerance

if fatigue_score > 0.8:
  reduce notification frequency for this donor
  skip them in next 2 matching rounds
```

**Notification frequency caps:**
| Tier | Max notifications per week |
|------|--------------------------|
| High reliability | 5 |
| Moderate | 3 |
| Low | 2 |
| Emergency-only | Only emergency, no cap |

Donors who want more can increase their cap in settings.

### 4.8 Trusted Donor Tiering

**Trusted donor** = verified identity + 3+ successful donations + high reliability score.

Benefits:
- Notified in Wave 1 always (highest priority)
- Featured status shown on request detail page ("Verified donor")
- Can donate at any hospital (no additional verification needed)
- Skipped in 60-day soft cooldown checks (if clinically safe, platform trusts them)

---

## S5 — Escalation Wave Engine

### Core Concept

Not everyone should be notified at once. Staged escalation preserves donor attention, prevents notification fatigue, and gives the system time to fulfill before panic-broadcasting.

### 5.1 Wave Structure

```
┌───────────────────────────────────────────────────────────┐
│                    ESCALATION WAVES                       │
│                                                           │
│  Wave 1 (T+0)             ┌─────────────────────┐        │
│  ▶ Notify:                │ High reliability    │        │
│    - Closest radius       │ Available now       │        │
│    - High reliability     │ Blood group match   │        │
│    - Currently available  │                     │        │
│    - Time compatible      │ Wait: 15 min        │        │
│                           └──────────┬──────────┘        │
│                                      │                    │
│  Wave 2 (T+15min)         ┌──────────▼──────────┐        │
│  ▶ Notify:                │ Moderate reliability │        │
│    - Radius +5km          │ Expanded radius      │        │
│    - Moderate reliability │ Time compatible      │        │
│    - Still time compatible│                     │        │
│                           │ Wait: 20 min         │        │
│                           └──────────┬──────────┘        │
│                                      │                    │
│  Wave 3 (T+35min)         ┌──────────▼──────────┐        │
│  ▶ Notify:                │ All eligible donors │        │
│    - All eligible donors  │ Wider radius        │        │
│    - Wider radius         │ Even if time-       │        │
│    - Time-incompatible    │ incompatible        │        │
│      OK now               │                     │        │
│                           │ Wait: 30 min         │        │
│                           └──────────┬──────────┘        │
│                                      │                    │
│  Wave 4 (T+65min)         ┌──────────▼──────────┐        │
│  ▶ Activate:              │ NGO / Blood bank    │        │
│    - NGO escalation       │ Admin intervention  │        │
│    - Blood bank fallback  │ Escalation complete │        │
│    - Admin intervention   │                     │        │
│    - SMS broadcast        │                     │        │
│                           └─────────────────────┘        │
└───────────────────────────────────────────────────────────┘
```

### 5.2 Timing by Tier

| Tier | Wave 1 | Wave 2 | Wave 3 | Wave 4 |
|------|--------|--------|--------|--------|
| **Emergency** | T+0 | T+15min | T+35min | T+65min |
| **Urgent** | T+0 | T+2h | T+6h | T+12h |
| **Scheduled** | T+0 | T+12h | T+24h | T+48h |

**Emergency gets compressed timeline** — 4 waves complete within ~65 minutes.

### 5.3 Priority Ordering Within Waves

Within each wave, donors are notified in this order:

```
1. Time-compatible AND blood-group exact match
2. Time-compatible AND blood-group universal (O-) 
3. Time-incompatible AND blood-group exact match (for emergency only)
4. Time-incompatible AND blood-group universal
5. Higher availability confidence → first
6. Higher reliability score → first
```

### 5.4 Escalation Stopping Conditions

A wave-in-progress can be **halted** if:

- Fulfillment target met (units_needed == committed_units)
- FCS crosses 0.80 threshold
- Requester cancels the request
- Admin manually pauses
- Donor has already been found (don't keep notifying)

**Implementation:** Each wave checks: `active_notifications_count + committed_units >= units_needed` before proceeding.

### 5.5 Fulfillment Success Detection

**How the system knows a request is fulfilled:**

1. **Donor commits** → `committed_units += 1`, but not fulfillment (donor may ghost)
2. **Donor arrives at hospital** → Donor check-in (future: GPS geofence around hospital)
3. **Donor donates** → Donation confirmation from donor → `awaiting_confirmation`
4. **Requester confirms** → `confirmed` → fulfillment complete ✅
5. **Hospital confirmation** (future) → source of truth

**System considers request "fulfilled"** at step 4 (requester confirmation). Escalation stops at step 1 (donor commits) to avoid over-committing.

### 5.6 Duplicate Suppression

**A donor should never receive the same request notification twice.**

- Each donor has a `notified_request_ids: Set<number>` (localStorage + DB)
- Before any notification: `if notified_request_ids.has(requestId) → skip`
- Cross-wave: A donor skipped in Wave 1 (not yet available) is notified in Wave 2 if they become available — but only once
- Cross-request: A donor can be notified about multiple requests (different patients)

### 5.7 Notification Fatigue Prevention

Per-donor rate limiting:

```
notifications_this_hour < max_acceptable
notifications_this_day < donor.daily_cap
```

If a donor has been notified 3 times in the last hour without responding, skip them for the next wave to prevent annoyance.

---

## S6 — Adaptive Radius Expansion Logic

### Core Concept

Blood searches must be geographically intelligent. A 25km search in Mumbai is very different from 25km in rural Bihar. Radius expansion must consider urban density, travel infrastructure, and time remaining.

### 6.1 Expansion Levels

| Level | Radius | When | Notes |
|-------|--------|------|-------|
| 0 | Default | T+0 | 5km for urban, 10km for semi-urban, 25km for rural (auto-detected) |
| 1 | +5km | Wave 2 start | Linear expansion |
| 2 | +10km | Wave 3 start | |
| 3 | +25km | Wave 4 start | |
| 4 | City-wide | Blood bank escalation | No radius cap |
| 5 | Regional | Rare blood / admin override | Multi-city search |

### 6.2 Urban vs. Rural Logic

**City classification** (based on census or population data):

```typescript
type AreaType = "metro" | "urban" | "semi_urban" | "rural" | "remote";

// Default starting radii:
// metro: 5km
// urban: 8km
// semi_urban: 15km
// rural: 25km
// remote: 50km (immediate wider search)
```

**Population density estimation:**
- Use city population / city area (km²)
- Low density (< 1000/km²) → start with wider radius
- High density (> 10,000/km²) → start with tighter radius, denser donor pool

### 6.3 Travel Feasibility Buffer

```
travel_feasibility = f(distance, time_of_day, city)

time_of_day_multiplier:
  daytime (7AM-9PM): 1.0 (normal traffic)
  night (9PM-11PM): 0.7 (less traffic, but fewer willing donors)
  late night (11PM-6AM): 0.5 (very few willing donors, but faster travel)

city_traffic_factor:
  metro: 0.6 (heavy traffic)
  urban: 0.8
  semi_urban: 1.0
  rural: 1.2 (open roads)

effective_speed_kmh = 30 * time_of_day_multiplier * city_traffic_factor
travel_time_min = (distance / effective_speed_kmh) * 60
```

### 6.4 Nighttime Handling (10PM - 6AM)

Special rules for nighttime requests:

1. **Notifications include**: "This is an emergency night request. Please respond only if you can travel right now."
2. **Radius starts wider** (fewer donors awake, need larger pool)
3. **Travel feasibility assumes** private vehicle (no public transit)
4. **Donor must confirm they can travel** (separate "I can get there" button)
5. **Higher Wave 1 threshold** — need 2 committed donors minimum before stopping Wave 1
6. **Hospital verification** — ensure hospital blood collection unit is staffed at night

### 6.5 Emergency Severity Weighting

Emergency tier requests expand faster:

```
emergency radius = default_radius × 2 (immediate wider start)
emergency wave_gap = wave_gap × 0.5 (faster expansion)
```

### 6.6 Rare Blood Overrides

When `rare_blood_flag = true`:

```
starting_radius = max(default_radius, 25km)
expansion_multiplier = 2.0 (each wave doubles radius instead of adding 5km)
city_wide_at_wave = 2 (instead of Wave 4)
```

---

## S7 — Emergency Notification System

### Core Philosophy

Notifications in an emergency system are not marketing messages. They carry the weight of someone's life being in the balance. Every notification must be crafted to convey the right information without causing panic or being ignored.

### 7.1 Notification Content

**SMS template (MSG91):**
```
LIFELINE: Urgent blood needed for [patient] ([blood group]) at [hospital], [city].
Can you help? Reply YES to commit or view details: [shortlink]
- LifeLine (a voluntary blood donation platform)
```

**In-app notification (future):**
```
🩸 Blood needed nearby
[patient name] needs [blood group]
[Hospital name], [city] · [distance] away
[Accept] [View Details]
```

### 7.2 Notification Priority

| Priority | Used For | Delivery |
|----------|----------|----------|
| P0 - Critical | Emergency tier, Wave 1 | SMS + in-app (delivered immediately) |
| P1 - High | Emergency tier, Wave 2-3 | SMS + in-app |
| P2 - Normal | Urgent tier | SMS (within 5 min window) |
| P3 - Low | Scheduled tier | SMS (within 1 hour, batched) |

### 7.3 Notification Timing Constraints

- **Quiet hours (10PM - 7AM):** Only P0 notifications for emergency tier. All others queued until 7AM.
- **Donor can set quiet hours** in preferences (e.g., "Don't notify me during work meetings").
- **Rate limit:** A donor should not receive more than 1 notification per 15 minutes during quiet hours.

### 7.4 Response Tracking

Every notification includes a **tracking identifier** so the system knows which notification prompted which response:

```typescript
interface NotificationRecord {
  id: string;
  request_id: string;
  donor_id: string;
  wave_number: number;
  sent_at: string;
  delivered_at?: string;
  response?: "accepted" | "declined" | "ignored" | "unreachable";
  response_at?: string;
  channel: "sms" | "in_app" | "email" | "whatsapp";
  failure_reason?: string;
}
```

### 7.5 Delivery Failure Handling

| Failure Mode | Detection | Action |
|-------------|-----------|--------|
| SMS not delivered | Delivery receipt | Retry once after 5 min. If still fails, mark donor unreachable. |
| Phone switched off | Delivery receipt → unreachable | Mark UNREACHABLE. Remove from active notification pool. |
| Number changed | SMS fails + no alternative | Mark UNREACHABLE. Nudge donor to update number on next login. |
| Do not disturb | SMS queued but not delivered | Retry after DND window. |

### 7.6 Fallback Communication Channels

Primary: SMS (MSG91)
Secondary: In-app notification
Tertiary (future): WhatsApp (Twilio/Gupshup)
Quaternary: Phone call (admin only, for confirmed commitments)

---

## S8 — Donor Fatigue Prevention System

### Core Philosophy

Donor fatigue is the single greatest threat to fulfillment system sustainability. A donor who feels overwhelmed, over-notified, or unappreciated will disengage. The system must protect donor attention as a scarce resource.

### 8.1 Notification Budget

Each donor has a **notification budget** per time period:

| Time Window | Max Notifications | Notes |
|-------------|------------------|-------|
| Per hour | 2 | Hard cap |
| Per day | 5 | Configurable in settings |
| Per week | 10 | Resets Monday |
| Per request | 1 | Never notify about same request twice |

### 8.2 Burnout Detection

```typescript
function calcBurnoutRisk(donor): "low" | "medium" | "high" {
  const notificationsLast7 = countRecentNotifications(donor.id, 7);
  const responsesLast7 = countRecentResponses(donor.id, 7);
  const responseRate = responsesLast7 / notificationsLast7;
  
  // Factors
  const highVolume = notificationsLast7 > 7;
  const lowEngagement = responseRate < 0.3;
  const consecutiveSkips = donor.consecutive_notification_skips;
  const recentGhost = donor.consecutive_ghosts > 0;
  
  if (highVolume && lowEngagement) return "high";
  if (consecutiveSkips >= 3) return "high";
  if (highVolume || recentGhost) return "medium";
  return "low";
}
```

| Burnout Risk | Action |
|-------------|--------|
| Low | Normal operations |
| Medium | Reduce notification priority. Skip 1 of 3 matching rounds. |
| High | Pause notifications for 48h. Send "We're giving you a break" message. Offer settings review. |

### 8.3 Positive Reinforcement (Non-Gamified)

**NOT gamification. Not points. Not badges for engagement.**

The system acknowledges real, meaningful contributions:

1. **Post-donation "thank you"** — Personalized message from the system (not automated-looking). Includes: "You helped [patient] at [hospital]. Thank you."
2. **Impact summary** — Weekly/monthly digest: "You helped 3 people this month. Here's what happened: [patient 1] recovered, [patient 2]..."
3. **Community messages** — (With requester consent) A thank-you message from the recipient family.
4. **Low-pressure check-in** — "We haven't seen you in a while. No pressure — just letting you know you're still on our emergency donor list."

### 8.4 Cool-Down Period Messaging

A donor in cooldown sees:
```
You donated on [date]. Thank you!
You're eligible to donate again on [date + 90 days].
Your donor badge is safe. See you when you're ready.
```

No countdown anxiety. No "X days remaining" pressure. Just a calm, appreciative holding pattern.

### 8.5 Emotional Protection

Donors should not be exposed to distressing details unnecessarily.

- Notification says: "Blood needed for [patient name or 'a patient']" — not graphic medical details
- Request detail page shows: patient first name only, blood group, hospital — no gory details
- No photos of injured patients
- No "urgent" language for non-emergency requests
- Donors can opt out of pediatric requests (if they find them emotionally difficult)

---

## S9 — Trust & Fraud Prevention Layer

### Core Philosophy

A blood donation platform is uniquely vulnerable to emotional manipulation. Bad actors can exploit the system's urgency to extract money (via platform fee refunds), donor attention, or sensitive information. The fraud layer must protect donors, requesters, and the platform's integrity.

### 9.1 Verification Layers

| Layer | Method | Applies To | When |
|-------|--------|-----------|------|
| V1 | Phone OTP | All requests | At submission |
| V2 | Profile completeness check | All requests | At submission |
| V3 | Document upload | Scheduled, Urgent | At submission |
| V4 | Selfie with GPS + timestamp | Urgent, Emergency | At submission (emergency can skip) |
| V5 | Consent + legal acknowledgment | All requests | At submission |
| V6 | Hospital phone verification | Suspicious requests | Manual review |
| V7 | Admin manual verification | Rare blood, high-value, flagged | On trigger |

### 9.2 Doctor Note Validation

**Automated checks (future AI):**
- Does the document contain a hospital name/letterhead?
- Does the doctor's name appear?
- Is the date recent (< 7 days)?
- Does it mention the blood group needed?
- Is the hospital name in our verified list?

**Manual checks (admin):**
- Call hospital to verify the request
- Cross-check doctor registration number (future)

### 9.3 Hospital Verification

**Verified hospitals** are in the system's database. Requests from unverified hospitals get:

1. Higher fraud scrutiny score
2. Auto-trigger for document upload (cannot skip)
3. Additional verification steps
4. Admin notification

**Hospital verification process (admin):**
- Call hospital to confirm they have a blood collection unit
- Verify contact number
- Add to verified hospitals list

### 9.4 Suspicious Activity Scoring

```typescript
interface FraudScore {
  overall: number; // 0-100, higher = more suspicious
  
  // Sub-scores
  requester_freshness: number; // New account = suspicious
  relationship_distance: number; // "stranger" = more suspicious
  hospital_verified: number; // Unverified = more suspicious
  document_quality: number; // Missing/poor quality = suspicious
  duplicate_score: number; // Similar previous requests
  time_anomaly: number; // Multiple requests close together
  device_anomaly: number; // Different device from profile
  location_anomaly: number; // GPS far from hospital city
}
```

### 9.5 Fraud Response Actions

| Score | Action |
|-------|--------|
| 0-30 | Normal processing |
| 31-60 | Flag for review. Additional verification required. Donor notification starts but with delay. |
| 61-80 | Hold escalation. Requester contacted for verification. Admin notified. |
| 81-100 | Block request. Requester notified. Full investigation. |

### 9.6 Repeat-Abuse Detection

Track per phone number:

- Requests created but cancelled (refund claimed × > 3 in 30 days → flag)
- Same blood group, same hospital, different patient names (→ flag)
- Multiple requests within 24h (→ flag for family emergency or fraud)
- Donor complains about same requester (→ investigation)

### 9.7 Emergency Override

If a legitimate request is flagged as suspicious (false positive):

1. Requester can appeal via "This is genuine" button
2. Admin can override the fraud score
3. Known hospital can vouch for the request
4. Care circle members can verify the emergency

The system should have a **low false-positive rate** — better to let a mildly suspicious request through than to block a genuine emergency.

---

## S10 — Blood Bank / Hospital Fallback Layer

### Core Concept

When the donor network cannot fulfill a request, the system must have a reliable fallback. This is not failure — it is planned redundancy.

### 10.1 Blood Bank Database

```typescript
interface BloodBank {
  id: string;
  name: string;
  hospital_id?: string;
  city: string;
  state: string;
  phone: string;
  alt_phone?: string;
  opening_hours: string; // "24/7" or "9AM-5PM Mon-Sat"
  has_emergency_service: boolean;
  blood_stock: {
    "A+": "available" | "low" | "out";
    "A-": "available" | "low" | "out";
    "B+": "available" | "low" | "out";
    // ... all 8 types
  };
  verified: boolean;
  last_verified_at: string;
}
```

### 10.2 Fallback Triggers

| Condition | Action |
|-----------|--------|
| FCS < 0.30 at T-4h | Auto query blood bank DB for matching blood type |
| Wave 4 completes with no donor | Immediate blood bank escalation |
| Rare blood + no donor found within 2h | Blood bank escalation |
| Hospital has own blood bank | Connect requester directly |
| Multiple simultaneous requests same blood type | Blood bank blanket query |

### 10.3 Fallback Flow

```
System identifies blood bank with matching blood type
  → Admin contacts blood bank to verify availability
  → If available: Provide requester with blood bank contact + reference number
  → If not available: Check next blood bank, escalate to regional coordinator
  → If no blood bank in city: Check neighboring city blood banks
  → If no blood in region: State-level emergency escalation (future)
```

### 10.4 Admin Escalation Dashboard

Admin (via lifeline-admin) needs:

- Active requests sorted by FCS (ascending)
- One-click "Check blood banks" action
- Blood bank contact info with call history
- Requester contact info
- Escalation history for each request

---

## S11 — Emergency UX Flow

### Core Concept

The emergency flow is the highest-stakes interaction in the app. It must feel:

- Calm (not chaotic — stress is reduced by competent design)
- Clear (every step is predictable)
- Fast (no unnecessary friction)
- Trustworthy (the system radiates capability)

### 11.1 Requester Emergency Flow

```
1. HIT THE EMERGENCY BUTTON
   - Large red button on home screen: "Need Blood? — Emergency"
   - One tap → immediately into flow
   - No login gate (guest flow supported, with limited functionality)

2. IDENTIFY THE EMERGENCY (Step 1)
   - "Who needs blood?" → Self / Someone else
   - If someone else: Name + relationship
   - "What blood group?" → Grid of 8 + "Don't know"
   - Auto-detected from profile if logged in

3. WHERE + WHEN (Step 2)
   - Hospital name (typeahead)
   - City (auto-detected)
   - "Needed by": ASAP (default) / Custom time (dropdown)
   - Units needed (1-5, default 1)

4. VERIFY (Step 3) — Can skip entirely for emergency speed
   - Doctor note upload (optional, can do later)
   - Consent + responsibility acknowledgment
   - "Submit Emergency Request"

5. CONFIRMATION
   - Request submitted
   - "We are searching for donors near [hospital]"
   - Estimated response: 2-4 hours
   - Reference ID
   - "We'll update you via SMS. Keep your phone handy."
   - Also shows: "Tip: Call the hospital blood bank directly at [number]"
```

**Total steps to submit: 3 screens (not 4).** Emergency strips optional fields.

### 11.2 Donor Emergency Notification UX

When a donor receives an emergency notification:

```
SMS:
LIFELINE EMERGENCY: [blood group] needed at [hospital], [city].
[patient name] needs your help within 2-4 hours.
Reply YES to commit or see details: [shortlink]
- LifeLine Voluntary Donor Network

In-app notification:
┌─────────────────────────────────────────────┐
│  🩸 EMERGENCY BLOOD NEEDED                 │
│                                             │
│  [patient] needs [blood group]             │
│  [hospital], [city]                         │
│  [distance] away · Needed within 2-4 hours  │
│                                             │
│  ┌──────────┐  ┌──────────────────┐        │
│  │ I Can Go │  │ View Details     │        │
│  └──────────┘  └──────────────────┘        │
└─────────────────────────────────────────────┘
```

### 11.3 Donor Commitment Flow

```
1. Notification arrives
2. Donor taps "I Can Go" or "View Details"
3. Request detail page shows:
   - Patient name (first name only)
   - Blood group needed
   - Hospital name + address + map link
   - Required by time
   - "Donors needed: [X] more"
   - Requester phone (shown only after commitment, for coordination)
4. Donor confirms:
   - "I understand I'm committing to donate blood"
   - "I confirm I'm eligible to donate"
   - "I will arrive at the hospital by [time]"
5. Success screen:
   - Confirmed! Thank you.
   - Hospital directions (maps link)
   - "The requester will contact you shortly"
   - "Please carry ID proof"
```

### 11.4 Real-Time Status for Requester

The requester sees a live status dashboard after submitting:

```
┌────────────────────────────────────────────┐
│  REQUEST STATUS                            │
│                                            │
│  🩸 [blood group] needed at [hospital]    │
│                                            │
│  Searching for donors...                   │
│  ●●●○○○○○○○  (countdown-like visual)      │
│                                            │
│  Donors found: 0 of [units_needed]        │
│                                            │
│  ┌──────────────────────────────────┐      │
│  │  Donors contacted: 5             │      │
│  │  Donors committed: 0             │      │
│  │  Time elapsed: 15 min            │      │
│  └──────────────────────────────────┘      │
│                                            │
│  Meanwhile: Call [hospital] blood bank     │
│  at [number] as a backup                  │
│                                            │
│  [Cancel Request]                          │
└────────────────────────────────────────────┘
```

The status updates in real time (polling every 30s or WebSocket). Never show empty/loading state — always show meaningful information.

---

## S12 — Request Lifecycle State Machine

### 12.1 Canonical State Machine

```
                    ┌───────────┐
                    │   DRAFT   │  - Form started but not submitted
                    └─────┬─────┘
                          │ submit
                          ▼
              ┌─────────────────────┐
              │ VERIFICATION_PENDING│  - Fraud/duplicate check running
              └──────────┬──────────┘
                    ┌────┴────┐
                    │         │
               pass check    fail check
                    │         │
                    ▼         ▼
              ┌─────────┐ ┌──────────┐
              │ ACTIVE  │ │ REJECTED │  - Failed verification
              └────┬────┘ └──────────┘
                   │
          ┌────────┼────────┐
          │        │        │
          ▼        ▼        ▼
    ┌──────────┐ ┌─────┐ ┌───────────┐
    │ SEARCHING│ │HOLD │ │MATCH_FOUND│  - At least 1 donor
    │ (Waves)  │ │     │ │  (Partial)│    committed
    └─────┬────┘ └─────┘ └─────┬─────┘
          │                    │
          ▼                    │
    ┌──────────┐              │
    │FULFILLED │◄─────────────┘  - All units committed + confirmed
    │          │
    ├─ fulfilled ──► Donation completed, requester confirmed
    ├─ expired  ──► Deadline passed, no fulfillment
    └─────┬────┘
          │
          ├──────────────────┐
          ▼                  ▼
    ┌──────────┐      ┌──────────┐
    │ COMPLETED│      │  FAILED  │  - Expired unfulfilled
    │ (Success)│      └──────────┘
    └──────────┘

Other terminal states:
  - CANCELLED: Requester cancelled before fulfillment
  - ESCALATED: Moved to blood bank / admin (parallel to SEARCHING)
  - REJECTED: Failed verification
```

### 12.2 State Transition Table

| Current State | Event | Next State | Notes |
|-------------|-------|-----------|-------|
| DRAFT | Submit | VERIFICATION_PENDING | |
| VERIFICATION_PENDING | Pass check | ACTIVE | |
| VERIFICATION_PENDING | Fail check | REJECTED | Terminal |
| ACTIVE | Start search | SEARCHING | Escalation waves begin |
| ACTIVE | Admin hold | HOLD | Manual pause |
| ACTIVE | Cancel | CANCELLED | Terminal |
| SEARCHING | Cancel | CANCELLED | Terminal |
| SEARCHING | Timeout | EXPIRED → FAILED | Terminal |
| SEARCHING | Rare blood | MATCH_FOUND (partial) → ACTIVE | Partial match, continue search |
| SEARCHING | Donor commits | MATCH_FOUND (partial) | Continue searching for remaining units |
| MATCH_FOUND | All units committed | ACTIVE (fully matched, awaiting confirmation) | |
| ACTIVE (matched) | Requester confirms all | FULFILLED | |
| HOLD | Admin releases | ACTIVE → SEARCHING | |
| FULFILLED | Donation confirmed | COMPLETED | Terminal |
| ACTIVE | Escalate to blood bank | ESCALATED | Parallel state, search continues |
| SEARCHING | Escalate to blood bank | ESCALATED | Parallel state |

### 12.3 State Display Labels (for UI)

| State | UI Label | Description |
|-------|----------|-------------|
| DRAFT | "Draft" | Hidden from public |
| VERIFICATION_PENDING | "Verifying" | System check in progress |
| ACTIVE | "Looking for donors" | Actively searching |
| SEARCHING | "Contacting donors" | Escalation waves active |
| HOLD | "On hold" | Admin review |
| MATCH_FOUND | "Donor found" | X of Y donors committed |
| FULFILLED | "Fulfilled" | All donors confirmed |
| COMPLETED | "Completed" | Successfully donated |
| FAILED | "Unfulfilled" | Could not find donors |
| CANCELLED | "Cancelled" | Requester cancelled |
| REJECTED | "Not accepted" | Failed verification |
| ESCALATED | "Escalated" | Admin intervention |

### 12.4 Auto-Expiry Logic

| Tier | Auto-expiry after | Warning at |
|------|-------------------|------------|
| Emergency | Deadline + 1h | T-30min |
| Urgent | Deadline + 2h | T-2h |
| Scheduled | Deadline + 24h | T-24h |

**Expiry actions:**
1. Send final status SMS to requester
2. Release all committed donors (if any)
3. If unfulfilled: transition to FAILED, process refund (if paid)
4. If partially fulfilled: transition to FULFILLED for completed, note partial
5. Notify admin

### 12.5 Partial Fulfillment Handling

If only 2 of 3 units are fulfilled:

1. System marks request as `partially_fulfilled`
2. Requester is asked: "We found 2 of 3 units. Is this sufficient?"
3. If yes → transition to FULFILLED (partial)
4. If no → continue searching for remaining unit
5. Refund logic: partial refund for the unfulfilled unit's fee

---

## S13 — Donor Response Lifecycle

### 13.1 Donor Commitment State Machine

```
                    ┌──────────┐
                    │ NOTIFIED │  - Donor received notification
                    └─────┬────┘
                          │ respond
                    ┌─────┴──────┐
                    │            │
                    ▼            ▼
              ┌──────────┐  ┌──────────┐
              │ ACCEPTED │  │ DECLINED │  - "Not available"
              └─────┬────┘  └──────────┘
                    │                   
              ┌─────┴──────┐            
              │            │            
              ▼            ▼            
        ┌──────────┐  ┌──────────┐      
        │COMMITTED │  │ PENDING  │  - Said yes, hasn't finalized
        └─────┬────┘  └──────────┘      
              │                   
              │ arrive at hospital
              ▼                   
        ┌──────────┐             
        │ CHECKED_IN│  - Future: GPS geofence
        └─────┬────┘             
              │                   
              │ donate blood       
              ▼                   
        ┌──────────┐             
        │ DONATED  │  - Donor marks "I donated"
        └─────┬────┘             
              │                   
              │ requester confirms
              ▼                   
        ┌──────────┐             
        │CONFIRMED │  - Terminal (success)
        └──────────┘             

Failure paths:

        ┌──────────┐
        │COMMITTED │
        └─────┬────┘
              │ ghost
              ▼
        ┌──────────┐
        │ NO_SHOW  │  - Terminal (failure)
        └──────────┘

        ┌──────────┐
        │COMMITTED │
        └─────┬────┘
              │ cancel
              ▼
        ┌──────────┐
        │CANCELLED │  - Donor backs out
        └──────────┘
```

### 13.2 Donor States at a Glance

| State | Meaning | Visible to Requester |
|-------|---------|---------------------|
| NOTIFIED | Donor received alert | No |
| ACCEPTED | Donor said they can help | Yes (shown as potential) |
| COMMITTED | Donor confirmed commitment | Yes (shown as committed) |
| PENDING | Said yes, hasn't finalized | Yes (shown as pending) |
| CHECKED_IN | Arrived at hospital | Yes (reassuring) |
| DONATED | Donated successfully | Yes |
| CONFIRMED | Requester confirmed donation | Yes |
| NO_SHOW | Didn't arrive | Yes (counts against fulfillment) |
| CANCELLED | Backed out after committing | Yes |

### 13.3 Communication During Donor Lifecycle

| Event | Communication | Channel |
|-------|--------------|---------|
| Donor accepts | "Thank you! We'll share details shortly." | In-app |
| Final commitment | "You've committed to donate at [hospital] on [date] by [time]. Requester will contact you." | In-app + SMS |
| Reminder | "Reminder: Your donation is tomorrow at [hospital] at [time]." | SMS (24h before) |
| Check-in prompt | "Arrived at [hospital]? Tap to check in." | In-app |
| Post- donation | "Thank you for saving a life!" | In-app |
| No-show follow-up | "We missed you at [hospital]. Everything okay?" | In-app |
| Ghost penalty | "Your account has been temporarily restricted due to missed commitments." | SMS + in-app |

### 13.4 No-Show Grace Period

If a donor cannot make it:
- They can cancel up to 1 hour before without penalty
- Cancellation within 1 hour → counts as `missed` but with explanation option
- No-show without communication → full penalty
- Medical emergency → waived (honor system with admin verification)

---

## S14 — Multi-Donor Coordination Logic

### Core Concept

A single request may need multiple donors. The system must coordinate them without over-committing or under-supplying.

### 14.1 Commitment Pooling

```
units_needed = 3

Phase 1: Search for 3 donors
Phase 2: As each donor commits, pool grows:
  committed: 1, still needed: 2
  committed: 2, still needed: 1
  committed: 3, fulfilled: start confirmation

Over-commitment buffer:
  Search for units_needed × 1.5 (rounded up)
  But only notify (units_needed - already committed) at any time
  Buffer prevents ghosting from leaving request short
```

### 14.2 Redundant Commitment Strategy

For emergency tier only:

```
Search target: units_needed × 2
Example: Need 3 units → Search for 6 donors
Rationale: In emergencies, ghost rate is higher (~30-40%)
If all 6 show up → request is over-fulfilled (not a problem for blood banks)
If 3 ghost → 3 still donate, request fulfilled
```

Over-fulfilled blood is not wasted — hospitals can use it for other patients. Never discourage extra donors from donating at a blood bank.

### 14.3 Donor Replacement Logic

If a committed donor cancels:

1. Immediately notify next available donor from the queue
2. If no queue exists, trigger a mini-wave: notify 2-3 closest eligible donors
3. Update requester: "One donor had to cancel. We've found a replacement."

### 14.4 Multiple Requesters, Same Donor

A donor cannot be double-booked. If a donor commits to Request A, they are blocked from Request B during the same time window.

When Request B comes in and the donor matches:

```
if donor has active commitment overlapping with request time_window:
  skip donor for Request B
  donor never sees Request B (reducing noise)
```

---

## S15 — Rare Blood Escalation Logic

### 15.1 Rare Blood Classification for India

| Blood Type | Approx. Prevalence in India | Classification |
|------------|---------------------------|----------------|
| O+ | ~35% | Common |
| A+ | ~20% | Common |
| B+ | ~30% | Common |
| O- | ~1% | Very Rare |
| A- | ~1% | Very Rare |
| B- | ~2% | Rare |
| AB+ | ~2% | Rare |
| AB- | ~1% | Very Rare |

### 15.2 Rare Blood Fulfillment Strategy

**Very rare (O-, A-, AB-):**
1. Start with city-wide search (no radius ramp)
2. Pre-identify all rare blood donors in the city
3. Notify ALL rare donors immediately (no wave delay)
4. Blood bank escalation at T+0 (immediately)
5. Expand to state-level search if no local match within 2h
6. Admin contacts known rare donor registry (future)
7. Cross-state coordination (future: national rare blood network)

**Rare (B-, AB+):**
1. Start at 25km radius (vs standard 5km)
2. Waves compressed: Wave 1 → 2: 10 min, Wave 2 → 3: 20 min
3. Blood bank escalation at Wave 3 (not Wave 4)
4. City-wide by Wave 3

### 15.3 Rare Blood Donor Pool

Donors with rare blood types can opt into:

```
rare_donor_pledge: boolean; // Willing to be contacted anytime for rare blood needs
rare_donor_priority: "high" | "standard"; // High = always notify first
```

Rare donors are **cultivated carefully**:
- Never notified for common blood types
- Only notified for their specific rare type or universal recipient needs
- Receive special recognition (not gamified — genuine appreciation)
- Get priority when they themselves need blood

### 15.4 Universal Donor Logic

O- (universal donor) is the most versatile but also the rarest.

- O- donors are only notified for:
  1. O- requests (their exact match)
  2. Emergency O+ requests (when no O- is available for a child/newborn — hospital judgment call)
  3. Mass casualty events (admin override)
- O- blood is a strategic resource — the system conserves it

---

## S16 — Failure-State Recovery Logic

### Philosophy

A fulfillment system will fail. Donors will ghost. Requests will go unfilled. The system must handle failure gracefully, with human oversight and contingency paths. Failure is not exceptional — it's a designed-for state.

### 16.1 Failure Scenario Catalog

| # | Scenario | Likelihood | Severity | Primary Response | Secondary Response |
|---|----------|-----------|----------|-----------------|-------------------|
| F1 | Zero donors nearby (rural) | Medium | High | Auto-expand to city-wide | Blood bank fallback |
| F2 | Donor accepted but unreachable | Low | Medium | Try SMS + call 3x | Mark unreachable, find next donor |
| F3 | Donor ghosts (committed, no-show) | Medium | Medium | Mark no-show, trigger replacement | Requester notified |
| F4 | Donor cancels mid-process | Low | Low | Immediate replacement from queue | Update requester |
| F5 | Multiple concurrent emergencies (disaster) | Low | Critical | Admin override, mass notification | Blood bank + NGO escalation |
| F6 | Fake request submitted | Medium | Low | Fraud detection blocks | Admin review |
| F7 | Hospital refuses donation | Low | Medium | Contact next hospital | Admin intervention |
| F8 | Blood sourced externally (requester found own) | Medium | Low | Cancel request | Refund processing |
| F9 | Poor internet (requester can't submit) | Medium | Medium | SMS-based intake (future) | Phone call through admin |
| F10 | Nighttime emergency | Medium | High | Private-vehicle-only notification | Wider radius |
| F11 | Pediatric emergency | Low | High | Prioritize matching, special messaging | Hospital with pediatric ICU |
| F12 | Rare blood crisis | Low | Critical | Rare donor pool immediate notification | Cross-state search |
| F13 | Transport failure (donor can't reach hospital) | Low | Low | Alternative donor | Extended deadline |
| F14 | Donor ineligible at check (low hemoglobin) | Medium | Low | Mark declined, get replacement | No penalty for donor |
| F15 | Hospital blood bank closed (night/Sunday) | Medium | Medium | Find 24h hospital | Admin intervention |

### 16.2 Recovery Procedures

**F1 — Zero Donors:**
```
1. Auto-expand radius to max (city-wide) — done
2. If still zero: set FCS to very low, transition to ESCALATED
3. Requester alert: "No donors found in your area."
4. Provide blood bank contacts + instructions
5. Offer full refund
6. Admin notified for manual outreach
```

**F2/F3 — Donor Ghosting:**
```
1. System waits 15 min past commitment time
2. Auto-text: "Are you still able to donate?" 
3. Wait 15 min → no response → mark NO_SHOW
4. Trigger replacement (see 14.3)
5. Update requester: "One donor was unable to make it. We're finding a replacement."
```

**F5 — Disaster Surge:**
```
1. Admin declares emergency mode
2. All eligible donors in affected city notified
3. Normal wave logic bypassed
4. Blood banks pre-contacted
5. Hospital coordination started
6. Normal requests paused or deprioritized
7. External NGO coordination via admin
```

**F9 — Poor Internet:**
```
1. Progressive web app with offline capability
2. Form data saved to localStorage, synced when connectivity returns
3. SMS-based fallback: Text NEED BLOOD [blood group] [city] to a number (future)
4. Admin can create request on behalf of caller
```

### 16.3 Recovery Time Objectives

| Scenario | Target recovery time | Acceptable max |
|----------|---------------------|----------------|
| Ghost donor → replacement | 30 min | 1 hour |
| Zero donors → blood bank fallback | 1 hour | 2 hours |
| Fake request → blocked | 5 min (auto) | 15 min |
| Nighttime → donor found | 2 hours | 4 hours |
| Rare blood → state search | 4 hours | 8 hours |

### 16.4 Admin Notification Matrix

| Event | Admin Notification | Urgency |
|-------|-------------------|---------|
| FCS < 0.30 | Dashboard badge | Low |
| Wave 3 triggered | Dashboard notification | Medium |
| No donors after Wave 3 | SMS + dashboard alert | High |
| Rare blood request | Dashboard notification | Medium |
| Potential fraud detected | Dashboard alert | High |
| Disaster surge detected | Phone call + SMS | Critical |
| Refund triggered | Dashboard notification | Low |
| Donor ghosted | Dashboard notification | Low |

---

## S17 — Entity & Data Model Recommendations

### 17.1 New Tables (Supabase)

**blood_requests** (enhanced from current)
```sql
CREATE TABLE blood_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lifeline_id TEXT NOT NULL, -- LL-XXXXXXX
  
  -- Patient info
  patient_name TEXT NOT NULL,
  patient_age INTEGER,
  patient_relationship TEXT, -- self, spouse, child, parent, sibling, friend, stranger, other
  blood_group TEXT NOT NULL, -- A+, A-, B+, B-, AB+, AB-, O+, O-
  units_needed INTEGER NOT NULL DEFAULT 1 CHECK (units_needed BETWEEN 1 AND 5),
  fresh_blood_required BOOLEAN DEFAULT FALSE,
  rare_blood_flag BOOLEAN DEFAULT FALSE,
  
  -- Hospital info
  hospital_id UUID REFERENCES hospitals(id),
  hospital_name TEXT NOT NULL,
  hospital_city TEXT NOT NULL,
  hospital_lat DECIMAL,
  hospital_lng DECIMAL,
  
  -- Timing
  tier TEXT NOT NULL CHECK (tier IN ('scheduled', 'urgent', 'emergency')),
  required_date DATE,
  required_time TIME,
  fulfillment_deadline TIMESTAMPTZ,
  
  -- State
  status TEXT NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'verification_pending', 'active', 'searching', 'hold', 
           'match_found', 'fulfilled', 'completed', 'failed', 'cancelled', 'rejected', 'escalated')),
  fcs_score DECIMAL, -- Latest Fulfillment Confidence Score
  current_wave INTEGER DEFAULT 0,
  current_radius_km INTEGER DEFAULT 5,
  
  -- Verification
  verification_level INTEGER DEFAULT 1,
  doctor_note_url TEXT,
  selfie_url TEXT,
  consent_timestamp TIMESTAMPTZ,
  fraud_score INTEGER DEFAULT 0,
  
  -- Requester
  requester_phone TEXT NOT NULL,
  requester_user_id UUID REFERENCES auth.users(id),
  
  -- Payment (future: Razorpay)
  platform_fee INTEGER, -- in paise (₹)
  payment_id TEXT,
  refund_status TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  
  -- Full text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', patient_name || ' ' || blood_group || ' ' || hospital_name || ' ' || hospital_city)
  ) STORED
);

CREATE INDEX idx_blood_requests_status ON blood_requests(status);
CREATE INDEX idx_blood_requests_blood_group ON blood_requests(blood_group);
CREATE INDEX idx_blood_requests_hospital_city ON blood_requests(hospital_city);
CREATE INDEX idx_blood_requests_requester ON blood_requests(requester_phone);
CREATE INDEX idx_blood_requests_fulfillment_deadline ON blood_requests(fulfillment_deadline);
CREATE INDEX idx_blood_requests_search ON blood_requests USING GIN(search_vector);
```

**donor_profiles** (enhanced from current)
```sql
CREATE TABLE donor_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  
  -- Core
  lifeline_id TEXT UNIQUE,
  blood_group TEXT,
  blood_group_unknown BOOLEAN DEFAULT FALSE,
  
  -- Donation stats
  lifeline_donations INTEGER DEFAULT 0, -- Only LifeLine-confirmed
  pre_lifeline_donations INTEGER DEFAULT 0,
  last_donation_date DATE,
  total_commitments INTEGER DEFAULT 0,
  successful_donations INTEGER DEFAULT 0,
  missed_donations INTEGER DEFAULT 0,
  
  -- Availability
  availability_toggle BOOLEAN DEFAULT TRUE,
  always_available BOOLEAN DEFAULT FALSE,
  emergency_only BOOLEAN DEFAULT FALSE,
  temporarily_unavailable BOOLEAN DEFAULT FALSE,
  unavailable_until DATE,
  max_travel_radius_km INTEGER DEFAULT 10,
  preferred_time_of_day TEXT DEFAULT 'flexible',
  
  -- Operational state
  donor_state TEXT DEFAULT 'available_now'
    CHECK (donor_state IN ('available_now', 'available_today', 'scheduled_available', 
           'emergency_only', 'cooldown', 'temporarily_unavailable', 'inactive', 'unreachable')),
  
  -- Reliability scoring
  reliability_score INTEGER DEFAULT 0, -- 0-100
  reliability_tier TEXT DEFAULT 'unproven'
    CHECK (reliability_tier IN ('high', 'moderate', 'low', 'unproven')),
  response_rate DECIMAL DEFAULT 0, -- 0-1
  show_rate DECIMAL DEFAULT 0, -- 0-1
  consecutive_ghosts INTEGER DEFAULT 0,
  fatigue_score DECIMAL DEFAULT 0, -- 0-1
  
  -- Rare blood
  rare_donor_pledge BOOLEAN DEFAULT FALSE,
  rare_donor_priority TEXT DEFAULT 'standard',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  last_notified_at TIMESTAMPTZ
);

CREATE INDEX idx_donor_profiles_blood_group ON donor_profiles(blood_group);
CREATE INDEX idx_donor_profiles_state ON donor_profiles(donor_state);
CREATE INDEX idx_donor_profiles_reliability ON donor_profiles(reliability_tier);
```

**weekly_schedules**
```sql
CREATE TABLE weekly_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID REFERENCES donor_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (donor_id, day_of_week, start_time)
);
```

**donor_commitments** (moved from localStorage-only to DB)
```sql
CREATE TABLE donor_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES blood_requests(id) ON DELETE CASCADE,
  donor_id UUID REFERENCES donor_profiles(id) ON DELETE CASCADE,
  
  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'notified'
    CHECK (status IN ('notified', 'accepted', 'pending', 'committed', 'checked_in', 
           'donated', 'confirmed', 'no_show', 'cancelled')),
  notified_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  committed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  donated_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  
  -- Response tracking
  notification_id TEXT, -- Links to the notification that triggered this
  response_time_seconds INTEGER, -- How fast they responded
  
  -- Metadata
  notes TEXT,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (request_id, donor_id) -- A donor can only commit once per request
);

CREATE INDEX idx_commitments_request ON donor_commitments(request_id);
CREATE INDEX idx_commitments_donor ON donor_commitments(donor_id);
CREATE INDEX idx_commitments_status ON donor_commitments(status);
```

**escalation_waves**
```sql
CREATE TABLE escalation_waves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES blood_requests(id) ON DELETE CASCADE,
  wave_number INTEGER NOT NULL,
  radius_km INTEGER,
  
  -- Timing
  triggered_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  donor_count INTEGER DEFAULT 0, -- How many donors were notified
  commit_count INTEGER DEFAULT 0, -- How many committed
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'halted')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_waves_request ON escalation_waves(request_id);
```

**notification_log** (for tracking notification delivery)
```sql
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES blood_requests(id),
  donor_id UUID REFERENCES donor_profiles(id),
  wave_id UUID REFERENCES escalation_waves(id),
  
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'in_app', 'whatsapp', 'email', 'phone')),
  template_name TEXT,
  content TEXT,
  
  -- Delivery tracking
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'delivered', 'failed', 'read', 'responded')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  response TEXT, -- 'accepted', 'declined', 'ignored'
  response_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_request ON notification_log(request_id);
CREATE INDEX idx_notif_donor ON notification_log(donor_id);
CREATE INDEX idx_notif_status ON notification_log(status);
```

**hospitals** (new)
```sql
CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  lat DECIMAL,
  lng DECIMAL,
  phone TEXT,
  alt_phone TEXT,
  has_blood_bank BOOLEAN DEFAULT FALSE,
  blood_bank_phone TEXT,
  has_24h_emergency BOOLEAN DEFAULT FALSE,
  has_pediatric_ward BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hospitals_city ON hospitals(city);
CREATE INDEX idx_hospitals_verified ON hospitals(verified);
```

**blood_banks** (new)
```sql
CREATE TABLE blood_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  hospital_id UUID REFERENCES hospitals(id),
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  has_24h_service BOOLEAN DEFAULT FALSE,
  
  -- Stock levels (updated periodically by admin)
  stock_a_plus TEXT DEFAULT 'unknown',
  stock_a_minus TEXT DEFAULT 'unknown',
  stock_b_plus TEXT DEFAULT 'unknown',
  stock_b_minus TEXT DEFAULT 'unknown',
  stock_ab_plus TEXT DEFAULT 'unknown',
  stock_ab_minus TEXT DEFAULT 'unknown',
  stock_o_plus TEXT DEFAULT 'unknown',
  stock_o_minus TEXT DEFAULT 'unknown',
  
  last_stock_update TIMESTAMPTZ,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**fcs_snapshots** (Fulfillment Confidence Score history)
```sql
CREATE TABLE fcs_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES blood_requests(id) ON DELETE CASCADE,
  score DECIMAL NOT NULL,
  donor_density DECIMAL,
  donor_availability DECIMAL,
  time_feasibility DECIMAL,
  radius_coverage DECIMAL,
  response_probability DECIMAL,
  trigger_event TEXT, -- What caused recalculation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fcs_request ON fcs_snapshots(request_id);
```

### 17.2 Supabase Storage Buckets

```txt
blood_requests/
  {request_id}/
    doctor_note.jpg
    selfie.jpg
    ...

blood_verification/
  {request_id}/
    ...
```

### 17.3 Real-time (Supabase Realtime)

Enable Realtime for:
- `blood_requests` status changes (so donor UI updates live)
- `donor_commitments` commitment events (so requester dashboard updates)

---

## S18 — AI Integration Points (Future)

These are deferred to Phase 2+ but the architecture should support them:

### 18.1 AI Eligibility Prediction

- Predict donor likelihood to respond based on time of day, past behavior, request type
- Fine-tune donor ranking with ML model

### 18.2 AI Fraud Detection

- NLP on doctor notes to detect fake prescriptions
- Anomaly detection on request patterns
- Image analysis on selfies for liveness detection

### 18.3 AI Matching Optimization

- Learn which donor types are most reliable for which request types
- Optimize wave timing based on historical response patterns
- Predict fulfillment probability more accurately with ML vs. heuristic scoring

### 18.4 AI Routing

- For rare blood, predict which neighboring city has the highest probability of a match
- Optimize radius expansion direction (not just circular, but toward donor-dense areas)

### 18.5 AI Communication

- Generate personalized notification text based on donor's response history
- Smart timing of notifications (learning when each donor is most responsive)

### 18.6 AI Hospital Matching

- Predict which hospitals in a city have compatible blood bank stock
- Route requests to hospitals with available supply before donor search

### 18.7 Integration Points

The FCE scoring function should be designed as a **pluggable function** so the heuristic version can be replaced with an ML model:

```typescript
// Current: heuristic
function calculateFCS(request, context): number { ... }

// Future: ML model (plugs into same interface)
function calculateFCS_ML(request, context): number {
  return await mlService.predict({
    features: extractFeatures(request, context),
    modelName: "fulfillment-confidence-v2"
  });
}
```

---

## S19 — MVP vs. Future-Phase Separation

### MVP (Phase 1 — Build Now)

| Component | MVP Scope | Notes |
|-----------|-----------|-------|
| Request Intake | Full 4-step flow with tier selection, emergency short path | Existing code, minor enhancements |
| FCE | Heuristic-only (no ML). 6-factor model. | Simple weighted average |
| TAE | Basic time windows. No complex schedule parsing. | Store as JSON blob initially |
| Donor State | Available/unavailable/cooldown only. No reliability scoring. | |
| Escalation | 3 waves (not 4). Fixed timing. No adaptive delays. | Wave 4 = manual admin |
| Radius | Fixed: 5→10→25→city. No urban/rural differentiation. | |
| Notifications | SMS via MSG91 + in-app. No delivery tracking. | Log all sends |
| Fatigue Prevention | Rate limit: 3 notif/day max. No burnout detection. | |
| Fraud Prevention | Phone OTP + document upload. No scoring model. | |
| Blood Bank Fallback | Manual admin lookup. No automated query. | Start with static list |
| Request Lifecycle | Basic state machine (active → fulfilled → completed / failed / expired) | |
| Donor Lifecycle | Notified → Committed → Donated → Confirmed / No-show | |
| Multi-Donor | Track committed count. No over-commitment buffer. | |
| Rare Blood | Flag only. No special handling beyond wider search. | |

### Phase 2 (Next)

| Component | Enhancement |
|-----------|-------------|
| FCE | ML model for fulfillment prediction. Full 8-factor scoring. |
| TAE | Full weekly schedule UI. Time-window matching algorithm. |
| Donor State | Full state machine with reliability scoring. |
| Escalation | 4 waves. Adaptive timing. Auto-halt conditions. |
| Radius | Urban/rural differentiation. Travel feasibility model. |
| Notifications | Delivery tracking. Read receipts. WhatsApp channel. |
| Fatigue Prevention | Burnout detection. Notification budget enforcement. |
| Fraud Prevention | Scoring model. Hospital verification calls. |
| Blood Bank Fallback | Automated query against blood bank database. |
| Donor Lifecycle | Full state machine with checked_in, pending states. |
| Multi-Donor | Over-commitment buffer. Replacement queue. |
| Rare Blood | Dedicated search. Rare donor pool. State-level escalation. |

### Phase 3 (Future)

| Component | Enhancement |
|-----------|-------------|
| AI Integration | All AI features (see S18) |
| Blood Bank Integration | Real-time stock API. Automated ordering. |
| Disaster Mode | Mass casualty surge handling. |
| Cross-State Coordination | Regional blood network. |
| ABHA Integration | Health ID-linked donor records. |
| Hospital Confirmation | Direct hospital system integration. |

---

## S20 — Critical Risks

### R1 — Donor Supply is Inherently Unpredictable
**Risk:** Blood donation is voluntary. No SLA can be guaranteed.
**Mitigation:** FCE provides realistic expectations. Blood bank fallback exists. Communications never guarantee fulfillment. Refund policy is clear.

### R2 — Fraud / Emotional Scams
**Risk:** Bad actors exploit emotional urgency to extract platform fees or donor attention.
**Mitigation:** Multi-layer fraud prevention. Admin review for flagged requests. No-fee for NGO/waived requests. Identity verification.

### R3 — Notification Fatigue
**Risk:** Donors opt out entirely because of over-notification.
**Mitigation:** Strict rate limiting. Fatigue detection. Respect quiet hours. Notification budget. Easy opt-out.

### R4 — Ghost Donors
**Risk:** High no-show rate undermines system credibility.
**Mitigation:** Over-commitment buffer for emergencies. Replacement logic. Ghost penalties. Reliability scoring.

### R5 — Rare Blood Unavailability
**Risk:** Rare blood requests cannot be fulfilled, causing distress.
**Mitigation:** Pre-identified rare donor pool. Blood bank escalation. Clear communication about probability. State-level fallback.

### R6 — Disaster Surge
**Risk:** Multiple simultaneous emergencies overwhelm the system.
**Mitigation:** Admin override. Mass notification mode. Request prioritization. NGO coordination.

### R7 — Rural Coverage Gap
**Risk:** Rural areas have very few donors, making the system ineffective.
**Mitigation:** Wider default radius. Blood bank fallback. NGO partnership. Offline/SMS fallback.

### R8 — Legal Liability
**Risk:** Platform could be held liable for non-fulfillment in emergencies.
**Mitigation:** Clear terms: platform coordinates, does not guarantee. Consent flow with scroll-to-bottom + timer. Emergency disclaimer. Legal review of all copy.

### R9 — Payment Handling
**Risk:** Refund disputes, chargebacks, payment failures.
**Mitigation:** Clear fee-as-platform-cost language. Escrow-style payment holds. Automated refund on failure. Razorpay integration.

### R10 — Donor Burnout / Emotional Toll
**Risk:** Donors experience emotional distress from repeated exposure to emergencies.
**Mitigation:** Limited exposure to graphic details. Opt-out from pediatric requests. Calm language. Appreciation without gamification. Support resources.

---

## S21 — Recommended Implementation Order

### Sprint 1 — Foundation
1. Enhanced `blood_requests` table with all columns (migration)
2. `donor_profiles` table with operational state (migration)
3. `donor_commitments` table (migration — move from localStorage to DB)
4. Basic FCE (6-factor heuristic, deployed as edge function)
5. Enhanced request intake (rare_blood_flag, relationship field, pediatric handling)

### Sprint 2 — Matching Engine
6. Donor matching query (find eligible donors for a request)
7. Tier-based radius expansion logic
8. Basic escalation wave engine (3 waves, fixed timing)
9. Notification dispatch to matched donors (SMS via MSG91)
10. Notification log + delivery tracking

### Sprint 3 — Lifecycle & Coordination
11. Full request lifecycle state machine
12. Donor commitment lifecycle
13. Multi-donor coordination (pool tracking, replacement logic)
14. Requester real-time status dashboard
15. Request detail enhancements (donor count, status timeline)

### Sprint 4 — Reliability
16. Reliability scoring system
17. Ghost detection + penalty system
18. Fatigue prevention + notification budgeting
19. Donor availability module (time windows)
20. Cool-down management

### Sprint 5 — Safety & Fallback
21. Fraud scoring + verification layers
22. Blood bank / hospital database
23. Blood bank escalation flow
24. Admin dashboard for fulfillment oversight
25. Refund processing

### Sprint 6 — Rare Blood & Edge Cases
26. Rare blood detection + special handling
27. Rare donor pool cultivation
28. Rural/urban radius differentiation
29. Nighttime emergency handling
30. Pediatric emergency priority

### Sprint 7 — Hardening
31. Failure scenario recovery procedures
32. Disaster surge handling
33. Full edge-case scenario library as automated tests
34. Performance optimization (indexing, query tuning)
35. Monitoring + alerting for fulfillment metrics

### Sprint 8 — UX Polish
36. Calm UX language audit across all flows
37. Emergency flow simplification (3 screens)
38. Donor appreciation system (non-gamified)
39. Requester SMS updates during lifecycle
40. Accessibility review

---

## Appendix A: UX Language Principles

### What to Say

| Situation | Language |
|-----------|----------|
| Request submitted | "Your request has been submitted. We are searching for donors near [hospital]." |
| Donor found | "A donor has committed to help. They will arrive at [hospital] by [time]." |
| No donors yet | "We're still searching. Donors in your area have been notified." |
| Low confidence | "Donor availability in your area is limited. Here are additional resources." |
| Expired | "We were unable to find donors for this request. Your fee has been refunded." |
| Donor notified | "A donor near you needs [blood group]. Can you help?" |
| Donor committed | "Thank you for committing to save a life. [Patient] is waiting." |
| Post-donation | "You saved a life today. [Patient first name]'s family thanks you." |

### What NOT to Say

| Don't Say | Instead Say |
|-----------|-------------|
| "Urgent! Emergency! Critical!" | Use for emergency tier only. Never for scheduled. |
| "You must donate now" | "A patient needs your help if you're available." |
| "We guarantee a donor" | "We will do our best to find donors." |
| "X people will die" | "Every donation helps save lives." |
| "Your streak will break" | No streaks. No break. |

---

## Appendix B: Key Metrics to Track

| Metric | What It Measures | Target |
|--------|-----------------|--------|
| Time-to-first-commit | How fast first donor commits | < 30 min (emergency) |
| Fulfillment rate | % of requests fulfilled | > 70% |
| Donor show rate | % of committed donors who show | > 85% |
| Avg response time | How fast donors respond to notifications | < 10 min |
| Ghost rate | % of donors who no-show | < 15% |
| Fatigue rate | % of donors who opt out or go inactive | < 5%/month |
| False positive fraud rate | % of legitimate requests flagged as fraud | < 2% |
| Refund rate | % of requests refunded | < 20% |
| FCS accuracy | How well FCS predicts fulfillment | ±0.15 error |
| Rare blood fill rate | Fulfillment rate for rare blood types | > 50% |
| Rural fill rate | Fulfillment rate in rural areas | > 40% |
| NPS (requester) | Requester satisfaction | > 40 |
| NPS (donor) | Donor satisfaction | > 50 |

---

## Appendix C: Architecture Decision Records

### ADR-001: localStorage-First for Commitments (Phase 1)

**Decision:** Donor commitments remain localStorage-first in Phase 1, with async sync to the `donor_commitments` table.

**Rationale:**
- Offline resilience (core value)
- Immediate UI responsiveness
- Avoid race conditions between sync and user actions
- Existing codebase pattern

**Trade-off:** Requires reconciliation logic when conflicts arise between local and server state.

**Resolution:** Sync on commit, read from localStorage for UI, use server state for cross-device awareness.

### ADR-002: Edge Functions for FCE

**Decision:** Fulfillment Confidence Engine runs as a Supabase Edge Function (Deno).

**Rationale:**
- Proximity to database (reduces latency)
- No additional server infrastructure
- Can be called via RPC from client
- Easy to version and deploy separately
- Can be swapped to ML model without client changes

### ADR-003: Wave Engine as Scheduled Jobs

**Decision:** Escalation waves are implemented as scheduled checks (polling every N minutes) rather than real-time triggers.

**Rationale:**
- Simpler to implement and debug
- No need for cron infrastructure initially
- Acceptable latency for wave timing (±1 min)
- Graceful degradation under load

**Future:** Migrate to pg_cron or Supabase scheduled functions for server-side wave triggering.

### ADR-004: Single Hospital Per Request

**Decision:** A blood request is tied to exactly one hospital (not "any hospital in the city").

**Rationale:**
- Donors need to know exactly where to go
- Hospital coordination is per-location
- Simplifies matching logic
- Reduces donor confusion

**Exception:** Emergency scene requests can specify "any nearby hospital" which is resolved to the nearest ER at request time.

---

*This document represents the foundational architecture for LifeLine Blood Fulfillment System v1. It is a living document — update as the system evolves.*

*Last updated: 2026-05-26*
