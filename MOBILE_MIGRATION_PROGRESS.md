# Seoully Native Mobile Migration Progress

## Objective

Move Seoully toward a genuine Expo/React Native mobile application while preserving
the existing Next.js reference client, Supabase backend, catalog, ownership semantics,
security, and Room/Binder data model.

## State

- Branch: `mobile-native`
- Immutable reference checkpoint: `76be07a928ce3e9436031d7324a5cc2b1b0375ed`
- Recovered from: `d2d779d`
- Current task: Room representation, edit/camera, Binder open/close and Room jump
- Overall status: IN PROGRESS — Room/Binder product behavior still closing; device QA still pending

## Current Room parity matrix

Compared live `src/world` Room (zones, objects, `useRoomEdit`, camera) against
`apps/mobile/app/room.tsx` + `NativeRoomRenderer` + `room/model.ts`.

| Behavior | Status |
| --- | --- |
| **WORLD** | |
| Room geometry (walls/floor/shell) | PARTIAL — native box room, not web CSS-3D stage |
| Zones (shelf/desk/wall/case/archive/binder) | PARTIAL — surfaces and homes exist; no web zone chrome |
| Surfaces | IMPLEMENTED — native surfaces settle placements |
| Furniture / display areas | PARTIAL — shelf, desk, case, archive, standing binder |
| Themes (hearth/blossom/midnight) | PARTIAL — client presets; SQL persistence HUMAN REVIEW REQUIRED |
| Lighting / material intent | PARTIAL — theme lights; no foil/holographic materials |
| Customization | PARTIAL — theme chips; furniture layout not user-editable |
| **CAMERA** | |
| Home pose | IMPLEMENTED — Home chip resets yaw/pitch/look |
| Focus poses | IMPLEMENTED — dolly to selected Holding; wall-aware |
| Transitions | AWAITING DEVICE QA — lerp exists; feel needs a phone |
| Navigation between areas | IMPLEMENTED — Home/Shelf/Wall/Desk/Case/Binder looks |
| Return / home behavior | IMPLEMENTED |
| **COLLECTIBLES** | |
| Real Holdings | IMPLEMENTED |
| Personal media textures | IMPLEMENTED — budgeted signed cache; face is the photo |
| DigitalRepresentation | IMPLEMENTED — native kind-specific geometry + personal-media source |
| Representation by collectible kind | IMPLEMENTED — card/poster/album/vinyl/book/lightstick/plush/figure/apparel/ticket/disc-case/generic |
| Generic fallback | IMPLEMENTED |
| Inspection | PARTIAL — lift + detail chrome; no web hover/foil |
| Focus | IMPLEMENTED — camera + object lift; wall posters tilt |
| **EDITING** | |
| Enter / exit edit mode | IMPLEMENTED |
| Select | IMPLEMENTED |
| Move | IMPLEMENTED — drag; wall uses vertical axis |
| Rotate / scale | IMPLEMENTED — persist existing transform contract |
| Placement constraints | IMPLEMENTED — snap to nearest surface |
| Surface / zone semantics | IMPLEMENTED — `homeForKind` + `zoneIdForNativeSurface` |
| Store | IMPLEMENTED — removes RoomPlacement only |
| Restore | IMPLEMENTED — stored tray places back onto kind home |
| Persistence | IMPLEMENTED — RoomPlacement save on place/move/rotate/scale |
| Cancel / commit | IMPLEMENTED — Cancel restores baseline and rewrites placements; Done keeps saved work |
| Invalid-placement handling | IMPLEMENTED — revert + localized error |
| **STATE** | |
| RoomPlacement | IMPLEMENTED |
| Production IDs | IMPLEMENTED |
| Relaunch restoration | PARTIAL — placements from server; camera and focused Holding from AsyncStorage |
| Room customization persistence | PARTIAL — theme write exists; migration not applied |
| Holding ownership independent from placement | IMPLEMENTED |
| **ENTRY/EXIT** | |
| Profile → Enter Room | IMPLEMENTED |
| Room tab | IMPLEMENTED |
| Room → Binder | IMPLEMENTED — header + in-world binder object |
| Room → app navigation | IMPLEMENTED |
| State preservation | PARTIAL — camera/placements persist; in-flight edit is local |

## Current Binder parity matrix

Compared live `OpenBinder` / `binderGeometry.ts` / `BinderZone` against
`apps/mobile/app/binder.tsx` + `binder/model.ts`.

