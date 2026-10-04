# Native road to ship

**Status:** Slices 1–8 implemented in tree — **SLICE 8 — CODE VERIFIED / DEVICE QA PENDING**. Feature slices are complete. Next phase is **PHYSICAL DEVICE QA + HARDENING**. Do not invent Slice 9.  
**Canonical spec:** `docs/web-native-parity-contract.md`  
**Connectivity evidence:** `docs/native-backend-connectivity-audit.md`  
**Tree:** `mobile-native`  
**Date:** 2026-09-29

Done is a complete user-experience slice (web behavior + native UI + backend + persistence + read-back + navigation + loading/error/empty + `mobile:verify` + device QA). Not a layer of APIs or a coat of tokens.

---

## A. Current reality

**Do not use percentages.**

### What exists

- Expo Router tabs matching web’s five peers; Room is **not** a visible tab.
- Bearer `/api/mobile/*` to real RLS-backed tables for session, onboarding step, own holdings/wishlist, media, catalog contribute/reference, following feed, **Discover** (public posts outside Following), likes, comments, image posts, follow, people search, catalog search, **post search** (caption/location/author/tagged catalog ILIKE), discovery collectors/rooms, public room RPC, pair match, Ask assistant.
- Native collect flow that **creates a Holding immediately** (hard rule).
- Own Profile can list own holdings/wishlist and toggle trade/remove.
- Token map from `social-app.css` (colors, type, 52/58/48/42 metrics).
- Demo `__DEV__` world with fixture feed Discover, notices, reposts, Send to, Ask, full collector shelves.
- A Three.js Room renderer and a 2D Binder built from holdings.
- Companion + notices + Send-to **shells**.

### What does not exist

- The web product structure: **Room always mounted under social**; Profile as identity over that Room.
- Web onboarding after tastes: avatar, first collectible, room reveal, meet collectors. **Native Slice 8 now covers this** (avatar still skipped — no production avatar).
- Production notifications beyond like/comment/follow.
- Production messages with post share, trade templates, unread (pending SQL is body-only and unapplied).
- Avatars in production.
- Web binder-as-object, zone docking, doorway, card flight, undo/redo.
- Own Room GET against current production schema (`theme_id` selected, column unapplied).
- Ask context is now a typed surface contract (collector, collectible, search query/dest, conversation peer/thread). Physical-device proof of Ask journeys is still pending.
- Honest Demo isolation (`collection`/`binder`/`room`/`messages` still call Live APIs).
- Passing `npm run mobile:verify` (Expo Doctor patch skew).
- Physical-device proof of any Live journey.

### What web itself does not persist (so native must not fake it as “already done”)

Messages, notices, repost, share, general post save, Postgres avatar — these are **fixture-complete on web** and **absent in production**. Native Live Discover and post search now have production queries even though production web `ProductionFeed` is still following-only.

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

**Implementation (2026-09-29):** SLICE 2 — CODE VERIFIED / DEVICE QA PENDING. Own Profile, Collection, Add Collectible (`/collect` catalog or manual), confirm (`/add`), and collectible detail form one production-backed journey: `createHolding` persists immediately without photo or Room placement; optional personal media + photocard crop; consent default false for catalog reference images; Profile/Collection refresh on focus; Binder selects photocard holdings; Room stored collection includes unplaced owned holdings. Demo cannot mutate production through this flow. No new migrations. `20261001` and `20261002` were not applied.

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

**Implementation (2026-09-29):** SLICE 3 — CODE VERIFIED / DEVICE QA PENDING. Other-collector Profile loads identity, posts, follow, production `computeCompatibilityPeople` (not fixture `computeCompatibility`), and safe public Owned/Wishlist rows from existing `graph_pair_snapshot` (no new migration, no RLS weakening, no personal Holding media). Public collectible destination does not call owner-only Holding APIs. Taste slugs are resolved to catalog UUIDs at the compatibility boundary without rewriting profile rows. Live collection counts match returned public rows. Trade CTA stays visible but does not send messages. `20261001` and `20261002` were not applied. Own-profile count remains the loaded holdings page (default 100) — not rewritten in this slice.

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

