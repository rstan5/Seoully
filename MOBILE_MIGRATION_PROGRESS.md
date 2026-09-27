# Seoully Native Mobile Migration Progress

## Objective

Move Seoully toward a genuine Expo/React Native mobile application while preserving
the existing Next.js reference client, Supabase backend, catalog, ownership semantics,
security, and Room/Binder data model.

## State

- Branch: `mobile-native`
- Immutable reference checkpoint: `76be07a928ce3e9436031d7324a5cc2b1b0375ed`
- Current task: physical-device and deployed-backend QA handoff
- Overall status: NON-DEVICE IMPLEMENTATION CHECKPOINT COMPLETE — AWAITING QA

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
- Added production-backed native Explore recommendations for collectors and
  collectibles through a bearer-authenticated discovery boundary. The existing
  deterministic ranking, compatibility evidence, privacy filtering, canonical
  catalog, and authenticated actor derivation are reused rather than duplicated.
- Reworked native Search into localized Search/Explore behavior: an empty query shows
  ranked recommendations, while a catalog query retains the production add-to-
  collection path. Native Room entry is intentionally not implied before its renderer
  exists.
- Added bearer-authenticated native post like/unlike and comment read/create
  boundaries that reuse the production Social DAL, authenticated actor derivation,
  validation, RLS, and idempotent like semantics.
- Upgraded the native Feed with production image media, localized optimistic
  like/unlike controls with rollback, expandable comments, and comment composition.
- Added a production-backed native Collection/Wishlist surface. It renders actual
  Holdings and signed personal-media URLs, preserves Holding identity, allows owners
  to change the existing `trade_status`, lists real wishlist entries, and removes them.
- Native catalog and discovery results can now add canonical templates to the
  production wishlist through the existing idempotent wishlist DAL. Bearer-native
  collection and wishlist routes retain server-derived actor ownership and RLS.
- Added a production direct-message foundation with participant-only RLS, an
  authenticated pair-conversation RPC, bounded message bodies, and no anonymous table
  access. The server always derives the sender from the bearer session.
- Replaced the native Messages placeholder with production conversation and thread
  screens, private message composition, localized loading/error/empty states, and a
  message entry point from collector recommendations.
- Added native collector profiles backed by the production public-profile contract,
  including privacy-aware collection summaries, follower counts, idempotent follow/
  unfollow, and direct-message entry. Explore recommendations now navigate to these
  profiles rather than acting as inert cards.
- Defined and implemented the first native Room renderer boundary using Expo GL,
  Three.js, and React Three Fiber's native renderer. The proof renders a real
  authenticated Room, a bounded set of real Holdings, photocard/album/object geometry,
  signed personal-media textures, an actual perspective camera, lights, and room
  planes without a WebView.
- Added native Room tap/focus and edit gestures. A selected Holding can be dragged in
  the native scene; coordinates are adapted to the existing web world convention and
  persisted through the existing `RoomPlacement` transform, zone, surface, slot, and
  Holding identity semantics under bearer auth and RLS.
- Added Binder V2 as native physical paging rather than a CSS-3D translation. Real
  photocard Holdings are grouped stably by group/release, laid into 3×2 pockets,
  organized as left/right spreads, padded with a blank partner for odd page counts,
  and placed into a general section when no release exists.
- Binder pockets preserve Holding identity and render the owner's signed personal
  media as the card face. Native horizontal page gestures turn spreads and tapping a
  card opens a focused inspection view.
- Added native authored-post creation with production media validation/storage,
  server-derived authorship, and RLS through a bearer endpoint. The Create tab now
  supports a real image post/caption flow while retaining manual catalog contribution.
- Completed English/Korean localization for Create, Add collectible, personal/shared
  photo consent, and Profile editing; Profile now initializes its editor with the
  persisted production display name, tagline, and bio instead of empty values.
- Deepened Room V2 beyond the proof with native one-finger camera orbit and physical
  shelf/desk/rug geometry while retaining the GL scene, tap focus, edit drag, and
  production placement persistence boundary.
- Corrected Room membership semantics beyond the proof: only persisted
  `RoomPlacement`s render in the world. Unplaced Holdings remain in a native stored
  collection tray, can be placed into the Room, moved, persisted, and stored again
  without deleting ownership or personal media.
