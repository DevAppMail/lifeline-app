# LifeLine — Master ID Architecture

> **Canonical ecosystem-wide identifier doctrine.**
> Covers all current entities, federation entities, healthcare continuity entities, operational events, audit/compliance entities, AI/analytics entities, infrastructure entities, and foreseeable future roadmap layers.

**Status:** Specification v1.0
**Last updated:** 2026-05-26
**Owner:** Devraj (solo founder)
**Repos covered:** lifeline-app, lifeline-pro, lifeline-admin, lifeline-app-bff
**Scope:** 5–10 year ecosystem horizon

---

## 1. Executive Summary

LifeLine currently has **three parallel ID systems** operating simultaneously across four repos. This is the single biggest technical debt and the highest-risk area for healthcare safety, federation integrity, and future scalability.

### Current Reality (Honest Assessment)

| System | Used By | IDs | Risk Level |
|--------|---------|-----|------------|
| **Serial integers** | lifeline-admin (legacy) | `users.id = 1`, `appointments.id = 42` | **HIGH** — exposed in URLs, no collision safety across systems |
| **UUIDv4** (`gen_random_uuid()`) | lifeline-pro, lifeline-admin (newer tables) | `a1b2c3d4-e5f6-...` | **LOW** — safe, but no semantic value for humans |
| **Local prefixed IDs** | lifeline-app (client-side) | `LL-XXXXXXXX`, localStorage keys | **MEDIUM** — no cross-system sync yet |
| **Phone-as-identity** | lifeline-app ↔ admin federation | Query by `phone` string | **HIGH** — phone numbers change, shared across family plans |
| **Supabase Auth UUID** | All systems (auth layer) | `auth.users.id` | **LOW** — stable, but not a healthcare identity |

### The Doctrine in One Paragraph

Every entity in the LifeLine ecosystem gets **two IDs**: an internal database ID (always UUIDv4, generated server-side) and, where semantically meaningful, a **public federation ID** with a human-readable prefix. The public ID is the canonical cross-system identifier. Internal UUIDs never leave their owning system. The federated JWT is the cross-system identity envelope. Phone numbers are NOT identities. The LifelineID (`LL-XXXXXXXX`) becomes the universal patient-facing health identifier.

---

## 2. Core Philosophy

### Design Principles

1. **Two-ID system for every entity**
   - Internal DB ID: UUIDv4 (`gen_random_uuid()`) — never exposed outside its owning system
   - Public Federation ID: prefixed, human-readable — canonical cross-system identifier

2. **Phone is NOT an identity**
   - Phone numbers change (new SIM, family plan, lost phone)
   - Phone numbers are identifiers of communication channels, not persons
   - Phone is a lookup key, not a primary or federation key

3. **The federated JWT is the identity envelope**
   - Carries all cross-system identifiers in one signed token
   - System boundaries are crossed only via federation tokens
   - Never query another system's database directly

4. **Prefixes are semantic, not decorative**
   - Every prefix encodes the owning system and entity type
   - `LL-PAT-XXXXXXXX` immediately tells you it's a Lifeline Patient ID
   - `AD-DOC-XXXXXXXX` tells you it's an Admin Doctor ID

5. **Healthcare identity is separate from auth identity**
   - `auth.users.id` is a session identity — it can change
   - `lifeline_id` is a health identity — it should never change
   - The health identity persists across auth provider changes

6. **Events have identity too**
   - Every state-changing event gets a unique event ID
   - Event lineage chains parent→child for audit traceability

7. **Immutable by default, archive by design**
   - IDs never change (immutable)
   - Records soft-delete (voided), never hard-delete
   - Event chains preserve the full history

### Inspired By (Not Copying)

| Source | Borrowed Concept | Rejected |
|--------|-----------------|----------|
| **FHIR** | Resource-level identifiers, `identifier` system | Complexity, full FHIR stack |
| **OpenMRS** | Patient identifier management, UUID internal IDs | Java enterprise patterns |
| **OpenEMR** | Encounter numbering, visit ID patterns | Legacy DB patterns |
| **HL7** | Event-driven encounter lineage, placer/filler IDs | Heavyweight messaging |
| **RxNorm** | External concept IDs (rxcui) for drug vocab | US-only scope |

---

## 3. Internal vs Public ID Strategy

### Internal IDs

```
Format: UUIDv4 (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
Store: gen_random_uuid() DEFAULT on every table
Expose: Never in URLs, never in API responses, never in client-side code
Use: Foreign keys, joins, internal queries only
```

### Public Federation IDs

```
Format: {PREFIX}-{BODY}
PREFIX: 2-5 uppercase ASCII chars (system + entity code)
BODY:   10-14 chars from charset (no I,O,0,1 for handwriting safety)
Example: LL-PAT-A7XK3M9N2P
Example: AD-DOC-8JR5FT2L3W
Example: PRO-APT-6BHN4XS8VK
```

### ID Lifecycle Rules

| Property | Internal ID | Public Federation ID |
|----------|-------------|---------------------|
| Generation | Server-side `gen_random_uuid()` | Server-side, at entity creation |
| Immutable | Yes (never changes) | Yes (never changes) |
| Exposed to user | Never | Always (for support, documents, coordination) |
| Exposed in URL | Never | Always (public resource identifier) |
| Cross-system | Never (stays in owning system) | Always (federation identifier) |
| Human-readable | No | Yes (prefixed, short) |

### Exceptions
- **Auth identities** (`auth.users.id`) are UUIDs from Supabase — they are SYSTEM IDs, not patient IDs
- **Temporary/local entities** use the `TMP-` prefix — must be resolved to permanent before touching production
- **Demo entities** use the `DEMO-` prefix — never escaped demo mode
- **External healthcare IDs** (ABHA, rxcui, NMC number) are stored as-is in their own columns