| Behavior | Status |
| --- | --- |
| Production Holdings | IMPLEMENTED |
| Photocard filtering | IMPLEMENTED |
| Grouping | PARTIAL — release/group pages; not catalog CollectibleSet progress (no production set table) |
| Member / set / section organization | PARTIAL — member-sorted pockets plus section chips; no catalog set slots |
| Pocket indexing | IMPLEMENTED — 3×2, empty pockets retained |
| Pages | IMPLEMENTED |
| Spreads | IMPLEMENTED — left/right pair |
| Left/right physical page relationship | PARTIAL — tilted pages + spine; not web CSS-3D turn |
| Odd-page blank partner | IMPLEMENTED |
| Fallback / Your Photocards section | IMPLEMENTED |
| User-created catalog templates | PARTIAL — owned leftovers stay in fallback pages |
| Personal media textures | IMPLEMENTED — personal image is the card face |
| Missing-image isolation | IMPLEMENTED — failed/missing image keeps pocket geometry |
| Page navigation | IMPLEMENTED — swipe + previous/next |
| Section jump | IMPLEMENTED |
| Card selection | IMPLEMENTED |
| Card lift | IMPLEMENTED — spring from pocket origin |
| Card inspection | IMPLEMENTED — chrome below the card, not on the face |
| Card return | IMPLEMENTED |
| Binder open / close | PARTIAL — cover opens/closes before Room return; not in-world 3D fly-in |
| Room → Binder transition | PARTIAL — in-world tap and selected photocard opens that spread; cover staging exists; not camera fly-in |
| State restoration | IMPLEMENTED — spread index persisted; Room focus restores |
| Empty states | IMPLEMENTED — empty physical binder + copy |

Do not treat Room or Binder as finished. Visual/tactile/FPS/gesture quality remains AWAITING DEVICE QA.

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
- Extended recoverable reads to Search/Explore, collector profiles, and message threads.
  Profile editing now has explicit loading, unavailable, retry, save-busy, and sign-out
  failure states instead of silently rendering an empty editor when identity loading
  fails.
- Added a production-backed native Holding detail destination from Collection. It
  preserves personal media as the primary card face, shows localized acquisition and
  catalog metadata, supports trade-status changes, retries failed reads, and links into
  the native Room and Binder without changing ownership or placement.
- Completed cursor propagation through the bearer-authenticated mobile Feed endpoint
  and added native end-of-list pagination with deduplication, bounded loading feedback,
  and retryable failures. Feed is no longer permanently limited to its first page.
- Added native pull-to-refresh to Feed, conversation list, and message threads. An open
  thread now performs a bounded foreground-only refresh every ten seconds, avoids
  overlapping requests, and still supports explicit user refresh without introducing
  an unreviewed realtime or notification architecture.
- Added Expo-compatible local draft persistence for post captions and manual catalog
  contribution fields. Bounded drafts restore after process restart, save with a short
  debounce, clearly disclose device-local storage, and clear after successful creation;
  temporary picker URIs are intentionally not persisted as if they were durable media.
- Wired production Feed author/comment identities into collector profiles, added retry
  for failed comment reads, and validated manual catalog contribution before the server
  boundary. Collection now refreshes when it regains focus so newly created Holdings
  appear without restarting the app.
- Added bearer-authenticated collector search through the existing production profile
  lookup contract. Explore now returns both collectors and catalog items for a query,
  with localized empty states and existing follow/message destinations.
- Create now supports camera or library post photos and a localized kind picker for
  catalog contributions, persisting the selected kind in the local draft. Binder now
  refreshes Holdings when it regains focus so newly added photocards appear in pockets.
- Room inspection camera now frames wall-mounted objects more closely instead of using
  the same floor dolly offset, and collectible kinds are localized across Collection,
  Search, Room inspection, and Holding detail.
- Restored Collection tab and Explore query locally so returning to those screens
  preserves the last wishlist/collection view and the last catalog/collector search.
- Room inspection and Binder card inspection now open the production Holding detail
  screen, so trade state and personal media remain one destination rather than
  isolated overlays.
- Completed cursor propagation for post comments and added native load-more for
  comment threads, matching the production comment page contract instead of the first
  25 comments only.
- Holdings reads now honor offset/limit. Collection can page beyond the first 100
  items, while Binder, Holding detail, and the Room stored tray load subsequent
  pages so later photocards are not silently omitted.
- Wishlist reads now honor the same offset/limit contract so large wishlists can be
  paged in Collection instead of stopping at the first 100 saved catalog items.
- Binder now restores the last viewed spread locally and scrolls back to that page after
  Holdings reload, so page position survives leaving and returning to Binder.
- Feed and Messages now refresh from production when their tabs regain focus, so newly
  authored posts and conversations appear without restarting the app.