**Implementation (2026-09-29):** SLICE 4 — CODE VERIFIED / DEVICE QA PENDING. Native first tab copy is **Discover** (web `nav.discover`). Live Discover is public posts whose authors are outside Following+self, recency-ordered, no fixture fallback. Following remains `getProductionFeed`. Suggested collectors stay on `graph_discovery_candidates` / compatibility+trade signals with EN/KO copy. Post search is a bounded ILIKE over caption, location, author identity, and tagged catalog names (no tsvector/migration). Collectible search opens the public owner collector profile, not Add; Add/wishlist stay secondary. Room search returns only rooms that `get_public_room_by_handle` exposes as public. Search accepts `q`/`dest` so later Ask cards can preserve the query. `20261001` and `20261002` were not applied.

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

**Implementation (2026-09-29):** SLICE 5 — CODE VERIFIED / DEVICE QA PENDING. `20261001000000_direct_messages.sql` applied to linked production (`ttmynanbwxlvcczeobgj`). `20261002` remains unapplied. Live `persistMessages` / `persistNotices` / `deliverShare` are true. Demo stays local. Production notices are like/comment/follow only.

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

**Implementation (2026-10-01):** SLICE 6 — CODE VERIFIED / DEVICE QA REQUIRED. Ask Seoully is the existing heart companion (one assistant). Live conversation goes through server-side OpenAI (`OPENAI_API_KEY` + `OPENAI_MODEL` on Next only; never Expo / `EXPO_PUBLIC_*`). The model interprets and answers general K-pop/collector questions without a Seoully tool. Authoritative holdings, wishlist, catalog, collector search, compatibility, and profile facts use the production registry/DAL. Tool-choice is optional (`auto`); general questions are not forced through the catalog. Navigation is an allowlisted semantic action (`type` + validated params), never an arbitrary href/route; the client maps it to Expo routes (`/collect`, `/profile`, `/edit-profile`, `/search?q&dest`, `/messages`, `/`, collector/collectible IDs only when repository-validated). History is capped at 8 turns and can be reset. Demo uses fixture tools for Seoully data and honestly refuses general/current/price answers. No current-information tool is registered (`search_current_information` reserved). Price intelligence is deferred. No Vision. No migration. Room heart placement stays as-is until Slice 7. `20261002` remains unapplied.

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

**Implementation (2026-10-01):** SLICE 7A — physically accepted after CAMERA/SHELL REPAIR 04 (`7dbc60d`) with **one deferred visual defect**. Keep the engine; rebuild the experience. Room is **not** a bottom tab. Profile / collector identity → stack `/room` or `/collector-room` → full-screen immersive world; Back returns to identity/social. Social tabs are absent inside Room (no `(tabs)/room` route). Permanent giant header, Move Objects header, and Home/Shelf/Wall/Case/Desk/Binder/Archive pills are removed. Navigation is spatial (world hotspots + desk Binder tap). Interactive swipe-back is disabled on Room routes only. Primary camera travel is a portrait **window into the Room**: one-finger empty-world drag pans `panX`/`panY` (camera + lookAt together; horizontal range larger than vertical), pinch dollies, authored docks remain. The whole Room is not fitted into the phone. Tap-to-focus / inspection restores the previous pan/dolly framing. Existing edit engine / in-world Binder / Ask Seoully heart are preserved. Companion uses safe-area + gutter only. `20261002000000_native_room_theme.sql` remains **unapplied**. No Closet.

**7A deferred to 7D — world envelope / visual reconstruction.** At some permitted pan/dolly framings a thin SLANTED sliver can still appear below the Room floor. Multiple 7A camera/shell repairs did not kill it. The slant suggests world/floor geometry, envelope, camera/world intersection, or exterior rendering — not merely safe-area layout. **DEFERRED TO 7D.** 7D acceptance: at every permitted pan/dolly position the viewport must contain only intentional Room/world imagery — never exterior void, unfinished geometry, or native shell. Do not chase this by changing the accepted 7A camera.

**Implementation (2026-10-02):** SLICE 7B — **physically verified** at `1916f58`. Freeze the touch model. Own Room keeps the 7A `Edit Room` overlay; public Rooms stay read-only. Long-press a movable collectible to acquire it, lift it, and drag through Room-space via landing-plane projection. Compatible surfaces highlight; valid release settles and persists through the existing RoomPlacement path; invalid release restores the original placement and writes no history. Empty-world pan and pinch survive in Edit Room until an object is acquired. Turn left / Turn right / Smaller / Larger are no longer primary editing UI. Store still removes placement only.

