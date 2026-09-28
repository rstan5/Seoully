# Native Device QA

These checks require a physical iPhone and Android device. They are intentionally not
claimed by static TypeScript or Expo validation.

## Physical iPhone — Room startup crash (Expo Go)

- Date: 2026-09-27
- Branch: `mobile-native`
- Checkpoint before the crash: `ae8e155`
- Device: physical iPhone through Expo Go
- Reproduction: Metro bundled `expo-router/entry.js`, then the app died on launch with
  `TypeError: undefined is not a function` attributed to
  `NativeRoomRenderer.tsx:3` (`import … from "@react-three/fiber/native"`).
  Expo Router also warned that `room.tsx`, `(tabs)/room.tsx`, and
  `collector-room.tsx` were missing a default export.

### Root cause

The crash happens while **evaluating** `@react-three/fiber@9.8.1` native, not because
the import path is the web build.

Installed native entry (`native/dist/react-three-fiber-native.{esm,cjs.*.js}`) runs
`polyfills()` at module load when `Platform.OS !== "web"`. That function does:

```js
THREE.LoaderUtils.extractUrlBase.bind(THREE.LoaderUtils)
```

`undefined is not a function` is `.bind` being called on a missing
`extractUrlBase`. `three@0.186.1` still implements the method on the real
`LoaderUtils` class in `three.core.js`, but Metro’s `require("three")` interop
through the deprecated 631-byte `three.cjs` shim can leave the static missing on
the namespace R3F actually sees. That matches the stack (import-time, not first
frame).

The Expo Router “missing default export” warnings are **cascading**: those route
modules import the renderer at the top level, so they throw before
`export default` is reached. The route exports themselves were already correct.

`expo-gl` is part of Expo Go for SDK 57. This crash is a JS evaluation bug, not
a missing Expo Go native module. A development build is **not** required to
retest this specific failure.

### Resolution

- Guard the R3F native polyfill (patch-package on `@react-three/fiber@9.8.1`).
- Restore `LoaderUtils.extractUrlBase` before the R3F import.
- Resolve `three` to `three.module.js` in Metro so the CJS shim is not used.
- Lazy-load the Room renderer from route files so Expo Router can evaluate
  Room routes without importing R3F during app startup.

### Still requiring device verification

- [ ] iOS Expo Go launches to the tab shell without the import-time TypeError
- [ ] Room tab mounts the GL canvas and shows the world
- [ ] Feed / Search / Profile still open if Room is not visited
- [ ] SafeAreaView deprecation is unrelated and still pending layout QA

## Physical iPhone — Feed visual reconstruction

- Date: 2026-09-27
- Branch: `mobile-native`
- Scope: native design-system tokens/primitives + Feed + tab bar only
- Web references: `src/design/social-app.css`, `CollectorFeed`, `ProductionFeed`,
  `ProductionPostCard`, `SocialShell`, `SocialNav`, `SocialIcons`, `BrandMark`
- Production data path unchanged: `GET /api/mobile/feed` with bearer session

### FEED VISUAL RECONSTRUCTION: AWAITING PHYSICAL DEVICE VISUAL APPROVAL — CORRECTION PASS 01

First physical review was **not approved**. Correction pass 01 is implemented
and must be re-reviewed on the iPhone. Do not mark this approved from
TypeScript, Expo Doctor, or Metro export.

Check on the physical iPhone:

- [ ] Feed looks like Seoully (cream paper, brand mark, post hierarchy) — not a prototype list
- [ ] Empty Feed is a finished product state, not a giant heading over leftover copy
- [ ] Posts show collector identity, media prominence, like/comment, caption
- [ ] Tab bar uses Seoully icons and active treatment; Create is the raised plus
- [ ] Safe area, scroll, pull-to-refresh, like, comment, collector tap still work
- [ ] Search / Room / Create / Messages / Profile *contents* were not restyled this pass

## Physical iPhone — Search / Explore + identity profiles

- Date: 2026-09-27
- Branch: `mobile-native`
- Scope: Search destination IA, own Profile identity card, public collector profile
- Web references: `CollectorSearch`, `CollectorProfile`, `social-app.css` `.s-search` / `.s-explore` / `.s-profile`

### SEARCH / EXPLORE: AWAITING PHYSICAL DEVICE VISUAL APPROVAL
- [ ] Home shows Search / Explore, lede, field, and five destination cards
- [ ] People / Rooms / Collectibles / Groups return real production results
- [ ] Rooms Enter Room opens the established collector Room path
- [ ] Posts destination stays empty until a production post-search exists
- [ ] Keyboard, clear, back-to-destinations, and locale still work

### PROFILE / COLLECTOR: AWAITING PHYSICAL DEVICE VISUAL APPROVAL
- [ ] Own Profile looks like identity, not a settings form
- [ ] Counts, chips, Enter Room, posts/owned/wishlist shelves are readable
- [ ] Public collector Follow / Message / Enter Room still work
- [ ] Edit Profile remains a separate screen and still saves

