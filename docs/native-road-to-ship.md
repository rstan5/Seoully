# Native road to ship

**Status:** Slice 1 implemented in tree — **CODE VERIFIED / DEVICE QA PENDING**. Slices 2–8 not started.  
**Canonical spec:** `docs/web-native-parity-contract.md`  
**Connectivity evidence:** `docs/native-backend-connectivity-audit.md`  
**Tree:** `mobile-native` `bdde759` + dirty working tree.  
**Date:** 2026-09-29

Done is a complete user-experience slice (web behavior + native UI + backend + persistence + read-back + navigation + loading/error/empty + `mobile:verify` + device QA). Not a layer of APIs or a coat of tokens.

---

## A. Current reality

**Do not use percentages.**

### What exists

- Expo Router tabs matching web’s five peers; Room is **not** a visible tab.
- Bearer `/api/mobile/*` to real RLS-backed tables for session, onboarding step, own holdings/wishlist, media, catalog contribute/reference, following feed, likes, comments, image posts, follow, people search, catalog search, discovery collectors/rooms, public room RPC, pair match, Ask assistant.
- Native collect flow that **creates a Holding immediately** (hard rule).
- Own Profile can list own holdings/wishlist and toggle trade/remove.
- Token map from `social-app.css` (colors, type, 52/58/48/42 metrics).
- Demo `__DEV__` world with fixture feed Discover, notices, reposts, Send to, Ask, full collector shelves.
- A Three.js Room renderer and a 2D Binder built from holdings.
- Companion + notices + Send-to **shells**.

### What does not exist

- The web product structure: **Room always mounted under social**; Profile as identity over that Room.
- Web onboarding after tastes: avatar, first collectible, room reveal, meet collectors.
- Production notifications.
- Production messages with post share, trade templates, unread (pending SQL is body-only and unapplied).
- Production Discover feed query (also absent on **production web**).
- Public collector owned/wishlist **rows** (count without rows).
- Avatars in production.
- Web binder-as-object, zone docking, doorway, card flight, undo/redo.
- Own Room GET against current production schema (`theme_id` selected, column unapplied).
- Ask card navigation that preserves search query; Ask context beyond `{ surface: "home" }`.
- Honest Demo isolation (`collection`/`binder`/`room`/`messages` still call Live APIs).
- Passing `npm run mobile:verify` (Expo Doctor patch skew).
- Physical-device proof of any Live journey.

### What web itself does not persist (so native must not fake it as “already done”)

Messages, notices, Discover, post search, repost, share, save, Postgres avatar — these are **fixture-complete on web** and **absent in production**. Shipping native Live chrome for them without contracts is fake parity.

---

## B. Keep / repair / replace map

| Keep | Repair | Replace presentation | Replace implementation |
|------|--------|----------------------|------------------------|
| Tab IA; Room not a tab | `production.ts` stubs that lie (Discover `[]`, empty notices, `sendShare` throw, public `holdings: []`) | Profile/collector chrome to match `CollectorProfile` + `social-app.css` density | Paper Room underlay |
| Bearer mobile API + DAL for collection/social primitives | `rooms.ts` `theme_id` vs unapplied migration | Onboarding beats from `OnboardingFlow` | Treating `20261001` as the comms product |
| Demo/Live repository split | Live post actions that production web doesn’t have | Binder as in-room object (keep holdings query) | Orbit-only Room as the product world |
| Tokens, fonts, tab geometry | Search collectible → owner vs Add | Ask companion motion from heart CSS | Fixture slug tastes if they must match catalog UUIDs |
| Crop + private media + contribution consent | Ask nav/context; Demo API bypass | Feed chrome vs `CollectorFeed` / `ProductionFeed` | — |
| `/match` + trade DTO | Config `isConfigured` missing API URL | — | — |
| Vision stays removed | Expo Doctor pins so `mobile:verify` can pass | — | — |

---

## C. Fake parity list

1. Discover tab with no Live query  
2. Repost control without persist (and production web has no repost)  
3. Save no-op  
4. Send to screen without delivery  
5. Messages tab against missing/incomplete schema  
6. Trade message CTA with no payload  
7. Notices bell with Live empty  
8. Public collection count without rows  
9. Profile veil over paper, not Room  
10. Ask search cards dropping query  
11. Demo mode hitting Live collection/room/binder/messages  
12. Onboarding `done` without first collectible/room  
13. Binder “complete” as a 2D album app  
14. Own Room route while GET requires unapplied `theme_id`  

Treat every item as a defect that blocks trustworthy QA.

---

## D. Blocking backend contracts

Must exist before the named slice can be **done**:

| Blocker | Blocks slice | Notes |
|---------|--------------|--------|
| `EXPO_PUBLIC_API_URL` in the native config gate | 1+ all Live | Sign-in without API is a false start |
| Own Room GET without requiring unapplied `theme_id` **or** approved `20261002` | 7, 2 (Enter Room), 8 | Placements table already applied |
| Safe public holdings/wishlist read (visibility RLS) | 3 | Do not return private graphs |
| Revised DM schema (text + post + templates + read cursor) — **not** `20261001` as-is | 5 | Matches web `sendMessage` |
| Notifications table **or** Live bell disabled | 5 | Web is fixture-only today |
| Optional: avatar storage | 8 / Profile polish | Web avatar is local; don’t fake Live faces |
| Taste IDs vs catalog UUIDs | 3 quality | People-engine favorite overlap |

Do not apply migrations in a coding pass without human approval (section F).

---

## E. Vertical slices to ship (8)

Order is dependency-shaped. **Slice 1 is first.**

---

### Slice 1 — Honesty and runtime foundation

**Objective:** Native stops pretending. QA can trust Demo vs Live. The app cannot sign in into a dead API. `mobile:verify` is a real gate.

**Web reference:** Production web does **not** show Discover/repost/share/save/notices-from-SQL. Fixture web shows them only against memory-repository. `SocialNav` does not include Room.

**Native surfaces:** Feed actions, Discover toggle, notices bell, Send to, Messages empty/error copy, Demo gates on `collection`/`binder`/`room`/`messages`/`collectible`, `mobileConfig`, Expo Doctor pins.

**Backend:** None required beyond existing. Optionally hide Live Discover to match `ProductionFeed`.

**Schema:** None.

**Dependencies:** None.

**Survives:** Tab IA, APIs, tokens.

**Replaced:** Lying controls; Demo/Live mixing.

**Acceptance:** Live has no tappable dead actions (or they are explicitly disabled with the same honesty as Demo write blocks). Demo screens do not call production holdings/room/messages. Missing API URL cannot proceed past a clear error. `npm run mobile:verify` passes.

**Device QA:** Launch Expo Go; confirm Live Feed has no fake Discover/repost/save; Demo toggle cannot mutate or load mixed worlds; kill/relaunch still gated correctly.

**Implementation (2026-09-29):** CODE VERIFIED / DEVICE QA PENDING. Expo SDK pins `expo@~57.0.26`, `expo-constants@~57.0.20`, `expo-router@~57.0.24`. Native config now splits `authConfigured` vs `productApiConfigured`; `isConfigured` requires both. Demo collection/binder/collectible/collect search route through `SocialRepository`; Demo Room/Messages/thread skip Live APIs. Live hides Discover/repost/Send-to delivery/Messages/notices badge/public shelves/Ask search-card navigation; own Room DAL selects applied columns only (no `theme_id`). `20261001` and `20261002` were not applied.

---

### Slice 2 — Own collector loop (Profile + Collection + Add)

**Objective:** The signed-in user can express *their* collection the way web own-profile does: identity, counts, posts, owned rows with personal images, trade, remove, wishlist add/remove, Add Collectible → Holding immediately → read-back on Profile and Collection.

**Web reference:** `CollectorProfile` own branch; `openCollect` catalog/manual; `confirmHolding` creates holding (placement deferred to slice 7); `ProductionProfilePosts`.

**Native surfaces:** `(tabs)/profile`, `collection`, `collectible`, `collect`, `add`, `edit-profile` (text only unless avatar contract exists).

**Backend:** Existing holdings/wishlist/media/catalog/posts. Repair public-count mismatch is **not** this slice (own lists already load). Presentation pass vs `ObjectTile` / shelves.

**Schema:** None for the loop. Do not block on avatar.

**Dependencies:** Slice 1 (so Demo doesn’t hit Live mid-test).

**Survives:** `createHolding`, media upload, crop, contribution consent.

**Replaced:** Visual hierarchy where it still reads as a prototype list.

**Acceptance:** Catalog add without photo: holding exists, Profile collected count increments, Collection shows the row, Binder includes it **if photocard** (2D binder acceptable until slice 7). Manual add + optional consent: template searchable. Trade/remove persist after relaunch. Empty/error/loading match intent. No Room required for ownership.

**Device QA:** Sign in → add from catalog → skip photo → count + list → photocard appears in Binder → wishlist from Search → remove wishlist → trade toggle → remove holding → counts update.

---

### Slice 3 — Other collector (identity graph)

**Objective:** Opening another collector reproduces web other-profile: follow, posts, compatibility/trade, Enter Room CTA, **owned and wishlist rows** when visibility allows — not a number over empty shelves.

**Web reference:** `CollectorProfile` other branch; `CollectibleMatch`; production follow; fixture shelves (native must use **safe production lists** instead of fixtures).