A post-7B **failed entrance repair** (`485e5ee`, `surfaceReady` / Canvas-opacity) physically failed — own/public Rooms could stay a solid theme color. It was reverted at `63e1a8f`. Do not reintroduce that gate. After revert the 3D Room renders again. Own Room may show ~0.5s of theme-color initialization before the first 3D frame — **accepted and DEFERRED TO 7D**. The 7A slanted floor/exterior sliver remains **DEFERRED TO 7D**. Do not change accepted camera bounds to chase either defect.

**Implementation (2026-10-02):** SLICE 7C — ROOM WORLD INTEGRATION — **physically verified**. Physical storage and Binder are part of the Room world. One unified `Edit Room` mode (no separate Customize Room). The legacy Stored tray is replaced. Archive crate + stored sheet + 7B place-from-storage. Binder open/close restores explore framing. Public storage is private. `20261002000000_native_room_theme.sql` remains unapplied.

**Implementation (2026-10-02):** SLICE 7D — ROOM VISUAL RECONSTRUCTION + UNIFIED CUSTOMIZATION — CODE VERIFIED / DEVICE QA REQUIRED. Keep the engine; rebuild the experience. World envelope is now a thick floor / walls / ceiling / baseboard box that extends past accepted camera clamps — the slanted gray/exterior sliver is treated as a geometry coverage defect, not a camera-bound bug. Camera clamps are unchanged. Furniture (Shelf, Case, Desk, Binder, Archive crate) and collectible silhouettes are stylized, low-poly, and recognizable. Media priority: personal → authorized catalog/reference `template.imageUrl` → type fallback. Lighting is ambient + window key + fill, scaled by curated brightness. One Edit Room **Room style** sheet customizes wall / floor / furniture / rug / light / brightness with immediate world updates. Demo persists style in-session. Live persists through `rooms.style` JSONB (`20261003000000_native_room_style.sql`) — owner write, public read via the existing RPC. **`20261002000000_native_room_theme.sql` stays unapplied** — a single `theme_id` preset cannot express independent 7D categories. The 7D migration is written and reviewed; it is **not applied** in this block. Entrance ~0.5s: Canvas now mounts without waiting for snapshot (overlap GL init with fetch). No `surfaceReady` / opacity gate. If a brief flash remains, leave it. 7B/7C hit targets and landing planes are unchanged. Slice 8 is not started.

**Repair 01 follow-up — inspection + Binder composition (code verified / device QA required).** Physical QA after 7D showed albums inspecting as a spine/edge, Binder overflowing the portrait viewport, and Binder photocards zooming the camera into the spread instead of lifting out. Architecture is unchanged. A small `composition.ts` layer now owns front-face orientation, viewport-aware fit, Binder portrait framing, and photocard pocket→inspect motion. Inspected albums rotate so the +X cover faces the camera and fit the usable phone viewport. Open Binder uses a portrait-fit camera (edges/seam visible; not a 2D route). Tapping a Binder photocard lifts that card out of its pocket to a front-facing inspect pose; `View collectible` reuses `/collectible` (own) or `/public-collectible` (visitor). Visitor wishlist/message reuse existing Slice 3/5 contracts. Binder/page state restores after inspect. No Holding/RoomPlacement/Binder write. No migration applied. Slice 8 not started.

Repair 01 report additions: **42** album front-face inspection; **43** viewport-aware inspection fitting; **44** Binder portrait fit; **45** Binder responsive camera composition; **46** photocard pocket → inspection transition; **47** photocard front-face/image (personal → catalog → fallback); **48** Binder `View collectible`; **49** owner Binder actions; **50** visitor Binder actions; **51** collectible-detail reuse; **52** compact Binder UI; **53** shared inspection-language architecture.

**Repair 01 follow-up — Room environment + visual parity (code verified / device QA required).** Physical QA after 7D confirmed the slanted exterior gap is gone (regression lock) but the Room still read as clay slabs against a flat wall. Keep the engine, interactions, and world-envelope coverage; reconstruct composition. Furniture is layered thin boards (shelf lips, desk drawers/handles, case frame, crate slats/lid). Permanent dressing: window, floor lamp, plant, storage boxes, baseboards. Materials/value separate wall, floor, furniture, metal, rug, and paper. Dark/night fill is brighter so ink rooms stay readable. Inspection/Binder repair, 7B, and 7C hit targets are unchanged. `20261003000000_native_room_style.sql` stays unapplied. Slice 8 not started.

