# Seoully Native Mobile Migration Progress

## Objective

Move Seoully toward a genuine Expo/React Native mobile application while preserving
the existing Next.js reference client, Supabase backend, catalog, ownership semantics,
security, and Room/Binder data model.

## State

- Branch: `mobile-native`
- Immutable reference checkpoint: `76be07a928ce3e9436031d7324a5cc2b1b0375ed`
- Current task: native social parity — Search/Explore and social interactions
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
- Added a bearer-authenticated native Feed read path reusing the existing social DAL;
  the native Feed now renders real followed/public production posts when configured.
- Added bearer-authenticated catalog-reference upload support and wired the native
  new-template path to an explicit opt-in shared-photo checkbox. Personal Holding media
  and shared CatalogReferenceImage uploads remain separate server operations.
- Added native Profile bio editing through a bearer-authenticated server boundary that
  reuses the existing validated profile patch and server-derived actor.
- Added durable native onboarding progression for new production profiles. Existing
  profiles are backfilled as complete while newly provisioned profiles start with the
  group step; progress remains bound to the authenticated profile under existing RLS.
- Added native group, bias, and collector-interest onboarding using the canonical web
  group/member facts, resumable server state, English/Korean copy, and a tab/deep-link
  gate that prevents incomplete accounts from bypassing onboarding.
- Native account creation now supplies validated handle/display-name auth metadata so
  Supabase provisions the same Seoully identity shape as the web client.
- Added persisted English/Korean locale state and an Expo ESLint configuration; mobile
  lint is now part of migration validation.

## Current queue

1. Expo client foundation and strict TypeScript.
2. Shared API/environment contracts and native Supabase session adapter.
3. Native navigation/loading shell and localization adapter.
4. Auth/onboarding vertical slice (group/bias/interests complete; avatar and confirmed
   email deep-link QA remain).
5. Native social surfaces (production Feed read exists; interactions/Search/Messages
   remain).
6. Native collection/media/crop vertical slice.
7. Room/Binder platform-neutral extraction and renderer proof.

## Blocked / device QA

- Native camera, crop gestures, safe areas, haptics, Room gestures/FPS, texture memory,
  and Android behavior require physical-device validation and are not claimed yet.
- Native onboarding layout, keyboard behavior, email-confirmation return, and locale
  restoration are implementation-complete but AWAITING DEVICE QA.
- `20260930000000_native_onboarding_progress.sql` must be applied through the normal
  migration process before the new onboarding endpoint is deployed. It has not been
  applied to production by this migration work.

## Architectural decisions

- Keep `apps/mobile` isolated initially; do not rewrite or move the reference web app.
- Reuse production HTTP/Supabase contracts rather than importing Next Server Actions.
- Do not reactivate Vision, public search, or AI identification.
- Do not change Room/Binder until the native renderer proof is viable.

## Latest validation

Pre-migration checkpoint validation passed: typecheck, fixture checks, and diff check.
Mobile foundation TypeScript passes and Expo config resolves. After adding the Expo
ESLint toolchain, `expo-doctor` passes all 21 checks in the current isolated app.
Native device QA is still pending.
- Native and web TypeScript, fixture checks, and diff checks pass after the collection
  slices. `next build` was retried and is currently blocked by the local Turbopack
  worker failing to bind a process port (`Operation not permitted`); retry in a clean
  build environment.
- Native onboarding validation passes `expo lint`, mobile strict TypeScript, Expo config
  resolution, web TypeScript, fixture checks, and `git diff --check`. No physical-device
  behavior is claimed.

## Next autonomous task

Native onboarding now persists and resumes group/bias/interest progress without
replaying for existing profiles. Next: production Search/Explore and social
interactions, followed by collection/detail/wishlist/trade and Messages parity. Full
Room and Binder parity remain mandatory in the queue. No device QA is claimed.
