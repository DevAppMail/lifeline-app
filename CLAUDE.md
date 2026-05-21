# lifeline-app — User Facing PWA

## Purpose
This is what donors and blood seekers use. 
- Blood seekers: create urgent requests
- Donors: register, get notified, accept requests

## Key Features Built So Far
- User auth (Supabase)
- Blood request creation flow
- Donor registration with blood group + location
- Basic matching logic

## Feature Queue (Build in This Order)
1. MSG91 SMS notifications for donor matching
2. Razorpay payment (platform fee on blood requests)
3. Donor acceptance + commitment flow
4. Request status tracking
5. Profile completion page
6. PostHog analytics

## Folder Structure
- src/components — UI components (use existing Radix/shadcn first)
- src/pages — route-level pages (Wouter)
- src/hooks — custom React hooks
- src/services — all Supabase calls go here
- src/lib — utilities, helpers
- src/types — TypeScript interfaces

## Environment Variables Needed
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=
VITE_MSG91_TEMPLATE_ID=
VITE_RAZORPAY_KEY_ID=

## Current Deployment
Replit (moving to Railway soon)

## Important Context
- Indian users — support Hindi text where needed
- Mobile-first design — most users on Android
- Blood groups: A+, A-, B+, B-, O+, O-, AB+, AB-
- Location matching radius: 10km default, expandable to 50km