**Repair 02 — immersive Room framing (code verified / device QA required).** Physical QA rejected the environment-repair HOME (`z: 15.55`, `homeDollyMax: 1.48`) as a dollhouse: camera outside the bedroom, empty floor/ceiling, side walls as stage flats. Environment reconstruction is kept. HOME is pulled back inside the room (`z: 5.72`, look slightly left/up). Max dolly is a modest step-back (`1.16`) with an `IMMERSIVE_HOME.maxZ` guard. Inner side walls continue past the camera. Checks require envelope coverage and immersive-inside-room safety — not “the entire Room must fit.” Pan discovers off-frame window/wall. Slice 8 not started.

**Repair 03 — Room proportions + material/lighting fidelity (code verified / device QA required).** Physical QA accepted Repair 02 framing but asked for a more intimate bedroom and less clay. Authored width is 90% and depth is 80% of Repair 02 (layout helpers, not a camera pull-back). HOME stays at `z: 5.72`. Bundled grayscale grain maps tint with existing style colors. One window-key directional light may cast a 512px shadow; contact planes sit under furniture. Thin edge lips replace razor-box silhouettes. Inspection/7B/7C unchanged. `20261003000000_native_room_style.sql` stays unapplied. Slice 8 not started.

**Repair 04 — true Edit Room + basic Room Shop + first-room experience (code verified / device QA required).** The Room is the collector's bedroom; Edit Room arranges and customizes it. New rooms bootstrap Shelf + Lamp only and auto-enter Edit Room once with a short "Make this room yours" helper. Existing rooms stay furnished (`rooms.layout` empty `{}` = legacy + first edit complete). One Edit mode moves collectibles, furniture, and decor; furniture carries children via surface-relative deltas; Binder follows the live Desk and survives Desk absence. Basic Shop (no commerce) adds one canonical version of each Room object. Compact floating toolbar replaces the giant edit tray. Transient toasts replace persistent placement errors. `20261004000000_native_room_layout.sql` is written and reviewed, **not applied**. Style/camera/7B/7C/Repair 03 visuals unchanged. Slice 8 not started.

**Repair 05 — mobile render fidelity / crispness (code verified / device QA required).** Room design stays frozen. Softness came from featureless 256 maps stretched over the envelope, hardcoded 2× anisotropy, sRGB albedo used as roughness, and a 512 shadow frustum larger than the bedroom. Floor/wall/furniture maps are now 512 with real procedural grain; rug is 256; small materials stay 128. Filtering stays mipmapped; anisotropy is capability-capped at 4× on large surfaces. One directional 1024 PCF map is fitted to the Room. R3F native already renders at `PixelRatio.get()` — no Canvas dpr/opacity/surfaceReady gate. No post-processing, no remote environment textures. Physical iPhone QA is the authority. Slice 8 not started.

Locked gesture model:

- **NORMAL ROOM:** tap object = inspect; empty drag = camera pan; pinch = camera dolly; tap storage crate = stored sheet; tap Binder = spatial Binder
- **EDIT ROOM:** empty drag = camera pan; pinch = camera dolly; long-press object = acquire; drag acquired object = move object; valid release = settle/persist; invalid release = return origin; tap storage crate = same stored sheet; choose stored item = new-placement preview; valid drop = create RoomPlacement; cancel = remains stored

#### Slice 7 decomposition

| Block | Scope | Status |
| --- | --- | --- |
| **7A** | Immersive Room shell + direct-touch constrained camera | Physically accepted (REPAIR 04 `7dbc60d`); slanted floor sliver **DEFERRED TO 7D** |
| **7B** | Touch-first editing (long-press, world-space drag, settle/rollback) | **Physically verified** (`1916f58`) — freeze the touch model |
| **7C** | Storage + Binder as physical Room world objects | **Physically verified** — freeze storage/Binder world integration |
| **7D** | Visual reconstruction + unified Edit Room customization | CODE VERIFIED / DEVICE QA REQUIRED — `20261002`/`20261003`/`20261004` written, not applied |
| **7E** | Physical integration QA of the reconstructed world | Not started — required after 7A device proof |