---

## 4. Canonical Prefix Registry

### 4.1 Master Prefix Table

| Prefix | Owning System | Entity Category | Entity Types |
|--------|---------------|-----------------|--------------|
| `LL` | lifeline-app | Patient Identity | patient |
| `LL-PAT` | lifeline-app | Patient Health | patient health record |
| `LL-REQ` | lifeline-app | Blood Request | blood request |
| `LL-DON` | lifeline-app | Donation | donation confirmation, event |
| `LL-TL` | lifeline-app | Timeline | health timeline event |
| `LL-CC` | lifeline-app | Care Circle | care circle member |
| `LL-NTF` | lifeline-app | Notification | notification, SMS |
| `AD-USR` | lifeline-admin | User Identity | user, donor profile |
| `AD-DOC` | lifeline-admin | Doctor | doctor, provider |
| `AD-APT` | lifeline-admin | Appointment | appointment (legacy) |
| `AD-BLD` | lifeline-admin | Blood Ops | blood request, wave, escrow |
| `AD-FIN` | lifeline-admin | Financial | invoice, billing, ledger |
| `AD-AUD` | lifeline-admin | Audit | audit log, operational event |
| `AD-AD` | lifeline-admin | Ad Platform | ad, banner, campaign |
| `PRO-PAT` | lifeline-pro | Patient | pro patient record |
| `PRO-APT` | lifeline-pro | Appointment | pro appointment |
| `PRO-CON` | lifeline-pro | Consultation | consultation session |
| `PRO-RX` | lifeline-pro | Prescription | prescription |
| `PRO-BIL` | lifeline-pro | Billing | session billing |
| `PRO-FUP` | lifeline-pro | Follow-up | follow-up recommendation |
| `PRO-QUE` | lifeline-pro | Queue | queue item |
| `PRO-DOC` | lifeline-pro | Doctor | pro doctor association |
| `PRO-CLN` | lifeline-pro | Clinic | clinic, clinic doctor |
| `PRO-DRG` | lifeline-pro | Drug Master | drug master entry |
| `EVT` | shared | Event | operational event, federation event |
| `TMP` | any | Temporary | local-only, pre-sync entity |
| `DEMO` | any | Demo | demo/test entity (never production) |
| `SYS` | shared | System | job, webhook, retry, sync |
| `AI` | shared | AI/Analytics | recommendation, prediction, inference |
| `EXT` | shared | External Reference | ABHA, rxcui, NMC, external system ref |

---

## 5. Entity-by-Entity ID Matrix

### 5.1 Identity Entities

#### Patient / User
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 (`gen_random_uuid()`) |
| Public Federation ID | `LL-PAT-XXXXXXXXXX` (10-char body) |
| Auth ID (separate) | `auth.users.id` (Supabase UUID) |
| Ownership | lifeline-app (primary), lifeline-pro (mirror via pro_patients) |
| Lifecycle | Permanent |
| User-visible | `LL-PAT-XXXXXXXXXX` + LifelineID `LL-XXXXXXXX` (for patient) |
| Cross-system | Yes — `LL-PAT-*` is the canonical patient identifier |
| Healthcare-critical | Yes |
| Notification-linked | Yes |
| Retention | Never deleted (voided if deactivated) |

#### Doctor / Provider
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 (pro: `pro_patients`/`pro_clinic_doctors`), Serial (admin: `doctors.id`) |
| Public Federation ID | `AD-DOC-XXXXXXXXXX` (admin) / `PRO-DOC-XXXXXXXXXX` (pro) |
| Professional ID (external) | `nmc_number` (NMC registration) — stored in its own column |
| Auth ID | `auth.users.id` (Supabase UUID for pro doctors) |
| Ownership | lifeline-admin (directory), lifeline-pro (clinic ops) |
| Lifecycle | Permanent |
| Healthcare-critical | Yes |
| Cross-system | Admin doctor directory ↔ Pro via federation bridge |
| **Migration note** | Admin `doctors.id` (serial) → needs UUID migration |

#### Clinic
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `PRO-CLN-XXXXXXXXXX` |
| Ownership | lifeline-pro |
| Lifecycle | Permanent |
| Cross-system | References only within pro ecosystem |

#### NGO / Blood Bank / Lab
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `EXT-NGO-XXXXXXXXXX` / `EXT-LAB-XXXXXXXXXX` |
| Ownership | lifeline-admin (registry) |
| Lifecycle | Permanent |
| Cross-system | Future — federation with external partners |

---

### 5.2 Healthcare Entities

#### Appointment
| Property | Value |
|----------|-------|
| Internal DB ID | Serial (`appointments.id` in admin) / UUIDv4 (`pro_appointments.id` in pro) |
| Public Federation ID | `AD-APT-XXXXXXXXXX` (admin legacy) / `PRO-APT-XXXXXXXXXX` (pro) |
| Ownership | lifeline-admin (legacy) / lifeline-pro (primary) |
| Lifecycle | Created → confirmed/arrived → completed/cancelled/no_show |
| User-visible | Yes (in booking confirmation, profile) |
| Cross-system | Yes — app books → pro calendar, continuity reads from pro |
| Healthcare-critical | Yes |
| Financial-impacting | Yes |
| Notification-linked | Yes |
| Audit-required | Yes |
| **Migration note** | Admin appointments (serial) → migrating to pro appointments (UUID). Both coexist during transition. |

