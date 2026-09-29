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
- Status: **PHYSICALLY APPROVED** — this is the native visual calibration baseline for later surfaces
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

## Physical iPhone — Vertical Expansion 02 (Living Social World)

- Date: 2026-09-27
- Branch: `mobile-native`
- Scope: development-only demo/fixture world + reconstructed Feed, Search/Explore, Collector Profile, post/social interactions
- Calibration: Vertical Slice 01 (physically approved)
- Status: **CODE COMPLETE — AWAITING PHYSICAL DEVICE VISUAL APPROVAL**
- Do not approve from TypeScript, Expo Doctor, or Metro export.

### Demo mode (development only)

- Header chip **Demo** (lilac) vs **Live**
- Default in Expo Go / `__DEV__`: Demo **on** unless SecureStore `seoully.mobile.demo-world.v1` is `"0"`
- Switch to Live: tap **Demo** in the header until it reads **Live**
- Switch back to Demo: tap **Live** until it reads **Demo**
- Demo mutations (like, comment, repost, follow, wishlist) persist until Metro reload
- Production collection/profile writes are blocked while Demo is on. Sign out is real auth.

### Exact iPhone test sequence — Expansion 02 (historical)

The following sequence was the Expansion 02 ask. Item 9 is **superseded** by the calibration pass (Profile actions are now shown in Demo).

1. Cold launch Expo Go on `mobile-native`. Confirm the header chip reads **Demo**.
2. Open **Feed**. Confirm Discover shows Minji’s inhabited posts with avatars, media, captions, likes, comments, repost, share.
3. Like a post. Confirm the heart and count change. Open comments, add one, confirm it appears.
4. Tap Minji’s identity. Confirm Collector Profile answers *who is this collector?*
5. Confirm **Enter Room** is the spatial CTA and does **not** open a production Room for Minji.
6. Open **Search**. Confirm destinations feel like discovering Seoully.
7. Save a collectible to wishlist in Search. Confirm it does not hit production.
8. On Feed, switch **Following**. It should be empty until you followed Minji.
9. Open **Profile**. Confirm you are SOOMIN. Confirm Edit / Add / Sign out / Enter Room are present.
10. Tap **Demo** → **Live**. Confirm production data, not fixtures.

## Physical iPhone — Calibration correction + system integrity

- Date: 2026-09-28
- Branch: `mobile-native`
- Parent: Expansion 02 HEAD `bdde759`
- Status: **CODE COMPLETE — AWAITING PHYSICAL DEVICE VISUAL APPROVAL**
- Ignore the blue Expo Go floating gear. It is not Seoully.

### Exact iPhone test sequence

1. Cold launch Expo Go. Confirm Demo. Confirm the Seoully wordmark is fully visible below the Dynamic Island / status bar, not clipped.
2. Confirm the bottom nav: home/search/plus/chat/profile shapes match web; Create is the smaller raised lilac plus; active tab is a soft lilac square, not a generic fill.
3. Open **Feed** Discover. Confirm suggested collectors are cream cards with a `% match` pill, then Following / Discover **underline** tabs, then posts.
4. On a post: handle is the name (not display name), date is to the right, media is 4:3 rounded, then like / comment / repost / share. Concert fixture shows a play overlay. Caption is `handle  body`. If comments exist, **View comments** appears.
5. Like, comment, repost (flash), share (system share sheet). Confirm Demo does not write production.
6. Switch Following. Empty until Minji is followed from her profile.
7. Open **Profile**. Confirm a darker room-synced field behind identity (Soomin), collection cream cards with object colorways, and the four actions: Edit Profile, Add to collection, Sign out, Enter Room.
8. Tap Edit Profile. Confirm Soomin’s identity. Save must explain Demo cannot write Live. Sign out still signs out of the real session.
9. Tap Add to collection, attempt a write, confirm the Demo intercept. Tap Enter Room, confirm it does **not** open a production Room.
10. Switch **Live**. Confirm Feed suggested people (if the session has discovery candidates) come from production discovery, not Minji. Confirm own Profile actions hit production paths. Confirm collector profiles do **not** invent a compatibility score.

Reject if the shell/feed/profile still read as a generic React Native app, if Demo hides product actions, or if Live shows fixture collectors.

## Physical iPhone — Profile + collection graph correction