#### Slice 7 visual / interaction QA map

| State | Web target | Native implementation | Device-QA risk |
| --- | --- | --- | --- |
| Room home | Overview dock, crop into furniture on phone | `HOME_POSE` authored camera, no orbit | Framing vs web CSS 3D scale |
| Shelf | Zone dock + shelf hotspots | Tap shelf geometry / hotspot → `ZONE_DOCKS.shelf` | Hotspot vs object hit-testing |
| Wall | Poster wall dock | Wall plane + dock | Poster scale / lighting |
| Case | Display case dock, glass | Case furniture + glass plane | Glass opacity/readability |
| Desk | Desk dock, lamp | Desk + lamp + binder object | Binder vs desk objects |
| Archive | Floor crate dock | Archive crate dock | Easy to miss at home crop |
| Object focus | Inspect pose, object lifts | Inspect dock + lift offset | Overlay vs in-world primacy |
| Edit mode | Overview+tilt, grab/settle | `EDIT_POSE`, long-press acquire, landing-plane drag; place-from-storage reuses the same engine | Gesture vs camera |
| Stored collection | World storage object + sheet | Archive crate + `StoredCollectionSheet` of unplaced owned Holdings | Search must stay unobscured; public storage private |
| Binder closed/desk | BinderZone on desk | Closed binder mesh on desk | Tap target size |
| Binder open | OpenBinder lift off desk | `NativeOpenBinder` same Canvas | Continuity / scale |
| Page turn | Leaf pivots on spine | rotateY leaf + reduced-motion snap | Gesture collision |
| Card focus | Card lifts from pocket | Pocket card lifts; no white modal | Texture remount flash |
| Profile over Room | Room mounted, veil 0.85 | `RoomWorldGlimpse` + veil | Not live GL; derived palette |
| Public Room | readOnly Room | `mode="public"`, no edit, public placements only | Empty honest rooms |

#### Physical iPhone QA (Slice 7)

1. Cold launch — no R3F crash. 2. Profile glimpse is the room world, not paper. 3. Enter Room feels authored. 4. Six zones readable. 5–9. Tap Shelf/Wall/Case/Desk/Archive — camera docks. 10. Tap collectible — focus/lift. 11. Back one spatial level. 12–18. Edit move / invalid drop / store (holding remains) / place / cancel / save+relaunch. 19–27. Desk Binder → open → turn pages → odd last spread complete → personal photocard → lift → return without white flash → close to desk. 28. Profile ↔ Room no black Canvas. 29. Background/resume. 30–31. Public room view-only, no private media. 32–33. Demo fixtures; Live never SOO/MINJI. 34. Reduced motion still usable. 35. Heat/memory after minutes.

#### Physical iPhone findings — locked for Slice 7 (Repair 01 recorded, not implemented)

Physical device QA after Slice 5–8 proved the current native Room is functionally useful but **not product-parity**. Repair 01 does **not** implement the following. Slice 7 reconstruction must. `20261002000000_native_room_theme.sql` stays **unapplied** until explicitly reviewed in Slice 7.

1. **Room is full screen.** Entering Room leaves the social layer. No persistent social bottom tab bar. No giant ordinary-screen Room header. No permanent Home/Shelf/Wall/Case/Desk/Binder/Archive pill navigation. The world occupies the usable display. Minimal overlays only (Back, Edit Room, contextual controls). Back returns to social/identity. Room is **not** a primary bottom tab.

2. **Direct touch camera.** Replace desktop-like zone-button navigation as the primary interaction. Constrained pan/orbit on empty world, pinch zoom within useful limits, tap object/zone may smoothly focus. Camera must not get lost/flipped/clipped through geometry. Gestures coexist with object interaction. This is a small collector diorama, not a free 3D CAD camera.

3. **Object inspection.** Keep tap collectible → focus/lift → inspect/details. For another collector's object, valid actions include Add to Wishlist and Message about this collectible (reuse Slice 5). No marketplace checkout/offers.

4. **Touch-first edit mode.** Reject Turn left / Turn right / Smaller / Larger as the primary model. Target: Edit Room → long-press collectible → lift → drag → compatible surfaces communicate availability → release → settle; invalid placement rolls back. Do not expose arbitrary scaling as a normal collector action. Representation geometry defines scale. If orientation is required, invent a touch-native interaction later — not rotation buttons as the main UX.