#### Queue Item
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `PRO-QUE-XXXXXXXXXX` |
| Ownership | lifeline-pro |
| Lifecycle | Created → waiting → in_consultation → completed/cancelled |
| Audit-required | Yes (appointment lifecycle) |

#### Consultation Session
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `PRO-CON-XXXXXXXXXX` |
| Ownership | lifeline-pro |
| Lifecycle | Open → completed |
| Healthcare-critical | Yes |
| Audit-required | Yes |
| Cross-system | Continuity read from lifeline-app (via BFF) |

#### Prescription
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `PRO-RX-XXXXXXXXXX` |
| Ownership | lifeline-pro |
| Lifecycle | Permanent (never deleted) |
| Healthcare-critical | Yes |
| Audit-required | Yes |
| Cross-system | Continuity read from lifeline-app (via BFF) |

#### Prescription Item
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 (stored as JSON array in `pro_session_prescriptions.medicines`) |
| Public Federation ID | None (sub-entity, not independently addressable) |
| Ownership | lifeline-pro |
| Lifecycle | Tied to parent prescription |

#### Diagnosis / Vitals Snapshot
| Property | Value |
|----------|-------|
| Internal DB ID | Stored within consultation session (`pro_consultation_sessions.diagnosis`, `.vitals`) |
| Public Federation ID | Not independently addressable (part of consultation) |
| Ownership | lifeline-pro |

#### Follow-Up
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 (`pro_follow_up_recommendations`) / Serial (admin `follow_ups`) |
| Public Federation ID | `PRO-FUP-XXXXXXXXXX` |
| Ownership | lifeline-pro (primary), lifeline-admin (legacy) |
| Lifecycle | Pending → accepted/rejected/expired |
| Healthcare-critical | Yes |
| Notification-linked | Yes (reminder for patient) |
| Cross-system | Recommended in pro → appears in app continuity |

#### Referral
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `PRO-REF-XXXXXXXXXX` |
| Ownership | lifeline-pro (future) |
| Lifecycle | Pending → accepted/rejected/closed |
| Healthcare-critical | Yes |
| Cross-system | Future — specialist referral across clinics |

#### Clinical Note
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `PRO-NTE-XXXXXXXXXX` (when independently shareable) |
| Ownership | lifeline-pro |
| Lifecycle | Permanent |
| Healthcare-critical | Yes |
| Visibility | Doctor-only (clinical_notes), patient-visible (patient_instructions) |

---

### 5.3 Financial Entities

#### Invoice
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `AD-FIN-INV-{provider_id}-{YYYYMM}-{seq}` (structural) |
| Invoice Number (display) | `INV-{provider_id}-{YYYYMM}-{seq}` |
| Ownership | lifeline-admin |
| Lifecycle | Generated → sent → pending → paid/waived/cancelled |
| Financial-impacting | Yes |
| Audit-required | Yes |
| User-visible | Yes (provider billing) |

#### Payment / Settlement / Refund
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `AD-FIN-PAY-XXXXXXXXXX` / `AD-FIN-SET-XXXXXXXXXX` / `AD-FIN-RFD-XXXXXXXXXX` |
| Ownership | lifeline-admin |
| Lifecycle | Initiated → processing → completed/failed/refunded |
| Financial-impacting | Yes |
| Audit-required | Yes |
| Notification-linked | Yes (payment confirmation, refund) |

#### Wallet Transaction
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `AD-FIN-WAL-XXXXXXXXXX` |
| Ownership | lifeline-admin (future) |
| Lifecycle | Created → completed/failed/voided |

#### Coupon / Reward
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `AD-FIN-CPN-XXXXXXXXXX` |
| Ownership | lifeline-admin (future) |

#### Ledger Entry
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 (`ledger_entries.id`) |
| Public Federation ID | `AD-FIN-LED-XXXXXXXXXX` |
| Ownership | lifeline-admin |
| Lifecycle | Created → settled/voided |
| Financial-impacting | Yes |
| Audit-required | Yes |
| Key field | `idempotency_key` — prevents duplicate processing |

---

### 5.4 Blood Ecosystem Entities

#### Blood Request
| Property | Value |
|----------|-------|
| Internal DB ID | Serial (`blood_requests.id` in admin) |
| Public Federation ID | `LL-REQ-XXXXXXXXXX` |
| Ownership | lifeline-app (request creation) → lifeline-admin (processing) |
| Lifecycle | Draft → pending → active → fulfilled/cancelled/expired |
| User-visible | Yes |
| Emergency path | Emergency tier → no radius cap → broadcast to city |
| Healthcare-critical | Yes |
| Financial-impacting | Yes (escrow deposits for urgent/emergency tiers) |
| Notification-linked | Yes (donor matching, SMS alerts) |
| **Migration note** | Serial → needs UUID migration. Public federation ID exists as `LL-REQ-*` |

#### Donation Confirmation
| Property | Value |
|----------|-------|
| Internal DB ID | Serial (`donation_confirmations.id` in admin) |
| Public Federation ID | `LL-DON-XXXXXXXXXX` |
| Ownership | lifeline-admin |
| Lifecycle | Awaiting requester → confirmed by both → completed / missed |
| Healthcare-critical | Yes |
| User-visible | Yes (donor badge, celebration) |
| **Migration note** | Serial → needs UUID migration |

#### Donation Event
| Property | Value |
|----------|-------|
| Internal DB ID | Not a separate entity (derived from donation confirmation) |
| Public Federation ID | `LL-DON-EVT-XXXXXXXXXX` (event view of confirmation) |
| Ownership | lifeline-admin |
| Lifecycle | Immutable (once confirmed, permanent) |