**Native surfaces:** `collector.tsx`, trade match, follow, Enter Room (navigation only).

**Backend:** New or extended public holdings/wishlist DTO honoring `collection_public` / `wishlist_public`. Stop `production.loadCollector` `holdings: []` / `wishlist: []` while showing `holdingCount`.

**Schema:** None if RLS already allows a summary-safe list; otherwise a dedicated RPC — **do not weaken RLS**.

**Dependencies:** Slice 1. Enter Room landing can 404/error until slice 7; CTA must not imply a working editor.

**Survives:** `/match`, follow PATCH, collector posts.

**Replaced:** Empty-shelf UI.

**Acceptance:** For a public collection, rows and imagery appear; private collection does not leak. Count matches rows. Follow persists. Compatibility labeled as production engine.

**Device QA:** Open a real public collector → shelves populated or honestly empty → follow → their posts on Following feed → match/trade UI → Enter Room reaches public orbit **or** a clear unavailable state if Room GET still blocked.

---

### Slice 4 — Feed and Search (social discovery)

**Objective:** Discover tab + Search destinations behave like the **web social app**: production following feed like `ProductionFeed`; fixture-complete destinations implemented with **production data** where contracts exist; no empty dest that looks live.

**Web reference:** `SocialNav` first tab = Discover (feed). `ProductionFeed` = following only. `CollectorSearch` dests: people, rooms (Enter), posts, collectibles (owner profile), entities.

**Native surfaces:** `(tabs)/index`, `(tabs)/search`, `SeoullyFeedPost`.

**Backend:** Following feed already. People/catalog/discovery rooms already. **Post search** needs a real query or the dest is hidden. Collectible result action: match web (owner) **and** keep Add on the collect flow — Search collectibles on web is “who has this,” not “add.”

**Schema:** None unless post search needs indexes (likely code on `posts`).

**Dependencies:** Slice 1, 3 (people results must land on a true profile).

**Survives:** Suggested collectors Live API (keep; production web lacks it — that is native surplus, not fake if Discover isn’t implied).

**Replaced:** Live Discover toggle if still empty; collectible → `/add` as the only action.

**Acceptance:** Following feed like+comment persist. Discover either works or is absent. Search people UUID → collector. Rooms → public room. Posts dest honest. Collectibles match web destination rules.

**Device QA:** Follow from slice 3 → post appears in Following. Search `@handle`, a room, a collectible owned by someone else, a group name.

---

### Slice 5 — Communications (Messages, Send to, trade, notices)

**Objective:** Reproduce web inbox/thread/send-to/trade-context/unread — on **production**, not memory-repository.

**Web reference:** `CollectorInbox` send-to mode; `CollectorThread` `sendMessage({ body, postId, templateIds })`; unread; `CollectorNotices` kinds + trade → thread.

**Native surfaces:** messages, thread, send-to, notices, collector Message / trade CTA, nav unread.

**Backend:** **Revised** DM schema + API (not stock `20261001`). Notifications schema **or** Live bell remains disabled (no empty-looking list). `sendShare` inserts a share message. Trade CTA sends template attachments.

**Schema:** Human-approved replacement/revision of `20261001000000`; new notices table if the bell is Live.

**Dependencies:** Slice 1, 3 (recipients are real users). Slice 4 share from feed.

**Survives:** Thread/inbox UI structure; people search for recipients.

**Replaced:** Body-only SQL; throw-on-send; fixture notices as Live.

**Acceptance:** Send text; relaunch thread. Share a post from Feed → recipient sees post context. Trade CTA carries templates. Unread on list + tab. Notices either real or hidden.

**Device QA:** Two accounts (or fixture-impossible: two Live users) — message, share, trade ping, badge, tap notice.

---

### Slice 6 — Ask Seoully

**Objective:** Companion matches web: production tools, cards that navigate with params, context from the open surface.

**Web reference:** `AskSeoullyPanel.execute`; `seoully:assistant-search`; room/profile/collection/add/inbox.

**Native surfaces:** `SeoullyCompanion`, search/profile/room/collection routes.

**Backend:** Existing `/api/mobile/assistant` (KEEP). Pass `profileUserId` / `templateId` from route.

**Schema:** None.

**Dependencies:** Slices 2–5 so navigation targets are real.

**Survives:** ALS bearer Ask, registry tools.

**Replaced:** Always-`home` context; search without query.

**Acceptance:** Live Ask never returns Demo collectors. Collection/wishlist/catalog/people/rooms cards open the right screen with the right id/query. Unavailable tools fail honestly.

**Device QA:** From Profile and from a collector, ask collection, similar people, a collectible name; tap each card type.

---

### Slice 7 — Room + Binder as one world

