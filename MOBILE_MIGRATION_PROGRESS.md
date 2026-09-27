# Seoully Native Mobile Migration Progress

## Objective

Move Seoully toward a genuine Expo/React Native mobile application while preserving
the existing Next.js reference client, Supabase backend, catalog, ownership semantics,
security, and Room/Binder data model.

## State

- Branch: `mobile-native`
- Immutable reference checkpoint: `76be07a928ce3e9436031d7324a5cc2b1b0375ed`
- Current task: Phase A foundation — validate isolated Expo client and session boundary
- Overall status: IN PROGRESS

## Completed

- Verified branch and checkpoint.
- Audited current Next.js/domain/server/world layout.
- Classified direct reuse, adapters, native UI, and high-risk renderer areas.
- Added this plan and progress memory.
- Created `apps/mobile` with Expo SDK 57, Expo Router, strict TypeScript, native
  Supabase client, SecureStore session persistence, auth gate, tab shell, design tokens,
  and a small English/Korean foundation dictionary.
- Excluded the isolated native project from the Next.js root TypeScript project so the
  web DOM and React Native platform libraries do not collide during web checks.
- Added `/api/mobile/session`, a bearer-token native identity boundary that reuses the
  existing server-derived identity provisioning path without accepting client user IDs
  or privileged credentials.
- Added the first native production identity client call on the Profile tab.
- Added native catalog search against the existing production `/api/catalog/search`
  endpoint, with bounded real template results and no fabricated data.
- Added a bearer-authenticated native Holding creation endpoint that reuses the
  production Holding DAL and server-derived actor, plus native catalog selection and
  Add to Collection behavior.
- Added native camera/library acquisition with Expo ImagePicker, a persisted-safe
  personal-media upload boundary, and a photocard aspect-ratio crop step using Expo
  ImageManipulator. This first slice is implementation-complete for native API
  wiring; touch-adjustable crop and physical-device validation remain pending.
- Added a bearer-authenticated native catalog contribution endpoint and a first native
  manual-details screen. The current screen proves production contribution semantics;
  photo-first consent wiring still remains before this slice can be called complete.

## Current queue

1. Expo client foundation and strict TypeScript.
2. Shared API/environment contracts and native Supabase session adapter.
3. Native navigation/loading shell and localization adapter.
4. Auth/onboarding vertical slice.
5. Native social surfaces.
6. Native collection/media/crop vertical slice.
7. Room/Binder platform-neutral extraction and renderer proof.

## Blocked / device QA

- Native camera, crop gestures, safe areas, haptics, Room gestures/FPS, texture memory,
  and Android behavior require physical-device validation and are not claimed yet.

## Architectural decisions

- Keep `apps/mobile` isolated initially; do not rewrite or move the reference web app.
- Reuse production HTTP/Supabase contracts rather than importing Next Server Actions.
- Do not reactivate Vision, public search, or AI identification.
- Do not change Room/Binder until the native renderer proof is viable.

## Latest validation

Pre-migration checkpoint validation passed: typecheck, fixture checks, and diff check.
Mobile foundation TypeScript passes and Expo config resolves. `expo-doctor` reports a
local duplicate React copy because the existing root `node_modules` is adjacent to the
new isolated app; clean installs should be validated before release. Native device QA
is still pending.
- Native and web TypeScript, fixture checks, and diff checks pass after the collection
  slices. `next build` was retried and is currently blocked by the local Turbopack
  worker failing to bind a process port (`Operation not permitted`); retry in a clean
  build environment.

## Next autonomous task

Finish photo-first manual contribution with explicit reference-image consent and
shared/personal media separation, then add native Feed production reads. Full native
social, collection, Room, and Binder parity remain in the queue; no device QA is
claimed.