#### Blood Camp / Event
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 (`events.id`) |
| Public Federation ID | `AD-EVT-XXXXXXXXXX` |
| Ownership | lifeline-admin |

#### Emergency Alert
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `LL-ALRT-XXXXXXXXXX` |
| Ownership | lifeline-app → lifeline-admin |
| Lifecycle | Active → resolved/expired |
| Healthcare-critical | Yes |
| Notification-linked | Yes |

---

### 5.5 Notification Entities

#### Notification (In-App)
| Property | Value |
|----------|-------|
| Internal DB ID | Serial (`appointment_notifications.id`) |
| Public Federation ID | `LL-NTF-XXXXXXXXXX` |
| Ownership | lifeline-admin (generation) / lifeline-app (display) |
| Lifecycle | Created → read/dismissed |
| Notification-linked | Self |

#### SMS Event
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 (`notification_logs.id`) |
| Public Federation ID | `LL-NTF-SMS-XXXXXXXXXX` |
| Ownership | lifeline-admin |
| Lifecycle | Pending → sent/delivered/failed |
| Audit-required | Yes (MSG91 delivery tracking) |

#### Push Event
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `LL-NTF-PSH-XXXXXXXXXX` |
| Ownership | lifeline-app (future) |
| Lifecycle | Pending → delivered/failed |

#### Communication Thread
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `LL-NTF-THR-XXXXXXXXXX` |
| Ownership | lifeline-app (future) |
| Lifecycle | Active → resolved |

---

### 5.6 Timeline / Continuity Entities

#### Timeline Event
| Property | Value |
|----------|-------|
| Internal DB ID | Not DB-persisted (localStorage only, `health-store.ts`) |
| Public Federation ID | `LL-TL-XXXXXXXXXX` |
| Ownership | lifeline-app (client-side, localStorage) |
| Lifecycle | Append-only, filter+prepend pattern |
| Healthcare-critical | Yes |
| Cross-system | Will sync to pro (future) |

#### Medication Adherence Event
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `LL-TL-MED-XXXXXXXXXX` |
| Ownership | lifeline-app (future) |
| Lifecycle | Daily tracking → weekly summary |

#### Care Circle
| Property | Value |
|----------|-------|
| Internal DB ID | Not DB-persisted (localStorage only) |
| Public Federation ID | `LL-CC-XXXXXXXXXX` |
| Ownership | lifeline-app (client-side) |
| User-visible | Yes |
| Healthcare-critical | Yes (emergency contact) |

#### Linked Provider
| Property | Value |
|----------|-------|
| Internal DB ID | Not DB-persisted (localStorage only) |
| Public Federation ID | `LL-PROV-XXXXXXXXXX` (references PRO-DOC-*) |
| Ownership | lifeline-app |
| Cross-system | References doctor/provider in pro |

---

### 5.7 Infrastructure Entities

#### Sync Job
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `SYS-SYNC-XXXXXXXXXX` |
| Ownership | Shared (lifeline-app BFF / admin) |
| Lifecycle | Scheduled → running → completed/failed |

#### Webhook Event
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `SYS-WHK-XXXXXXXXXX` |
| Ownership | Shared |
| Lifecycle | Received → processing → delivered/failed/retrying |

#### Federation Event
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `EVT-FED-XXXXXXXXXX` |
| Ownership | Shared (any system that produces federation events) |
| Lifecycle | Created → delivered → acknowledged |
| Audit-required | Yes |
| Cross-system | Yes — this IS the federation traceability layer |

#### Retry Event
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `SYS-RTY-XXXXXXXXXX` |
| Ownership | Shared |
| Lifecycle | Pending → retrying → succeeded/failed_max |

#### Import/Export Job
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `SYS-IMP-XXXXXXXXXX` / `SYS-EXP-XXXXXXXXXX` |
| Ownership | Shared |

#### Backup Snapshot
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `SYS-BAK-XXXXXXXXXX` |
| Ownership | Infrastructure layer |

---

### 5.8 AI / Analytics Entities

#### Recommendation Event
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `AI-REC-XXXXXXXXXX` |
| Ownership | AI service (future) |
| Lifecycle | Generated → delivered → acted_on/dismissed |

#### Risk Score Snapshot
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `AI-RSK-XXXXXXXXXX` |
| Ownership | AI service (future) |
| Lifecycle | Snapshotted at intervals, immutable once stored |

#### Prediction Event / Inference Trace / Embedding Event
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `AI-PRD-XXXXXXXXXX` / `AI-INF-XXXXXXXXXX` / `AI-EMB-XXXXXXXXXX` |
| Ownership | AI service (future) |
| Lifecycle | Immutable (model version + input → output trace) |
| Audit-required | Yes (model governance) |

---

### 5.9 Future Healthcare Entities

#### Lab Order / Lab Result
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `LL-LAB-ORD-XXXXXXXXXX` / `LL-LAB-RES-XXXXXXXXXX` |
| Ownership | lifeline-pro (future) |

#### Imaging Study
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `LL-IMG-XXXXXXXXXX` |
| Ownership | lifeline-pro (future) |

#### Wearable Device / Sensor Reading / Health Sync Batch
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `LL-WEAR-XXXXXXXXXX` / `LL-SENS-XXXXXXXXXX` / `LL-SYNC-XXXXXXXXXX` |
| Ownership | lifeline-app (future, Phase 4) |

#### Insurance Claim
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `EXT-CLM-XXXXXXXXXX` (external system ID) + internal `LL-CLM-XXXXXXXXXX` |
| Ownership | lifeline-admin (future, Phase 2) |
| Financial-impacting | Yes |