- Date: 2026-09-28
- Branch: `mobile-native`
- Parent: Expansion 02 HEAD `bdde759` plus uncommitted calibration work (do not reset)
- Status: **CODE COMPLETE — AWAITING PHYSICAL DEVICE VISUAL APPROVAL**
- Ignore the blue Expo Go floating gear. It is not Seoully.
- Do not approve from TypeScript, Expo Doctor, or Metro export.

### Exact iPhone QA sequence

1. Cold launch Expo Go on `mobile-native`. Confirm **Demo**.
2. Open **Profile** (SOOMIN). Confirm there are **no** floating fake collectible rectangles behind identity. Background should be a quiet themed mist, not a pretend Room.
3. Confirm identity text, avatar, and buttons are fully readable (not faded). The surface may feel slightly translucent; children must not be at 85% opacity.
4. Confirm the three actions **Edit Profile**, **Add to collection**, **Sign out** are visually centered, same height, no ugly cramped type. **Enter Room** is the full-width spatial CTA below them.
5. Expand **Posts**. Confirm they are full Seoully posts (avatar, handle, date, media, like/comment/repost/share, caption, View comments) — not tiny summary rows.
6. Expand **Owned**. Confirm real fixture objects. Toggle **Open to trade** / **Not for trade** on one item and confirm the label changes. Tap **Remove** on a copy you can restore by reloading Metro. Confirm this does not hit production.
7. Expand **Wishlist**. Confirm Soomin’s wants. Remove one locally. Reload Metro to restore fixtures if needed.
8. From Feed or Search, open **Minji**. Confirm **65% match** and shared reasons from the canonical domain engine.
9. Expand **Potential trade match**. Confirm **You want** (5) and **They want** (4) are real collectibles, not invented names. Confirm open-to-trade labels where Minji’s chase card is open.
10. Tap **Message about trade**. Confirm an honest blocked notice. Do not expect a production DM thread.
11. Switch header **Demo → Live**. Open a real collector. Confirm there is **no invented 65%**. If a match appears, it came from the production pair route. If it does not, that is the honest state.
12. Live own Profile: confirm Owned trade toggle hits production (session required). Confirm posts still use the full post presentation.

Reject if fake Room objects remain, if own posts are still summary rows, if Minji lacks You want / They want, or if Live invents fixture compatibility.

## Physical iPhone — Global companion + communication shell

- Date: 2026-09-28
- Branch: `mobile-native`
- Parent: Expansion 02 HEAD `bdde759` plus uncommitted calibration and Profile/collection-graph work (do not reset)
- Status: **CODE COMPLETE — AWAITING PHYSICAL DEVICE VISUAL APPROVAL**
- Ignore the blue Expo Go floating gear. It is not Seoully.
- Do not approve from TypeScript, Expo Doctor, or Metro export.
- Do not apply `20261001000000_direct_messages.sql` or `20261002000000_native_room_theme.sql`.

### Exact iPhone QA sequence

1. Cold launch Expo Go on `mobile-native`. Confirm **Demo**.
2. Confirm the **Seoully** wordmark and adjacent heart share a visual centerline on Feed. The heart must not sit visibly lower than the text. Confirm top safe-area spacing and no clipping.
3. Confirm the same wordmark treatment on Search, Create, Messages, Profile, and nested screens that use the global header.
4. Confirm the Seoully heart companion sits near the bottom-right, above the tab bar and home indicator. It should bounce quietly unless Reduce Motion is on.
5. Tap the companion. Confirm **Ask Seoully** opens. Ask “What’s on my wishlist?” Confirm a real fixture answer and cards, not a decorative empty heart.
6. Confirm the companion survives tab changes (Feed → Search → Profile).
7. Confirm the notification bell is in the header. Confirm a real Demo unread badge. Open the list. Confirm Minji like/comment/follow/trade/activity notices. Tap a row and land on Minji’s collector profile.
8. On a Feed post: Like changes the heart and count. Comment create/read/count works. Repost flashes local Demo state.
9. Tap **Share**. Confirm Seoully **Send to** opens (post preview + “Search who to send to…”). It must not jump straight to the iOS share sheet.
10. Search **Minji**, select her, confirm Demo reports a local send. Confirm this does not write production.
11. Switch **Demo → Live**. Confirm the companion still opens Ask Seoully against production tools (session required). Confirm the bell has **no fake production notices**. Confirm Share still opens Send to, and sending stops with an honest messaging-unavailable notice. Confirm Like/Comment still hit production. Confirm Repost does not claim a production save.

Reject if the heart is decorative-only, if Share opens the system sheet first, if Live claims a message was sent, or if Live invents notification rows.