- Added a native landing-surface model for the rendered floor, desk, and shelf bays.
  New and dragged objects settle to the nearest physical plane and persist its
  `surfaceId` plus the settled transform, preserving the web Room's surface-as-context
  semantics rather than treating the scene as an arbitrary 2D grid.
- Hardened native GL texture loading by downloading each signed personal-media URL to
  an idempotent Expo cache file before handing its local URI to Three.js. This avoids
  relying on native GL loaders to consume expiring remote URLs directly.
- Added native Room inspection focus: selecting a placed collectible outside edit mode
  now smoothly dollies the perspective camera toward the actual world object, tracks it
  as the camera settles, and presents production-backed collectible metadata and trade
  state in a dismissible inspection plate. Tapping empty world space clears focus.
- Replaced floor-default native placement with the existing product home semantics:
  photocards begin at the binder, albums/vinyl/books on shelf bays, posters on the wall,
  figures/lightsticks/plushies in the display case, apparel and kits in the archive,
  and memorabilia on the desk. Placement writes now persist the matching canonical
  zone and native surface IDs, including vertical wall drag behavior.
- Expanded the native Room furniture/surface adapter with visible binder, display-case,
  and archive homes while retaining persisted web coordinate and ownership semantics.
- Added durable native Room style customization with three bounded Seoully presets,
  immediate renderer relighting/recoloring, optimistic rollback, English/Korean labels,
  a bearer-authenticated server boundary, and existing owner-only Room RLS. The preset
  is stored on the Room rather than device-local state.
- Deepened Binder V2 inspection into a physical card interaction. A tapped pocket is
  measured on screen, the real Holding/media face springs from that pocket into focused
  inspection, and the explicit return action eases the card back to its source before
  dismissal. Reduced-motion users retain the interaction with a shorter settle.
- Localized the Binder general/fallback section in English and Korean and added bounded,
  accessible previous/next spread controls alongside native swipe paging.
- Replaced the fixed center-only photocard crop with a native touch crop stage. Camera
  and library photos can now be dragged, pinched up to 3×, adjusted with accessible
  zoom controls, previewed in the actual card ratio, and converted to a bounded source
  crop before personal-media upload. Crop guidance is localized in English/Korean.
- Added a reusable native retry notice and wired real reload actions into Feed,
  Messages, Collection/Wishlist, Room, and Binder. Failed reads no longer leave those
  production-backed screens at an inert error message; retries restore loading state,
  clear stale errors on success, and preserve localized feedback.
- Feed and Messages now refresh from production when their tabs regain focus, so newly
  authored posts and conversations appear without restarting the app.

## Current queue

1. COMPLETE — Expo client foundation and strict TypeScript.
2. COMPLETE — shared API/environment contracts and secure native Supabase sessions.
3. COMPLETE — native navigation/loading shell and persistent English/Korean locale.
4. COMPLETE AT CODE BOUNDARY — auth and durable onboarding; confirmation/deep-link
   behavior remains device QA.
5. COMPLETE AT CODE BOUNDARY — Feed, interactions, Search/Explore, collector profiles,
   follows, authored posts, and private Messages.
6. COMPLETE AT CODE BOUNDARY — collection, personal media, crop, wishlist, trade
   state, catalog contribution, and shared-reference consent.
7. IN PROGRESS — native Room V2 renderer/lifecycle/surfaces and native Binder V2 are
   production-backed, but focus/customization fidelity, native home/zone semantics,
   and physical Binder interactions are still being closed. Physical renderer and
   gesture QA remains mandatory.

## Blocked / device QA

- Native camera, crop gestures, safe areas, haptics, Room gestures/FPS, texture memory,
  and Android behavior require physical-device validation and are not claimed yet.
- Native onboarding layout, keyboard behavior, email-confirmation return, and locale
  restoration are implementation-complete but AWAITING DEVICE QA.
- `20260930000000_native_onboarding_progress.sql` must be applied through the normal
  migration process before the new onboarding endpoint is deployed. It has not been
  applied to production by this migration work.
- `20261001000000_direct_messages.sql` must be reviewed and applied through the normal
  migration process before native Messages can be used. It has not been applied to
  production, and no production messages or conversations were created during testing.