#### Vaccination Campaign
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `LL-VAC-XXXXXXXXXX` |
| Ownership | lifeline-admin (future) |

#### Government Reporting Event
| Property | Value |
|----------|-------|
| Internal DB ID | UUIDv4 |
| Public Federation ID | `EXT-GOV-XXXXXXXXXX` |
| Ownership | Shared (compliance layer, future) |
| Audit-required | Yes |

---

## 6. Event Lineage Model

Every state change in the LifeLine ecosystem produces an event. Events form a directed acyclic graph (DAG) for complete traceability.

### Event Structure

```
{
  "event_id": "EVT-FED-XXXXXXXXXX",
  "event_type": "appointment.created",
  "entity_type": "PRO-APT",
  "entity_id": "PRO-APT-XXXXXXXXXX",
  "parent_event_id": "EVT-FED-YYYYYYYYYY",  // null for root events
  "root_event_id": "EVT-FED-ZZZZZZZZZZ",   // first event in chain
  "actor_id": "LL-PAT-XXXXXXXXXX",
  "system": "lifeline-app",
  "timestamp": "2026-05-26T10:30:00Z",
  "metadata": { ... },
  "signature": "..."  // optional: hash chain for audit integrity
}
```

### Event Chain Examples

```
Blood Request:
  LL-REQ-XXXX created
    → donation_confirmation.created (LL-DON-YYYY)
      → donor.confirmed
        → requester.confirmed
          → donation.completed

Appointment:
  PRO-APT-XXXX created
    → appointment.confirmed (by doctor)
      → consultation_session.created (PRO-CON-YYYY)
        → session.completed
          → prescription.created (PRO-RX-ZZZZ)
          → follow_up.created (PRO-FUP-WWWW)
          → billing.created (PRO-BIL-VVVV)
            → billing.completed

Emergency Alert:
  LL-ALRT-XXXX created
    → donor.notified (multiple events)
      → donor.committed
        → donation.confirmed
          → emergency.resolved
```

### Event Storage

- `operational_events` table in lifeline-admin (UUID PK, JSONB metadata)
- Federation events also stored in the producing system for local traceability
- Event chains traversable via `root_event_id` or `parent_event_id`

---

## 7. Federation Traceability Model

### Current Federation Points

```
lifeline-app (PWA)
    │
    │ Federated JWT (signed, HS256, 24h expiry)
    │   supabase_uid + lifeline_id + admin_user_id + pro_patient_id + phone
    ▼
lifeline-app BFF (port 3001)
    │
    ├──→ lifeline-admin (blood directory, doctor directory, legacy ops)
    │       X-BFF-Api-Key header
    │
    └──→ lifeline-pro (appointments, consultations, prescriptions, billing)
            Pro Supabase Service Key (direct REST API)
```

### Federation ID Flow

```
Patient creates account:
  supabase auth     → auth.users.id (UUID)
  lifeline_id       → LL-XXXXXXXX (generated client-side)

First identity bridge:
  LifelineID:       LL-XXXXXXXX
  Patient Fed ID:   LL-PAT-XXXXXXXXXX (generated by BFF)
  Pro Patient ID:   PRO-PAT-XXXXXXXXXX (created in pro)
  Admin User ID:    AD-USR-XXXXXXXXXX (resolved by phone)

Booking an appointment:
  Appointment Fed ID: PRO-APT-XXXXXXXXXX (created in pro)
  Doctor Fed ID:      AD-DOC-XXXXXXXXXX (referenced from admin)
  Federation Event:   EVT-FED-XXXXXXXXXX (traces the cross-system write)
```

### Future Federation Points

```
lifeline-app BFF → external healthcare systems (ABHA, NDHM)
lifeline-admin → payment gateways (Razorpay)
lifeline-pro → lab systems, imaging providers
```

---

## 8. Notification/Event Correlation Model

### Correlation ID

Every notification event chain gets a `correlation_id` that links:

```
Blood Request Notification Chain:
  LL-REQ-XXXX (blood request)
    → LL-NTF-SMS-YYYY (SMS to matching donors)
    → LL-DON-ZZZZ (donation confirmation)
    → LL-NTF-SMS-WWWW (confirmation SMS)

Correlation ID: LL-REQ-XXXX (the blood request public ID)
```

### Notification Event Structure

```
{
  "notification_id": "LL-NTF-XXXXXXXXXX",
  "correlation_id": "LL-REQ-XXXXXXXXXX",  // links to the triggering entity
  "event_type": "donor_matched",
  "recipient": "+919876543210",
  "channel": "sms",
  "template_id": "VITE_MSG91_TEMPLATE_ID",
  "delivery_status": "delivered",
  "federation_event_id": "EVT-FED-XXXXXXXXXX",
  "created_at": "2026-05-26T10:30:00Z"
}
```

### Key Design Rules

- Every notification has a `correlation_id` that links back to the triggering entity
- Every notification delivery attempt is logged with its status
- Notifications are correlated across channels (SMS, push, in-app)
- Failed deliveries surface events in the admin for manual intervention

---

## 9. Audit/Compliance Linkage Model

### Audit Event Structure

```
{
  "audit_id": "AD-AUD-XXXXXXXXXX",
  "event_type": "appointment.cancelled",
  "entity_type": "PRO-APT",
  "entity_id": "PRO-APT-XXXXXXXXXX",
  "actor_id": "LL-PAT-XXXXXXXXXX",
  "actor_role": "patient",
  "correlation_id": "EVT-FED-XXXXXXXXXX",
  "before_state": "...",  // JSON snapshot
  "after_state": "...",   // JSON snapshot
  "timestamp": "2026-05-26T10:30:00Z"
}
```