**Objective:** Reconstruct web Room: continuous collection world, zones (shelf/wall/case/desk/binder/archive — **no Closet**), place/move/store, inspect, Profile glimpse (real renderer under 0.85 veil, opaque chrome), public visit, Binder as an object in that room (camera/page/pocket), Room↔Binder focus.

**Web reference:** `Room.tsx`, zones, `BinderZone`/`OpenBinder`, `glimpseOwnerRoom`, `WorldChrome`, `roomPersistence`, public `/@handle/room`.

**Native surfaces:** `room.tsx`, `collector-room.tsx`, `NativeRoomRenderer`, Profile underlay, retire standalone Binder as the product (or keep as fallback inspect only).

**Backend:** Fix Room GET (`theme_id` optional **or** apply `20261002` after approval). Public RPC holding ids. Theme persist only after column exists.

**Schema:** `20261002` if theme picker is in scope; else DAL must not select missing columns.

**Dependencies:** Slice 2 (holdings to place). Slice 1 (no Demo hitting Live room).

**Survives:** Placement table, representation-from-kind, personal media textures, public RPC.

**Replaced:** Paper underlay; 2D Binder as the only binder; orbit-as-product if it cannot express zones.

**Acceptance:** Own holdings placeable; relaunch restores transforms; photocard opens binder **in room** at the right spread; Profile shows that room through veil; public room read-only; stored = unplaced, not unowned. `mobile:verify` still passes (R3F must not break Expo Go graph).

**Device QA:** Web’s physical Room checklist: enter from Profile, place album on shelf, photocard to binder, back, visit someone else’s public room, relaunch.

---

### Slice 8 — Onboarding and first home

**Objective:** New user meets Seoully the way web does: welcome personality, tastes, **first collectible**, **room reveal**, then social — not a three-chip form dumped into empty tabs.

**Web reference:** `WelcomeGate`, `OnboardingFlow` through `reveal` / `meet`.

**Native surfaces:** `index` auth, `onboarding`, first `/room`.

**Backend:** Existing onboarding PATCH + holdings. Avatar only if production media exists; otherwise skip photo beat rather than fake it.

**Schema:** Avatar optional; do not invent Vision.

**Dependencies:** Slices 2 and 7 (reveal needs a room that loads).

**Survives:** `onboarding_step` column; group/bias/interest PATCH.

**Replaced:** Native onboarding UI; heart companion during beats.

**Acceptance:** New account cannot reach tabs without completing the same beats web requires for `ready` (collect + reveal). Returning user with `done` lands in social over their room (or Profile with real underlay).

**Device QA:** Fresh account full path; second launch skips to app; language toggle.

---

## F. Migrations requiring human approval

| File | Recommendation |
|------|----------------|
| `20260930000000_native_onboarding_progress.sql` | Already applied. Do not revert. |
| `20261001000000_direct_messages.sql` | **Do not apply as-is.** Revise for post share, template/trade context, unread; RLS review; then apply once. |
| `20261002000000_native_room_theme.sql` | Approve only as **theme persist**. Unblock Room GET first if shipping slice 7 before theme. Do not conflate with placements (already applied). |
| Notices (not written) | Required before Live bell; design with kinds matching web `SocialNotice`. |
| Avatar (not written) | Only if slice 8 includes photo beat. |

No RLS weakening. No production applies from this document.

---

## G. Final beta acceptance journeys

Physical iPhone (and Android when that build is in play). Demo must not be used to sign these off.

1. Fresh install → config OK → sign up → onboarding through first collectible → room reveal → tabs.  
2. Kill/relaunch → session → same identity and holdings.  
3. Add catalog item without photo → owned everywhere that web would show it (Profile, Collection, Binder-in-room, placeable).  
4. Add with crop + private photo → textures in Room/Binder; not in catalog without consent.  
5. Manual contribute → holding now → searchable → optional consent image.  
6. Own Profile: posts, counts, shelves, trade, remove, Edit text, Enter Room glimpse.  
7. Other public collector: real shelves, follow, match/trade, message, public Room.  
8. Following feed like + comment persist; no fake Discover/repost/save/send.  
9. Search: people, rooms enter, collectibles per web dest, posts honest.  
10. Send to + DM + unread + notice tap (after slice 5).  
11. Ask cards navigate with production data only.  
12. Room edit persist + binder in place + Profile veil is that room.  
13. Sign out → sign in.  
14. `npm run mobile:verify` green on the build that is on the phone.

If any journey only works in Demo, it is **not** beta-done.

---

## Which slice is first

**Slice 1 — Honesty and runtime foundation.**

Every later slice will be mis-tested while Discover, notices, Send to, Messages, public shelves, and Demo/Live mixing still look finished. Slice 1 does not require schema approval and unblocks truthful device QA for slices 2–4.