5. **Placement semantics.** Ownership ≠ placement. Albums/CDs/books → shelf/desk/compatible storage. Lightsticks/plush/figures → shelf/desk/case where compatible. Posters/flat display → wall. Photocards → Binder and/or supported display per canonical rules. Archive/memorabilia → Archive/storage. Use existing placement/domain contracts. Do not invent a second placement system.

6. **Stored collection as a world concept.** The giant bottom text/list tray is not the final Room. Investigate a physical storage/archive/merch-box (or similar) affordance. Tap storage → native collection drawer/sheet with thumbnails and identity → choose/place. Unplaced Holdings remain owned. Storing removes placement only.

7. **Binder is part of the world.** Binder remains a physical Room object. Tap → continuous camera to desk/binder → Binder opens in-space. Close → camera returns to Room. Do not make Binder feel like an unrelated app tab.

8. **Material / object fidelity.** Current physical read is largely flat colored blocks. Improve recognizable furniture, silhouettes, authorized personal/catalog imagery, album/CD/book covers, photocard texture, lightstick/plush/figure representation, Binder materials/pockets/pages, rug/floor/wall distinction, furniture edge, depth cues. Progressive fidelity, not photorealism. Users must recognize objects without text labels.

9. **Lighting / depth.** Current dark aesthetic merges wall/floor/furniture. Reconstruct deliberate lighting inspired by web window/outdoor illumination, Expo-GL-safe: ambient, directional/window-like, restrained shadows, floor/wall separation, readable collectible faces, brightness control. No unsupported post-processing. Physical-device performance is authoritative.

10. **Room customization.** Inspect canonical web customization: wall color, floor, furniture color/material, rug, brightness/lighting, appropriate accents. Do not invent arbitrary theme schema. Theme migration remains unapplied until Slice 7 review.

11. **Touch-first principle.** Invert cursor → click → UI button → transform. Target: finger → touch world → manipulate world/object directly → UI only when needed. No hover, mouse-wheel, or desktop cursor mental model.

12. **Keep the working engine.** Do not throw away working infrastructure without evidence: Three/R3F, Expo GL device compatibility, production RoomPlacement DAL, ownership/placement separation, representation contracts, personal media textures, focus behavior, Binder geometry/data, edit persistence, invalid-placement rollback, store semantics, public Room security, current renderer compatibility fixes.

13. **Live Profile Appearance / Room Sync.** Demo already maps web `resolveProfileTheme(appearance, room)` into native `SocialTheme` (paper / mist / ink / mute / line / primary / primaryDeep / primarySoft / action / onPrimary / secondary / secondarySoft / cream). Own Profile publishes that palette to the tabs shell while focused so the social tab bar can use the same tokens (web `.s-nav`). Leaving Profile clears the publish so Discover/Search do not inherit a collector theme. Production mobile identity/collector contracts have no appearance payload, and `20261002000000_native_room_theme.sql` stays unapplied. Live Profile therefore keeps default Seoully paper tokens until Slice 7 can persist/read appearance on current contracts — do not invent a second theme schema here. Do not theme the temporary Room tab bar; Slice 7 removes it.

**Goal:** KEEP THE ENGINE. REBUILD THE EXPERIENCE.

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

**Implementation (2026-09-29):** SLICE 8 — CODE VERIFIED / DEVICE QA PENDING. Welcome reconstructs `WelcomeGate` copy. Durable `onboarding_step` stays `group | bias | interest | done` (no new table). `interests` PATCH no longer sets `done`; a new `complete` action sets `done` only after a real Holding exists. Client/session phases cover collect → reveal → real Slice 7 Room/Binder intro → production meet. First collectible reuses `/collect` + `/add` (`createHolding`). No Vision. Avatar beat skipped. `20261002` was not applied. No Slice 9.

---

## PHYSICAL DEVICE QA + HARDENING

Feature slices 1–8 are **code verified**. Do not invent additional feature slices. The working plan from here is:

1. Full physical-device QA (iPhone first; Android when that build is in play)
2. Integration repair of what the device proves is broken
3. Performance / heat / memory hardening
4. Privacy / security regression
5. Release readiness
6. Beta / ship