- Native Room no longer silently drops or refuses placements after 24 objects. Every
  persisted RoomPlacement renders; new homes use zone slot offsets so photocards,
  albums, posters, display objects, archive, and desk items no longer stack on one
  point. GL personal-media textures stay budgeted to the nearest/focused 24 objects.
- Signed personal media now uses one Expo local-file cache shared by Room, Binder,
  Collection, collectible detail, and the Room stored tray. Tray chips show cached
  card faces. Room camera yaw restores locally, and Room refreshes on focus unless
  an edit gesture is in progress.
- Collectible detail now reads one owner-scoped Holding by id through the existing
  bearer holdings boundary instead of paging the entire collection to find a card.
- Collection and Wishlist now virtualize rows and page at the end of the list instead
  of mounting every card in one ScrollView.
- Binder photocards without a release now open a group section when group identity
  exists, and only leftover cards fall into the general/fallback organization.
- Native Room look-around now includes vertical pitch as well as yaw, persists both
  locally, and still dollies to a focused object. Adding a collectible now opens that
  Holding detail instead of dropping the collector on Profile.
- Profile identity/editor state now refreshes when the tab regains focus.
- Auth, Feed comments, Search, Create, and Profile now sit in a shared native
  keyboard-avoiding shell. Binder spreads tilt left/right pages around the spine
  so a full spread reads as a physical book rather than two flat cards.
- Search/Explore now hydrates production wishlist IDs on focus so already-saved
  catalog items show as saved instead of inviting a duplicate save.
- Collector profiles now load authored posts through a bearer
  `GET /api/mobile/collectors/[userId]/posts` boundary reusing
  `getProductionProfilePosts`, surface `roomAvailable` without opening a public
  Room client, and paginate that post list.
- Profile now has the English/Korean locale toggle. Stack screens (Collection,
  Room, Binder, collector, thread, collectible) have an explicit back control.
- Collectible detail can add or replace personal media later, including the
  photocard crop stage. Email-confirmation deep links with an auth `code` are
  exchanged in the root layout; confirmation return remains AWAITING DEVICE QA.
- Room is now a first-class tab, not only a Profile destination. Edit mode can rotate
  and scale a selected Holding and persist the existing transform contract. The stored
  tray is grouped by collectible kind, and Room opens Binder directly.
- Binder can jump to the first spread of each group/release section.
- Completed collectors can re-edit groups, bias, and interests from Profile without
  resetting onboarding_step; the onboarding endpoint accepts those patches when the
  profile is already done.
- Collection can filter Holdings by kind. Collector profile posts support the same
  optimistic like/unlike path as Feed.
- Native Room collectibles now use kind-specific world representations (thin
  photocard/poster/ticket, spine-out album/book/jewel case, vinyl sleeve+disc,
  lightstick, plush, figure standee, folded apparel, generic fallback) with
  personal media as the object face when present.
- Room camera has an explicit Home pose plus Shelf/Wall/Desk/Case/Binder looks.
  The desk binder is a tappable object that opens Binder.
- Room edit can cancel back to the pre-edit placements, rejects placements that
  are not near a surface, and still stores/restores Holdings without deleting
  ownership.
- Binder close returns to Room, empty collections still render a physical
  spread with pockets, and a failed personal image no longer paints text over
  the card face or collapses the pocket.
- Opening Binder from a focused Room photocard jumps to that card's spread.
  Binder pockets sort by member inside a section. Room restores the last
  focused Holding after relaunch.

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
- Collector/thread/Search/Profile hardening passes mobile strict TypeScript and Expo
  lint. Keyboard, focus return, and retry behavior after process suspension remain
  AWAITING DEVICE QA.
- Native collectible detail passes mobile strict TypeScript and Expo lint. Personal
  media sizing, long descriptors, and locale-specific date rendering remain AWAITING
  DEVICE QA.
- Paginated Feed passes mobile and web strict TypeScript plus Expo lint. End-of-list
  thresholds, long-session memory, and repeated rapid scroll behavior remain AWAITING
  DEVICE QA.
- Social refresh and thread polling pass mobile strict TypeScript and Expo lint.
  Keyboard/scroll anchoring, background suspension, and network/battery behavior remain
  AWAITING DEVICE QA.
- Create draft restoration passes mobile strict TypeScript, Expo lint, and all 21 Expo
  Doctor checks with the SDK-compatible AsyncStorage package. Process-kill restoration,
  OS storage eviction, and keyboard behavior remain AWAITING DEVICE QA.
- Feed collector navigation, comment retry, Collection focus refresh, and Create
  validation pass mobile strict TypeScript and Expo lint. Author-tap feedback and
  Collection refresh timing remain AWAITING DEVICE QA.