### Current Model

Admin's `audit_logs` table already supports:
- `entity_id` (integer) — for legacy serial-ID entities
- `entity_uuid` (uuid) — for newer UUID entities
- `before_data_json` / `after_data_json` — JSONB snapshots

### Future Model (Recommended)

- All audit events use `entity_id_text` (text) — the public federation ID
- `entity_uuid` (UUID) — internal UUID for DB-level traceability
- `before_data_json` / `after_data_json` — always populated
- `correlation_id` — links to federation event chain
- `event_type` — standardized event type taxonomy

### Retention

- Audit logs: **7 years minimum** (healthcare regulatory requirement)
- Federation events: **7 years minimum**
- Notification delivery logs: **2 years**
- AI inference traces: **1 year** (model governance)
- Operational logs: **90 days** (rolling)

---

## 10. Healthcare Continuity Lineage

The continuity lineage traces a patient's full healthcare journey across all LifeLine systems.

### Complete Lineage Path

```
Patient Identity (LL-PAT-XXXX)
  │
  ├── Appointment (PRO-APT-XXXX)
  │     ├── Queue Item (PRO-QUE-XXXX)
  │     └── Consultation Session (PRO-CON-XXXX)
  │           ├── Prescription (PRO-RX-XXXX)
  │           │     └── Prescription Items (embedded)
  │           ├── Diagnosis (embedded in session)
  │           ├── Vitals (embedded in session)
  │           ├── Clinical Note (embedded in session)
  │           ├── Follow-up Recommendation (PRO-FUP-XXXX)
  │           └── Billing (PRO-BIL-XXXX)
  │
  ├── Donation Event (LL-DON-XXXX)
  │     └── Blood Request (LL-REQ-XXXX)
  │
  ├── Timeline Event (LL-TL-XXXX) [localStorage → future pro sync]
  ├── Care Circle (LL-CC-XXXX) [localStorage]
  └── Linked Provider (reference to PRO-DOC-XXXX)
```

### Continuity Read Model (BFF)

The BFF `/api/app/continuity` endpoint returns this lineage as a unified DTO:

| DTO Section | Source | Query Key |
|-------------|--------|-----------|
| `appointments` | `pro_appointments` | `patient_id` |
| `consultations` | `pro_consultation_sessions` | `patient_id` |
| `prescriptions` | `pro_session_prescriptions` | `patient_id` |
| `followUps` | `pro_follow_up_recommendations` | `patient_id` |
| `billing` | `pro_session_billing` | `patient_id` |
| `summary` | Computed from all above | — |

### Healthcare ID Immutability Rules

- `LL-PAT-*` (patient identity): **NEVER changes** — this is the patient's permanent health identifier
- `PRO-APT-*` (appointment): Created immutable — status transitions are events, not mutations
- `PRO-RX-*` (prescription): Immutable once created — corrections add a new prescription
- `LL-DON-*` (donation): Immutable once confirmed
- `LL-TL-*` (timeline): Append-only, never updated in-place

---

## 11. Temporary-ID Migration Rules

### When Temporary IDs Are Used

1. **Local-only entities** (pre-sync): localStorage entities in lifeline-app
2. **Demo mode**: lifeline-pro's demo entities (`demo-doctor-1`, `local-{timestamp}`)
3. **Walk-in queue items**: lifeline-pro's `walkin-{timestamp}` IDs
4. **Offline-created entities**: lifeline-app commitments, health timeline entries

### Migration Path

```
Temporary ID (TMP-XXXX)
    │
    │ Step 1: Local creation with TMP prefix
    │ Step 2: Sync to owning system
    │         Replace TMP-XXXX with permanent UUID
    │         Store UUID: TMP-XXXX mapping in sync log
    ▼
    │ Step 3: Local entity updated with permanent federation ID
    │         TMP-XXXX discarded
    ▼
Permanent ID (LL-PAT-XXXX or PRO-APT-XXXX or etc.)
```

### Rules

- Temporary IDs **never escape the creating system**
- Temporary IDs **never appear in URLs, API responses, or federation events**
- Temporary IDs **must be resolved to permanent before the entity touches production**
- The TMP→permanent mapping is stored in a `sync_log` for reconciliation
- If sync fails, the entity remains local with its TMP prefix — no data loss

---

## 12. Existing Risk Analysis

### Risk 1: Serial Integers Exposed in URLs (CRITICAL)

**Location:** lifeline-admin — all legacy routes use `:id` as integer
**Impact:** Enumeration attacks, information disclosure, no collision safety across systems
**Example:** `GET /api/users/1`, `GET /api/appointments/42`
**Fix:** Replace with UUID-based public IDs in URL paths. Serial remains as internal-only.

### Risk 2: Phone Number as Identity (CRITICAL)

**Location:** lifeline-app ↔ admin federation, appointment queries, notification targeting
**Impact:** Phone numbers change (new SIM, lost phone, family plan change). Identity is lost.
**Example:** Profile lookup by `?phone=...`, notification targeting by phone string
**Fix:** Always use `LL-PAT-*` or `lifeline_id` for identity. Phone is a lookup key only.

### Risk 3: Duplicate Identity Concepts (HIGH)

**Location:** Across all repos
**Impact:** `supabase_uid`, `admin_user_id`, `pro_patient_id`, `lifeline_id`, `auth.users.id` — five different identity concepts for the same human
**Fix:** Federated JWT is the canonical envelope. Each system stores only its own IDs. The bridge is the only place where mapping exists.

### Risk 4: Missing Federation Identifiers on Patient (HIGH)