## Physical iPhone — Collection / Create / Messages

- Date: 2026-09-27
- Branch: `mobile-native`
- Scope: Collection shelves, collectible detail, Create/Add, Messages/thread

### COLLECTION / CREATE / MESSAGES: AWAITING PHYSICAL DEVICE VISUAL APPROVAL
- [ ] Owned/wishlist read as Seoully shelves, not giant shop cards
- [ ] Collectible detail shows personal photocard media as the card face
- [ ] Create photo/caption and Add crop still complete
- [ ] Messages rows and thread composer avoid keyboard overlap

## Physical iPhone — Auth / onboarding

- Date: 2026-09-27
- Branch: `mobile-native`

### AUTH / ONBOARDING: AWAITING PHYSICAL DEVICE VISUAL APPROVAL
- [ ] Sign-in shows BrandMark, not a giant text wordmark
- [ ] Onboarding chips and continue/skip still save production tastes
- [ ] Email confirmation still returns into the app

## Physical iPhone — Vertical Slice 01 (Collector Ownership)

- Date: 2026-09-27
- Branch: `mobile-native`
- Scope: typography (Baloo 2 / Noto Sans KR), rebuilt Profile, Edit Profile, Add Collectible
- Status: **CODE COMPLETE — AWAITING PHYSICAL DEVICE VISUAL APPROVAL**
- Do not approve from TypeScript, Expo Doctor, or Metro export.

### Exact iPhone test sequence

1. Cold launch Expo Go on `mobile-native`. Confirm session restores or sign in.
2. Open **Profile**. Confirm it reads as *who is this collector?* — avatar, name, handle, counts, bio, groups/biases, collection/wishlist/posts.
3. Confirm **Enter Room** is the main spatial CTA. **Edit Profile** is a secondary text link. Sign out is not on Profile.
4. Tap **Add to collection**. Confirm the fork: **Search Seoully's Catalog** or **Add Manually**.
5. Catalog path: search a known group/member, pick a result, photograph or choose a library image.
6. If the item is a photocard: crop/pan/zoom, then **Use this crop**.
7. Tap **Add to collection**. Confirm you land on the collectible and the Holding id is stable.
8. Back to **Profile**. Confirm the new item appears in Owned / collected count after refresh.
9. Open **Collection**. Confirm the same Holding is there with personal media if you added a photo.
10. Manual path: Add Manually → name + group + type → photo → Add to collection. Confirm it appears the same way.
11. Open **Edit Profile**. Change display name or bio. Save. Confirm Profile shows the change. Sign out from Edit, then restore session.
12. Photocard: open **Binder**. Confirm the new card is eligible (in a pocket if `kind === photocard`). GL feel is separate.
13. Any new Holding: open **Room**. Confirm it is eligible in the stored tray until placed. Do not expect finished Room/Binder visuals this slice.
14. Reject if Profile/Edit/Add still feel like generic React Native forms, or if type still looks like system San Francisco.

### PROFILE: AWAITING PHYSICAL DEVICE VISUAL APPROVAL
- [ ] Baloo 2 (EN) / Noto Sans KR (KO) is visibly loaded — not system UI type
- [ ] Identity hierarchy matches Seoully: 86px avatar ring, name, @handle, counts
- [ ] Enter Room is important; Edit is secondary; no settings-row of equal pills
- [ ] Owned / wishlist / posts refresh after adding a collectible

### EDIT PROFILE: AWAITING PHYSICAL DEVICE VISUAL APPROVAL
- [ ] Cancel | Edit Profile | Save chrome
- [ ] Labeled fields, not a stack of giant bordered placeholders
- [ ] Production save of display name / tagline / bio / location
- [ ] Avatar upload is *not* claimed (production media path is not ready)
- [ ] Sign out lives here

### ADD COLLECTIBLE: AWAITING PHYSICAL DEVICE VISUAL APPROVAL
- [ ] Search Catalog vs Add Manually is immediately understandable
- [ ] Catalog search hits production `/api/catalog/search`
- [ ] Manual contribute hits production catalog contribution
- [ ] Photo/crop feels like “this is my copy”
- [ ] Add to collection creates a Holding that Profile and Collection then show
- [ ] Photocards become Binder-eligible; all new holdings become Room stored-tray eligible

## Remaining physical checks

- [ ] iOS launch and safe-area layout
- [ ] Android launch and insets/back gesture
- [ ] Supabase session restoration and logout
- [ ] camera permission, capture, orientation, and retry
- [ ] photo-library permission and selection
- [ ] photocard crop pan/zoom and memory behavior
- [ ] keyboard avoidance on auth/forms
- [ ] Feed/search/profile scrolling and native navigation gestures
- [ ] Room renderer proof FPS, texture memory, gestures, and thermal behavior
- [ ] Binder lift/return gestures and personal image textures