- Collector search passes mobile and web strict TypeScript plus Expo lint. Keyboard
  search, result ranking, and privacy-sensitive handle matching remain AWAITING DEVICE
  QA / DEPLOYED BACKEND.
- Create kind/camera and Binder focus refresh pass mobile TypeScript and Expo lint.
  Camera permission sheets and kind-chip wrapping remain AWAITING DEVICE QA.
- Wall-aware Room focus and localized collectible kinds pass mobile TypeScript. Focus
  framing across device sizes remains AWAITING DEVICE QA.
- Collection/Explore restoration passes mobile TypeScript and Expo lint. Process-kill
  restore and keyboard-return search remain AWAITING DEVICE QA.
- Room/Binder-to-detail navigation passes mobile TypeScript and Expo lint. Overlay
  dismissal versus stack navigation remain AWAITING DEVICE QA.
- Paginated comments pass mobile and web TypeScript plus Expo lint. Long-thread
  scrolling and keyboard collision remain AWAITING DEVICE QA.
- Holdings pagination passes mobile and web TypeScript plus Expo lint. Large-collection
  memory and Room tray length remain AWAITING DEVICE QA.
- Wishlist pagination passes mobile and web TypeScript plus Expo lint. Long wishlist
  lists remain AWAITING DEVICE QA.
- Binder spread restoration passes mobile TypeScript and Expo lint. Scroll-to-index
  after Holdings reload remains AWAITING DEVICE QA.
- Room slot homes, uncapped placement rendering, texture budget, shared signed-media
  cache, stored-tray faces, and camera-yaw restore pass mobile TypeScript, Expo lint,
  web TypeScript, and diff check. Large-room FPS/texture memory, slot spacing, tray
  scrolling, and yaw restore after process death remain AWAITING DEVICE QA.
- Holding-by-id detail reads pass mobile and web TypeScript plus Expo lint. Deep-link
  and missing-id empty states remain AWAITING DEVICE QA.
- Collection list virtualization and Binder group-section fallback pass mobile
  TypeScript and Expo lint. Long-list memory and section page-turn feel remain
  AWAITING DEVICE QA.
- Room pitch/yaw look-around, add-collectible Holding destination, and Profile focus
  refresh pass mobile and web TypeScript plus Expo lint. Vertical orbit feel and
  post-create navigation remain AWAITING DEVICE QA.
- Keyboard-avoiding compose surfaces and Binder page tilt pass mobile TypeScript and
  Expo lint. Keyboard overlap, Android window insets, and page-turn perspective remain
  AWAITING DEVICE QA.
- Wishlist hydration, collector posts, locale toggle, stack back controls, late Holding
  photos, and the auth-code deep-link handler pass mobile and web TypeScript plus Expo
  lint. Confirmation-email return, late-media crop, and collector post media layout
  remain AWAITING DEVICE QA.
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
- Room tab, rotate/scale persistence, grouped stored tray, Binder section jump, and
  collector-taste re-edit pass mobile and web TypeScript plus Expo lint. Tab switching
  with an open Room GL context and taste-edit keyboard remain AWAITING DEVICE QA.
- Collection kind filters and collector-post likes pass mobile TypeScript and Expo lint.
- Room representation-by-kind, zone looks, edit cancel/invalid placement, and
  Binder close/empty/image isolation pass mobile and web TypeScript, Expo lint,
  Expo Doctor 21/21, fixture checks, and `git diff --check`. GL appearance,
  binder-object hit testing, and gesture feel remain AWAITING DEVICE QA.

## Next autonomous task

Room/Binder non-device owner loop is largely in place. Remaining work is
classified below. Do not treat Room/Binder visual/tactile parity as finished.

### IMPLEMENTATION REMAINING
- Public Room viewing for other collectors (no native client yet)
- Catalog-set empty-pocket layout if production ever exposes CollectibleSet
  progress (no `collectible_sets` table exists today)
- In-world 3D Binder open that stays inside the Room GL scene

### AWAITING DEVICE QA
- Room GL FPS, texture memory, raycast hits, drag/orbit feel, inspect lift
- Binder swipe, cover open/close, card lift springs, page perspective
- Camera, crop, keyboard, safe areas, Android

### HUMAN REVIEW REQUIRED
- `20260930000000_native_onboarding_progress.sql`
- `20261001000000_direct_messages.sql`
- `20261002000000_native_room_theme.sql`
- Durable profiles avatar/media contract
- Notices beyond fixture-only content

### ENVIRONMENT BLOCKED
- Known unrelated Turbopack process-binding issue (do not re-investigate)
- Expo toolchain moderate advisories that require unsafe major downgrades