**Location:** lifeline-app profile, admin `users` table, pro `pro_patients`
**Impact:** No `lifeline_id` column in admin or pro tables. Cross-system patient linking is fragile.
**Fix:** Add `lifeline_id` (LL-XXXXXXXX) column to all patient/user tables.

### Risk 5: Raw UUID Exposure in URLs (MEDIUM)

**Location:** lifeline-pro — `GET /patients/:id` where `:id` is a raw UUID
**Impact:** No semantic value, ugly URLs, no human-readability for support
**Fix:** Replace raw UUIDs with public federation IDs (`PRO-PAT-XXXXXXXXXX`) in URLs.

### Risk 6: Inconsistent `voided_by` / `created_by` Types (MEDIUM)

**Location:** lifeline-pro `pro_appointments` — `voided_by` and `created_by` are `text`
**Impact:** No FK constraint, any string can be stored
**Fix:** Use `uuid` with FK to `auth.users` (or use federation ID as text with a consistent format).

### Risk 7: No LifelineID Column in Admin DB (MEDIUM)

**Location:** lifeline-admin — no `lifeline_id` column on `users`, `donors`, `appointments`
**Impact:** Cannot directly query admin records by LifelineID
**Fix:** Add `lifeline_id` column (text, nullable) to relevant admin tables.

### Risk 8: LocalStorage-Only Entities Have No Public ID (LOW-MEDIUM)

**Location:** lifeline-app — health timeline, care circle, commitments
**Impact:** When syncing to a server, there's no pre-existing federation ID to link to
**Fix:** Generate federation IDs on the server during first sync. Map local TMP-* IDs.

### Risk 9: No `lifeline_user_id` on All Pro Tables (LOW-MEDIUM)