Consolidated matrix (pulls still-pending physical QA from Slices 1–8):

### A. Startup / auth
- Cold launch Expo Go — no R3F crash, no missing API URL false start
- Secure session restore; sign-out; sign-in; email confirmation
- Deep-link `code=` exchange
- Welcome personality, then identity — not dumped into a SaaS form
- Returning `onboarding_step=done` goes to tabs; incomplete resumes the durable step

### B. Onboarding (Slice 8 first-user)
1. Fresh Live identity signs in
2. Welcome appears
3. Group selection uses production catalog/taste IDs
4. Bias matches chosen group
5. Interest step persists
6. Kill app → resume correct step (interest chips vs collect vs reveal)
7. Add first existing catalog collectible
8. Camera/library
9. Photocard crop
10. Add to Collection creates Holding once
11. Personal image on the digital card
12. First reveal
13. Room loads without R3F startup crash
14. New object available in Room (stored/unplaced is valid)
15. Photocard in Binder
16. Separate non-photocard path
17. Catalog miss → Add Manually
18. Manual item becomes Holding
19. Consent OFF does not share private photo
20. Consent ON uses separate catalog reference
21. Kill after Holding → no duplicate
22. Room/Binder reveal completes
23. Social intro uses real collectors or honest empty
24. Finish onboarding (`done`)
25. Relaunch → no onboarding
26–30. Profile / Collection / Room / Binder / Ask “Do I own this?”
31. Demo never writes Live
32. EN/KO preserves progress
33. Reduced motion completes
34. Offline/error paths do not duplicate ownership

### C. Profile / Collection
- Own identity, counts, posts, trade, remove, wishlist
- Edit Profile text; tastes via onboarding `edit=1` without resetting `done`
- Public collector shelves match returned rows; no private media leak

### D. Discover / Search
- Live Discover is public-outside-following, not fixtures
- Search people / rooms / collectibles / posts; collectible dest is owner not Add
- Ask search cards preserve query

### E. Collector graph
- Production compatibility/trade, not fixture SOO/MINJI
- Taste slug ↔ catalog UUID alias at the service boundary

### F. Messages / notices
- Live inbox/thread/send against applied `20261001` (body-only; post share/trade templates still incomplete)
- Notices like/comment/follow only; Demo local

### G. Ask Seoully
- Heart companion is Ask Seoully; free-form chat through server OpenAI
- General knowledge vs Seoully-authoritative tools; allowlisted navigation; bounded history
- “Do I own this?” from real holdings; Demo does not pretend to be Live OpenAI
- Companion visible after onboarding; still on reduced motion
- Price intelligence and Room spatial heart placement deferred

### H. Room
- Authored docks, six zones, edit persist, store does not delete Holding
- Public room view-only; Profile glimpse is world not paper
- `20261002` remains unapplied; hearth default

### I. Binder
- Desk object → in-scene OpenBinder; photocards only; odd last spread; image-failure geometry

### J. Media / crop
- Camera/library permissions; photocard pan/zoom crop; personal media vs catalog reference

### K. Demo / Live isolation
- Demo `__DEV__` fixtures only; Live never falls back to SOO/MINJI
- Onboarding first-run forces Live so Demo cannot block Holding writes

### L. EN / KO
- Typed dictionaries; Baloo 2 / Noto Sans KR; locale toggle does not reset onboarding

### M. Reduced motion
- Camera snap, binder snap, reveal fade/timer, companion still, flow complete

### N. Lifecycle / background / resume
- AppState pause GL; kill/relaunch session; onboarding resume idempotent

### O. Performance / heat / memory
- Welcome/auth do not mount Room Canvas
- Lazy GL on reveal/room; frameloop pause
- Media compressed/resized; heat after minutes in Room

### P. Privacy / security regressions
- Catalog-reference consent default false
- Public rooms no private holding media
- Bearer session; no secrets in the client tree; RLS unchanged

**Known device-QA risks:** Expo Go GL/R3F on first Room intro; camera permission; Metro Demo default-on in `__DEV__` (onboarding now forces Live); `20261001` DMs missing post/trade payload; Room theme column still unapplied; Expo Doctor pin skew.

**Remaining pre-beta hardening:** Physical proof of the matrix above; repair only what the iPhone shows; performance; privacy pass; then release readiness. No Slice 9.

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