- `20261002000000_native_room_theme.sql` must be reviewed and applied through the normal
  migration process before the theme-aware Room endpoint is deployed. It only adds a
  validated preset column and retains the existing owner-scoped Room RLS; it was not
  applied to production.
- Production `profiles` currently has no durable avatar/media contract; native avatar
  upload was not fabricated against the prototype-only web avatar field. Adding it
  requires an approved storage/schema/privacy design and migration.

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
- Native Search/Explore passes mobile lint and strict TypeScript, all 21 Expo Doctor
  checks, web TypeScript, fixture integrity checks, and `git diff --check`. Responsive,
  keyboard, and touch behavior remain AWAITING DEVICE QA.
- Native Feed interactions pass mobile lint and strict TypeScript, web TypeScript, and
  fixture integrity checks. Media layout, optimistic touch feedback, keyboard behavior,
  and comment composition remain AWAITING DEVICE QA.
- Native Collection/Wishlist passes mobile lint and strict TypeScript plus web strict
  TypeScript. Personal card media sizing, long-list behavior, and touch states remain
  AWAITING DEVICE QA.
- Native Messages passes mobile lint and strict TypeScript plus web strict TypeScript.
  The production migration was not applied; RLS integration, keyboard avoidance,
  thread scrolling, and real-time refresh remain AWAITING DEPLOYED BACKEND / DEVICE QA.
- Native collector profiles and follow mutations pass mobile lint and strict TypeScript,
  web strict TypeScript, and fixture integrity checks. Navigation and optimistic follow
  touch feedback remain AWAITING DEVICE QA.
- The native Room proof passes mobile strict TypeScript, Expo lint, all 21 Expo Doctor
  checks, web strict TypeScript, and a complete Metro iOS production export. GL context
  stability, signed texture appearance, raycast taps, drag feel, FPS, and memory remain
  AWAITING DEVICE QA; simulator-only success is not claimed.
- Native Binder V2 passes mobile strict TypeScript and Expo lint. Responsive pocket
  sizing, page-swipe feel, signed media rendering, and inspection ergonomics remain
  AWAITING DEVICE QA.
- Room camera focus and inspection pass mobile strict TypeScript, Expo lint, and diff
  checks. GL raycast dismissal, focus framing across device sizes, and animation feel
  remain AWAITING DEVICE QA.
- Native home/zone placement and the expanded Room surfaces pass mobile strict
  TypeScript and Expo lint. Surface hit intent and vertical poster dragging remain
  AWAITING DEVICE QA.
- Owner-scoped Room presets pass mobile and web strict TypeScript, Expo lint, and diff
  checks. Visual contrast, GL relighting, and control ergonomics remain AWAITING DEVICE
  QA, and deployed persistence awaits the pending migration.
- Binder lift/return, localized grouping, and spread controls pass mobile strict
  TypeScript and Expo lint. Pocket-origin measurement, spring feel, signed image
  rendering, and reduced-motion behavior remain AWAITING DEVICE QA.
- The touch-adjustable photocard crop passes mobile strict TypeScript and Expo lint.
  Camera orientation metadata, multi-touch feel, small-screen safe areas, and final
  image appearance remain AWAITING DEVICE QA.
- Main-surface retry flows pass mobile strict TypeScript and Expo lint. Offline recovery
  timing and repeated foreground/background transitions remain AWAITING DEVICE QA.
- Native post creation and the localization hardening pass mobile strict TypeScript,
  Expo lint, and web strict TypeScript. Image-picker, multipart upload, permission,
  and keyboard behavior remain AWAITING DEVICE QA.
- `npm audit --omit=dev` currently reports transitive moderate advisories through the
  Expo 57 toolchain/router. Its offered force fixes downgrade Expo/Router across major
  versions, so no unsafe automated downgrade was applied.
- Final cross-platform static validation passes: mobile strict TypeScript, Expo lint,
  Expo public config resolution, all 21 Expo Doctor checks, complete iOS and Android
  Metro production exports, web strict TypeScript, fixture integrity, and
  `git diff --check`.

## Next autonomous task

Continue the ordinary app parity audit with collector/thread retry gaps and navigation
state restoration. Pending database migrations still require review/application in an
approved environment, and physical iOS/Android behavior remains AWAITING DEVICE QA.