**Location:** lifeline-pro — only `pro_patients` has `lifeline_user_id`
**Impact:** Pro appointments, consultations, etc. link to patient by UUID, but can't be directly traced to LifelineID
**Fix:** Use the patient UUID → LifelineID mapping via `pro_patients` (this is the correct design — don't denormalize LifelineID everywhere).

### Risk 10: Admin Identity Map Is Not Supabase-Migrated (LOW)

**Location:** lifeline-admin — `admin_identity_map` exists only in Drizzle schema, not in Supabase migrations
**Impact:** Schema drift between environments
**Fix:** Add Supabase migration for `admin_identity_map` table.

---

## 13. Migration Strategy From Current IDs

### Phase 1: Foundation (Now — Current Sprint)

1. **Document** the ID architecture (this document)
2. **Add federation IDs** to all new entities going forward
3. **Update the JWT** to carry federation IDs (already done for pro_patient_id)
4. **Stop exposing serial IDs** in new API responses

### Phase 2: New Entities (Next Sprint)

1. **All new tables** use UUIDv4 + public federation ID
2. **New endpoints** use public federation IDs in URLs (not raw UUIDs, not serials)
3. **Migrate legacy admin routes** to accept both serial ID and federation ID in URL paths

### Phase 3: Systematic Migration (Target: 2–3 Sprints)

1. **Admin `users` table**: Add `lifeline_id` column, backfill existing users
2. **Admin `appointments` table**: Add `public_id` column (federation ID), backfill
3. **Admin `blood_requests` table**: Add `public_id` column, backfill
4. **Admin `doctors` table**: Add `public_id` column, backfill
5. **Admin `donation_confirmations` table**: Add `public_id` column, backfill
6. **Update all admin routes** to support federation ID lookup
7. **Update BFF** to use federation IDs in proxy requests

### Phase 4: Deprecation (Target: 4–6 Sprints)

1. **Remove serial ID from URL paths** — use federation ID only
2. **Remove phone-as-identity** — use federation ID or LifelineID
3. **Finalize event lineage** — add `root_event_id` to operational events

### Rollback Safety

- Every migration adds columns (never removes, never renames)
- Old identifiers continue to work during transition
- Federation IDs are generated server-side at first touch
- Backward compatibility layer in route handlers (accept both old and new ID formats)

---

## 14. Future Expansion Strategy

### Expansion Vectors

| Vector | Impact on ID Architecture |
|--------|--------------------------|
| **New healthcare system** | Register new prefix in master prefix registry. Add federation bridge via JWT. |
| **New entity type** | Assign new prefix. Add to continuity read model. |
| **External partner** | Use `EXT-` prefix for partner IDs. Store partner's native ID in its own column. |
| **AI/analytics system** | `AI-` prefix for all AI entities. Link to source entities via federation ID. |
| **Wearable integration** | `LL-WEAR-*` for devices, `LL-SENS-*` for readings. Sync through health timeline. |
| **Government integration** | `EXT-GOV-*` for government IDs (ABHA). Store ABHA ID separately from LifelineID. |
| **Multi-region deployment** | Add region prefix: `LL-IN-`, `LL-US-`. Generation strategy includes region code. |

### Prefix Expansion Rules

- New prefixes must be registered in this document before production use
- Prefix format: 2–5 uppercase chars, separated by hyphens
- Ownership system must be clearly defined
- Prefix must not conflict with existing prefixes (checked against master registry)

### ID Body Size Planning

Current body: 10 characters from charset (no I,O,0,1) = 28^10 = ~296 quintillion combinations

If multi-region: reduce to 8-char body per region = 28^8 = ~377 billion — still sufficient.

If we outgrow: extend to 12-char body. Backward compatible via prefix detection.

---

## 15. Non-Goals / Anti-Patterns

### Explicitly Not Doing

| Anti-Pattern | Why |
|-------------|-----|
| **CQRS event sourcing** | Too heavy for current scale. Event logs are append-only, not event-sourced aggregates. |
| **Distributed ID generation (Snowflake, etc.)** | Single-region, single-database. Server-side UUIDv4 is sufficient. |
| **ULID** | Unnecessary for current scale. UUIDv4 + public prefix gives us what we need. |
| **Full FHIR compliance** | FHIR is an interop standard, not an ID system. We borrow concepts, not compliance. |
| **Blockchain-based audit** | Overengineered. Append-only event tables with JSONB snapshots are sufficient. |
| **Shared nothing architecture** | Not needed. We have 3 systems with known federation points. |
| **Auto-increment as identity** | Explicitly migrating away from this. Never use serial for new tables. |
| **Phone as primary key** | Explicitly migrating away from this. Phone is a lookup key only. |

### What We Keep

| Current Pattern | Why |
|----------------|-----|
| **`gen_random_uuid()` for PKs** | Battle-tested PostgreSQL function. UUIDv4 is sufficient. |
| **Supabase Auth UUID for session** | Correct. Auth identity ≠ health identity. Keep them separate. |
| **LifelineID `LL-XXXXXXXX` for patients** | Good UX pattern. Extend with `LL-PAT-*` for the system-level ID. |
| **JSONB for flexible data** | Vitals, medicines, metadata all use JSONB — correct design. |
| **Two-ID audit log** | `entity_id` (integer) + `entity_uuid` (uuid) is pragmatic during migration. |
| **localStorage first** | Offline-safe. Add sync with federation ID mapping. |

---

## 16. Final Recommended Ecosystem Doctrine

### The 10 Commandments of LifeLine IDs

**I. Every entity gets two IDs.**
The internal UUID is for the database. The public federation ID is for the ecosystem.

**II. Phone is never an identity.**
Phone numbers identify communication channels, not people. Use federation IDs for identity.

**III. Auth identity is not health identity.**
`auth.users.id` authenticates sessions. `lifeline_id` identifies the patient. They are different. They can change independently.

**IV. Federated JWT is the cross-system envelope.**
No system queries another system's database directly. The federated JWT carries all cross-system identifiers.

**V. Events are immutable.**
State changes produce events. Events are append-only. Event chains preserve complete lineage.

**VI. Prefixes are semantic.**
Every prefix encodes system + entity type. A prefix is a contract. Register new prefixes before production use.

**VII. URLs use public IDs, never internal IDs.**
API paths, query parameters, and user-facing links use federation IDs. Internal UUIDs and serials never appear in URLs.

**VIII. Healthcare continuity is the primary axis.**
The patient's health journey across all systems is the continuity lineage. IDs must support traversing this lineage.

**IX. Temporary IDs never escape their creating system.**
Local, offline, and demo entities use `TMP-` or `DEMO-` prefixes. They are resolved to permanent before crossing system boundaries.

**X. Migrate, don't break.**
Add columns. Support old IDs during transition. Never remove, never rename, never repurpose an existing ID.

### Prefix Registration Checklist

Before a new prefix can be used in production:
- [ ] Prefix is registered in this document (MASTER_ID_ARCHITECTURE.md)
- [ ] Prefix follows format rules (2–5 uppercase ASCII, hyphen-separated)
- [ ] Owning system is clearly defined
- [ ] Entity category and entity types are documented
- [ ] Lifecycle scope is defined
- [ ] Cross-system behavior is defined
- [ ] No conflict with existing prefixes

### Quick Reference: ID Format by Entity

| Entity | Internal DB ID | Public Federation ID | URL Usage | User-Visible |
|--------|---------------|---------------------|-----------|-------------|
| Patient | UUIDv4 | `LL-PAT-XXXXXXXXXX` | Yes | Yes (as `LL-XXXXXXXX`) |
| Doctor (admin) | Serial | `AD-DOC-XXXXXXXXXX` | Yes | No |
| Doctor (pro) | UUIDv4 | `PRO-DOC-XXXXXXXXXX` | Yes | No |
| Appointment (admin) | Serial | `AD-APT-XXXXXXXXXX` | Yes | Yes (in history) |
| Appointment (pro) | UUIDv4 | `PRO-APT-XXXXXXXXXX` | Yes | Yes (in history) |
| Blood Request | Serial | `LL-REQ-XXXXXXXXXX` | Yes | Yes (in request view) |
| Donation Confirmation | Serial | `LL-DON-XXXXXXXXXX` | Yes | Yes (in profile) |
| Consultation | UUIDv4 | `PRO-CON-XXXXXXXXXX` | No (internal) | No |
| Prescription | UUIDv4 | `PRO-RX-XXXXXXXXXX` | No (internal) | Yes (on prescription doc) |
| Follow-up | UUIDv4 | `PRO-FUP-XXXXXXXXXX` | No (internal) | Yes (in continuity) |
| Billing Entry | UUIDv4 | `PRO-BIL-XXXXXXXXXX` | No (internal) | No |
| Invoice | UUIDv4 | `AD-FIN-INV-*` | Yes | Yes (billing portal) |
| Notification | Serial/UUIDv4 | `LL-NTF-XXXXXXXXXX` | No | No |
| Federation Event | UUIDv4 | `EVT-FED-XXXXXXXXXX` | No | No |
| Audit Log | Serial/UUIDv4 | `AD-AUD-XXXXXXXXXX` | No | No |
| Drug Master | UUIDv4 | `PRO-DRG-XXXXXXXXXX` | No | No |
| Clinic | UUIDv4 | `PRO-CLN-XXXXXXXXXX` | Yes | Yes (clinic profile) |

---

*This is a living document. Update when new entity types are added, when federation points change, or when the ecosystem expands to new healthcare domains.*
