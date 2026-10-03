# Web → Native master parity contract

**Status:** read-only specification. No implementation in this pass.  
**Date:** 2026-09-29  
**Tree:** `mobile-native` `bdde759` plus current uncommitted working tree.  
**Sources, in order:** (1) working web implementation, (2) production backend/domain, (3) current native as an attempt.

Native is not done because TypeScript, routes, endpoints, Demo, or cream/pink exist. A capability is done only when presentation, interaction, production contract, persistence, read-back, navigation, intentional empty/loading/error, `npm run mobile:verify`, and physical-device QA all hold.

---

## How to read this contract

The working web app is **one SPA at `/`**. Social UI is a client view-state machine (`worldStore.view`). The 3D Room stays mounted underneath. Public URLs `/@handle` and `/@handle/room` are share surfaces, not the primary IA.

Web has **two simultaneous products**:

| Layer | What the user actually gets |
|-------|-----------------------------|
| **Canonical product UX** | Fixture/local session: `CollectorFeed`, `CollectorSearch`, `CollectorInbox`, `CollectorThread`, `CollectorNotices`, `CollectorProfile`, physical Room + Binder, full onboarding including first collectible and room reveal |
| **Canonical production persistence (auth UUID)** | Holdings, wishlist, media, catalog, follows, posts, likes, comments, room placements, public profile/room, Ask `/api/assistant/v2`. **Not** persisted on web today: messages, notices, feed Discover, post search, repost, share/save, profile avatar in Postgres |

Native must reconstruct the **canonical product UX** against **production persistence**, filling web’s own fixture-only gaps with real contracts rather than shipping fixtures as Live.

Do **not** ship a “mobile-inspired” subset. Do **not** add Seoully Vision. Do **not** put Room in the bottom tab. Do **not** invent a Closet zone: **web has no Closet**. Implemented room zones are shelf, wall, display-case, desk, binder, archive.

---

## 1. Locked information architecture

| Role | Web | Native today | Contract |
|------|-----|--------------|----------|
| Primary tabs | Discover (feed) · Search · Create · Messages · Profile | Feed · Search · Create · Messages · Profile | Same five peers. Native label should match web: first tab is **Discover** (`nav.discover`), action is still the feed. |
| Room | Not a tab. Entered from Profile, Search rooms, Ask, doorway, onboarding reveal, `/@handle/room` | Stack immersive `/room` + `/collector-room`; Profile **Enter Room** | Room is **not** a primary bottom tab. Social tabs disappear inside Room. |
| Notices | Header bell | Header bell + hidden route | Keep off the tab bar. |
| Ask | Floating heart companion | Floating companion | Keep off the tab bar. |
| World vs chrome | Room always mounted; social is overlay; “back” zooms out | Room is a separate stack screen; social is opaque pages | **Replace presentation of the world relationship.** Native may use a separate GL screen for performance, but Profile must still be identity **over the owner’s Room**, not over paper. |

Product loop (web, as implemented): Collect (holding + optional auto-placement) → Room is the home → Profile expresses identity over that room → Discover people/rooms/posts → trade/message in the fixture social layer → add more → edit room → repeat.

Interaction principle (web comments): *Don’t animate the UI. Animate the world.* Native Room currently orbits a Three.js box; web Room is a CSS/DOM world with zone docking, inspect, physical binder pages, doorway light, card flight. That is a **product** difference, not a platform requirement.

---

## 2. Complete web surface inventory

### 2.1 Routes

| Route | Surface |
|-------|---------|
| `/` | Entire product (boot, welcome, onboarding, room + social overlays) |
| `/auth/callback` | OAuth return |
| `/@{handle}` | Public profile |
| `/@{handle}/room` | Public room (read-only unless owner) |

All other user surfaces are `worldStore.view` overlays on `/`.

### 2.2 Auth / onboarding (`OnboardingFlow.tsx`, `WelcomeGate.tsx`, `sessionStore.ts`)

| Beat | Web |
|------|-----|
| Boot | Brand mark |
| Welcome | Heart, Create account / Explore demo / Sign in, language |
| Account | handle, email, password |
| Sign in | email, password |
| Photo | avatar `PhotoPicker` |
| Groups | multi-select fixture groups |
| Bias | members of chosen groups |
| Interests | photocards / albums / merch / everything (UI subset of 7-enum) |
| Collect | Search catalog **or** Add manually |
| Catalog photo + crop | personal copy; photocard crop |
| Manual describe | metadata + optional catalog-share consent |
| Confirm | holding created; **auth also `persistLocalPlacement`** |
| Reveal | “Your room is ready” → enter room, first object focused |
| Meet collectors | suggested people → feed or profile |
| Returning | `sessionStore.boot` → ready + last social view; Room still under |

**Vision:** `visionFile` is cleared, never populated. Identification API is dormant. Catalog/manual only.

### 2.3 Social shell

`SocialShell.tsx` + `social-app.css`: 430px frame, 52px top (BrandMark, language, bell), 58px nav, Create is raised plus (`42×42`, radius 12). Browse surfaces use solid `--s-browse-paper: #fff7fa`. Profile uses `--s-profile-veil: 0.85` over the **already mounted owner Room** (`glimpseOwnerRoom`, room light ×0.52).

### 2.4 Feed

- **Fixture:** Following / Discover toggle; suggested collectors with `computeCompatibility`; like, comment, repost, share→inbox, wishlist-on-tags; empty copy per mode.
- **Production (`ProductionFeed`):** Self + followed posts only. **No Discover toggle. No suggested row.** `ProductionPostCard`: like + comment + video controls. **No repost, share, or save.**

### 2.5 Search (`CollectorSearch.tsx`, `explore.ts`)

Destinations: people, rooms, posts, collectibles, groups & members. Data: **memory-repository even for auth users.** Rooms **Enter** walks through the doorway. Collectibles with an owner open **that collector’s profile**, not Add.

### 2.6 Create (`Composer.tsx`)

Photo or video required. Caption, location, tag people/collectibles. Auth: `POST /api/social/posts`. Fixture: `createPost`.

### 2.7 Messages

`CollectorInbox` / `CollectorThread`: **memory-repository only** (including auth). Text; `postId` share; `templateIds` trade; unread on rows and nav dot; send-to mode when `sharePostId` set.

### 2.8 Profile (`CollectorProfile.tsx`)

Room glimpse + veil. Avatar. Handle, bio, location, type, groups, biases, eras, interests. Counts: posts, followers, following, collected, wishlist. Own: Edit, Add to collection, Sign out, owned rows with personal imagery + trade + remove, wishlist search. Other: Follow, Message, Enter Room, compatibility (`computeCompatibility`), trade columns, `CollectibleMatch`, read-only shelves. Empty copy differs self vs other.

Edit (`EditProfile.tsx`): avatar photo, theme presets, bio, groups, etc. Avatar persistence is **repository/local**, not a production media table.

### 2.9 Collection / collectible

Profile shelves + in-room `InspectPlate` (kind, trade, rarity, message-about-match). Ownership = holding. Placement = separate. Store = unplaced tray, not a second ownership set (`check-fixtures`).

### 2.10 Add collectible

Canonical fork: Search catalog **or** Add manually. Add to Collection creates the holding immediately; web **also** places it in the home zone and, for first item, reveals the room. Catalog completeness does not block ownership.

### 2.11 Notices

Bell → `CollectorNotices`. Fixture `pushNotice` on like/comment/follow/repost/trade. Kinds: like, comment, follow, trade, activity, repost. Trade tap opens thread with templates. **No production table.**

### 2.12 Ask Seoully

Onboarding `HeartScene`; later `SeoullyHeartCompanion` + `AskSeoullyPanel` on web. Native heart companion is the same Ask Seoully assistant (`SeoullyCompanion`). Live: `/api/mobile/assistant` and web `/api/assistant/v2` share `askSeoullyProduction` — server-owned OpenAI (`OPENAI_API_KEY` / `OPENAI_MODEL`), optional tool calling, production registry/DAL for Seoully facts, allowlisted navigation. General K-pop/collector questions do not require a catalog tool. Current-information and price-intelligence tools are not registered. Demo native Ask uses fixture tools for collection data and does not fake OpenAI general chat. Suggested prompts use the same pipeline. Slice 7A places that same heart in immersive Room with safe-area + gutter only (no tab-bar clearance).

### 2.13 Room (web)

Always mounted (`Room.tsx`). Views: arrival, room, zone, inspect, binder, edit. Zones: **shelf, wall, display-case, desk, binder, archive**. Camera springs (`RoomStage`). Edit: drag, undo/redo, store, decor. Doorway traversal. Flagship last-card flight into binder. Public page hydrates projection. Persistence: `roomPersistence.ts` → placements API.

### 2.14 Binder (web)

Closed binder is a **desk object** (`BinderZone`): cover, spine, thickness, completion stamp, hover tilt. Click flies camera in. Open (`OpenBinder`): physical page leaves,  pockets, card pull, ←/→, odd-page partner, set spreads from `listSetProgress`. Not a separate app screen.

---

## 3. Visual parity contract

Native tokens in `apps/mobile/src/theme.ts` are already derived from `social-app.css`. That is **token alignment**, not screen parity.

| Token | Web | Native | Translate? |
|-------|-----|--------|------------|
| Ink | `#2c2e4c` | `colors.ink` | Direct |
| Mute | `#8a7380` | `colors.muted` | Direct |
| Line | `#f3e4e9` | `colors.border` | Direct |
| Paper | `#fffafb` | `colors.surface` | Direct |
| Browse paper | `#fff7fa` | `colors.canvas` | Direct |
| Mist | `#fff1f4` | `colors.mist` | Direct |
| Lilac / deep / action / like | `#f6aebf` / `#c45374` / `#c45374` / `#e56d90` | matching | Direct |
| Profile veil | `--s-profile-veil: 0.85` over **Room** | `PROFILE_VEIL = 0.85` over **paper** | Opacity value yes; **underlay no** |
| Font | Baloo 2 + Noto Sans KR | same Expo fonts | Direct |
| Caption | 14px / 1.4 | `type.body` 14/20 | Close; web 1.4 on 14 = 19.6 |
| Post name | 14px / 600 | `handle` 14/18 semibold | Direct |
| Logo | 20px / 700 | `display` 20/24 | Direct |
| Frame | max 430px centered | full device width | **Adapt:** phone is the frame |
| Top bar | 52px, 16px pad | `sizes.topBar` 52 | Direct |
| Tab bar | 58px + safe area | `sizes.tabBar` 58 + insets | Direct |
| Tab hit | 48×48 r14 | `sizes.tab` 48, `radii.nav` 14 | Direct |
| Create | 42×42 r12 raised | `sizes.create` 42, `radii.create` 12 | Direct |
| Post media | r14, 4/3 | `mediaRadius` 14 | Direct; confirm 4/3 in native post |
| Action buttons | 40×40 circle | `iconButton` 40 | Direct |
| Search input | 44px r14 | `control` 44, `radii.input` 14 | Direct |
| Enter Room | min-height 44, r12 | buttons exist | Match `.s-enter` hierarchy |
| Card shadow | `--s-card` 8/18 at 5% | `elevation.card` | Approximate RN shadow |
| Sticky compose/edit top | CSS sticky | native headers | Adapt |
| Thread | full-bleed overlay z80 | `/thread` stack | Adapt: full-screen is OK |
| Room under social | live 3D, light ×0.52 | paper | **Must change** |
| Binder | physical 3D object in room | 2D spread UI | **Must change** (platform can keep touch paging, not a flat “album app”) |

Do not call screens equivalent because both are cream and pink.

---

## 4. Interaction parity (selected)

Format: action → web → native → gap.

### Feed post

| Action | Web fixture | Web production | Native Demo | Native Live | Gap |
|--------|-------------|----------------|-------------|-------------|-----|
| Like | `likePost` + notice | `post_likes` | memory | `PUT /like` | Live matches **production web**, not fixture notices |
| Comment | `addComment` + notice | `post_comments` | memory | comments API | Same |
| Repost | persisted + notice | **absent** | memory `{persisted:true}` | `{persisted:false}` UI still tappable | **FAKE PARITY** vs both: fixture needs persist; production web has no control |
| Share | opens Send to with `postId` | **absent** | memory send | throws | **FAKE** vs fixture; extra vs production web |
| Save | wishlist tagged templates | **absent** | varies | no-op | **FAKE** |
| Video | playback | `<video controls>` | overlay | overlay | Native lacks playback |

### Profile

| Action | Web | Native | Gap |
|--------|-----|--------|-----|
| Open profile | `glimpseOwnerRoom` + veil | paper + veil | Underlay |
| Enter Room | doorway / travel, room was already there | `/room` or `/collector-room` | Separate world; own GET blocked by `theme_id` |
| Add collectible | `openCollect()` full onboarding collect | `/collect` | No reveal, no auto-place |
| Follow | fixture or `follows` | `PATCH` collector | Live OK for persist |
| Owned expand | real rows + media + trade/remove | own: yes; other Live: count + `[]` | **FAKE** other |
| Compatibility | domain engine on fixture graph | Demo domain / Live people+trade | Dual engines (do not merge) |
| Message | thread with optional templates | `ensureConversation` or honest block | Schema |
| Edit avatar/theme | PhotoPicker + presets | text fields only | Avatar/theme not production |

### Search

| Action | Web | Native Live | Gap |
|--------|-----|-------------|-----|
| People | fixture people → profile | production UUID → `/collector` | Native **more** real; UX OK |
| Rooms | Enter doorway | `/collector-room` | No doorway; Demo wrongly goes `/collector` |
| Posts | fixture search | `[]` | **FAKE** dest |
| Collectibles | open **owner profile** | `/add` your copy | Different product action |
| Entities | re-search people by name | same idea from catalog hits | Live IDs are UUIDs, nav uses name |

### Add collectible

| | Web | Native |
|--|-----|--------|
| Holding moment | `createHolding` then local add | `POST /holdings` first | Same hard rule |
| Then | place in home zone; first item → reveal | optional photo; no place; `/collectible` | Missing place + reveal |
| Manual consent | contribution + reference | same APIs | Aligned |
| Vision | not in UI | not in UI | Aligned (keep removed) |

### Room / Binder

| Action | Web | Native | Gap |
|--------|-----|--------|-----|
| Place/move | drag in edit, persist placement | edit drag/rotate/scale PUT | Own GET blocked; no CSS zone world |
| Store | `storeHolding` unplaced | strip of unplaced | Concept OK |
| Undo/redo | yes | no | Missing |
| Open binder | camera into object | `/binder` screen | Separate app |
| Page turn | physical leaf | spread index + AsyncStorage | Different object |
| Card flight | last card of set | none | Missing |
| Public visit | doorway + same room | orbit read-only | Reduced |

### Messages / notices / Ask

Covered in connectivity audit: web fixture-complete; native Live empty/blocked/lossy.

---

## 5. Backend parity (verified against repo + `docs/native-backend-connectivity-audit.md`)

| Capability | Code |
|------------|------|
| Auth, session, onboarding step | **A** same (native onboarding picker is still fixture slugs) |
| Own holdings/wishlist/media/catalog contribute | **A** |
| Follow, like, comment, create image post, following feed | **A** (matches production web, not fixture feed) |
| Pair match | **B** native `/match` wraps same people+trade services as web APIs |
| Ask Live | **B** `/api/mobile/assistant` vs web `/api/assistant/v2` — same registry/DAL, different transport |
| Public collector shelves | **C** summary count only |
| Discover feed | **E** native stub; **E** on production web too |
| Search posts / web search in general | Web **D** fixture; native posts **E**, people/catalog **A** |
| Messages | Native **E/blocked**; web **D** fixture (`postId` + `templateIds` in memory) |
| Notices | **D** web; **E** native Live |
| Repost/save | **D** web fixture; **E** production both |
| Avatar | **D** web local; **E** native Live |
| Own Room GET | **C** placements exist; current DAL requires unapplied `theme_id` |
| Public Room | **A/B** RPC works; theme/holding id mismatch |
| DigitalRepresentation | **B** computed, not a table — same idea as web `representation.ts` |

---

## 6. Capability matrix (web is spec)

Columns: Capability | Web UX | Web data | Native UX | Native data | Backend | Exact gap | Required work

### Auth / onboarding

| Capability | Web UX | Web data | Native UX | Native data | Backend | Exact gap | Required |
|------------|--------|----------|-----------|-------------|---------|-----------|----------|
| Welcome / explore demo | Heart gate + local Soo | session | Sign-in screen; Demo toggle in `__DEV__` | — | Auth | No welcome heart / explore-as-Soo | Rebuild onboarding chrome from `WelcomeGate` |
| Sign in / up | forms | Auth | email/password | Auth | **A** | Deep link unproven | Device QA |
| Avatar beat | PhotoPicker | local profile | **absent** | — | **E** | No avatar | Schema+upload **or** skip until Profile slice includes it |
| Groups / bias / interests | full beats | profiles + fixture IDs | same steps, no heart scene | PATCH onboarding | **A** with slug IDs | No photo/collect/reveal/meet | Extend native onboarding to web beats |
| First collectible | collect flow + place + reveal | holding + placement | not in onboarding | — | holdings exist | First room intro missing | Slice 8 |
| Returning | boot under room | session | tabs if `onboarding_step=done` | session | **A** | Room not under chrome | Slice 7 |

### Feed

| Capability | Web UX | Web data | Native UX | Native data | Backend | Exact gap | Required |
|------------|--------|----------|-----------|-------------|---------|-----------|----------|
| Tab label | Discover | — | Feed | — | — | Copy/IA | Rename to Discover |
| Following posts | fixture or production | memory / `getProductionFeed` | `SeoullyFeedPost` | `/feed` | **A** | Extra actions vs production web | Hide unevidenced actions in Live |
| Discover posts | fixture filter | memory | toggle | `[]` | **E** | Empty tab looks real | Hide until query exists **or** implement |
| Suggested | fixture compat | domain | Live discovery API | `/discovery/collectors` | **A** native, **E** production web | Native ahead of production web | Keep Live; don’t claim web production parity |
| Like/comment | both worlds | memory / SQL | both | SQL | **A** | Notices only fixture | OK for persist |
| Repost/share/save | fixture only | memory | shown | stub | **E** | FAKE | Remove Live controls or persist |

### Search

| Capability | Web UX | Web data | Native UX | Native data | Backend | Exact gap | Required |
|------------|--------|----------|-----------|-------------|---------|-----------|----------|
| Destinations | 5 explore cards | memory | same 5 | mixed | mixed | Posts empty; rooms dest Demo≠Live; collectible opens Add not owner | Match web result **actions**; production data |
| Filters | dest chips | — | dest chips | — | — | OK | Density pass vs `.s-explore-*` |

### Create

| Capability | Web UX | Web data | Native UX | Native data | Backend | Exact gap | Required |
|------------|--------|----------|-----------|-------------|---------|-----------|----------|
| Image post | required media, tags | posts | image, caption | `/posts` | **A** | No video, weaker tagging | Video later; tags if web auth has them |
| Collectible entry | Profile/Ask `openCollect` | holdings | `/collect` | holdings | **A** | Not the composer | Keep fork out of Create tab (web does too) |

### Messages

| Capability | Web UX | Web data | Native UX | Native data | Backend | Exact gap | Required |
|------------|--------|----------|-----------|-------------|---------|-----------|----------|
| Inbox/thread/unread | full | memory `postId`+`templateIds` | screens | `/messages` | unapplied body-only SQL | FAKE if we imply it works | Revised schema then one comms slice |
| Send to | inbox mode | memory | `/send-to` | throws Live | **E** | UI without delivery | Same slice |
| Trade message | thread highlight | memory | stub copy | — | **E** | — | Same |

### Profile

| Capability | Web UX | Web data | Native UX | Native data | Backend | Exact gap | Required |
|------------|--------|----------|-----------|-------------|---------|-----------|----------|
| Room underlay | live room + 0.85 veil, opaque chrome | placements | paper + 0.85 veil | none | Room exists | Not the same product | Wire real room (read-only) |
| Own shelves | rows + media + trade/remove | holdings | Live: yes | holdings | **A** | Visual density vs `ObjectTile` | Presentation pass |
| Other shelves | rows | memory **and** production sync for auth | Live: count, `[]` rows | summary RPC | **C** | FAKE | Public list contract |
| Avatar | shown | local | initials Live | — | **E** | — | Don’t fake photos |
| Compatibility | domain + trade UI | memory | Demo domain; Live people+trade | `/match` | **B** | Scores incomparable | Label engine; keep both |
| Enter Room | stay in world | room | new route | room API | blocked own | — | After Room GET |

### Add / collection / catalog

| Capability | Web UX | Web data | Native UX | Native data | Backend | Exact gap | Required |
|------------|--------|----------|-----------|-------------|---------|-----------|----------|
| Search → holding | yes | catalog+holdings | yes | same | **A** | No auto-place/reveal | After Room |
| Manual + consent | yes | contribution+ref | yes | same | **A** | Demo blocks writes | Keep |
| Catalog searchability | community templates | search_text | public GET | same | **A** | colorway unused | Ignore colorway |
| Vision | removed | dormant API | removed | — | — | Keep removed | — |

### Notices / Ask

| Capability | Web UX | Web data | Native UX | Native data | Backend | Exact gap | Required |
|------------|--------|----------|-----------|-------------|---------|-----------|----------|
| Bell list | fixture kinds + dest | memory | Demo list; Live empty banner | stub | **E** | FAKE Live | Table or disable Live bell |
| Ask tools | v2 OpenAI + DAL tools | DAL / memory | Live OpenAI + DAL; Demo fixtures | `/assistant` | **B** | General chat + allowlisted nav + bounded history | Device QA |
| Ask motion | heart scene + corner | CSS | FAB | RN | — | Personality thinner | Rebuild from `heart-companion.css` |

### Room / Binder

| Capability | Web UX | Web data | Native UX | Native data | Backend | Exact gap | Required |
|------------|--------|----------|-----------|-------------|---------|-----------|----------|
| Continuous world | yes | placements | GL room screen | GET blocked | placements **A**, theme **blocked** | Not under social; not CSS world | Rebuild relationship + fix GET |
| Zones | 6 kinds | zone ids | simplified furniture + surfaces | same tables | **A** | No closet (good); missing zone UX | Match web zones |
| Binder | in-room object | photocards + sets | 2D `/binder` | holdings | **A** data | Wrong object | In-room binder |
| Public room | doorway + hearth from owner | RPC | orbit, hardcoded hearth | RPC | **A** | holding id = placement id | Fix contract |
| Edit undo | yes | repo | no | — | — | — | After place works |

---

## 7. Fake parity (priority defects)

These make native look more complete than it is.

1. **Discover feed tab** — renders; Live returns `[]`. Production web does not even show the toggle.
2. **Repost** — tappable; Live not persisted; production web has no control.
3. **Save** — control; Live no-op.
4. **Send to** — full screen; Live `messages_unavailable`.
5. **Messages tab** — inbox UI; tables unapplied → error/empty.
6. **Trade Message** — CTA; `void templateIds`.
7. **Notifications bell** — badge path; Live unread 0, empty list.
8. **Public Owned/Wishlist** — `holdingCount` with `holdings: []`.
9. **Profile Room** — veil contract copied; underlay is paper, not Room.
10. **Ask search cards** — look navigable; query/destination dropped.
11. **Demo Collection/Binder/Room/Messages** — Demo mode still hits Live `api.ts`.
12. **Onboarding “done”** — tastes only; web continuing into collect/reveal is skipped.
13. **Live suggested collectors** — real discovery (good) sitting on a feed that implies Discover works.
14. **Binder as a complete photocard product** — data is real; it is not the web binder object.
15. **Own Room route existing** — renderer exists; GET selects unapplied `theme_id`.

---

## 8. Keep / repair / replace (native modules)

| Module | Class | Why |
|--------|-------|-----|
| Tab IA (Room not a tab; hidden notices/send-to) | **KEEP** | Matches web |
| Bearer `/api/mobile/*`, ALS Ask, holdings/wishlist/media/catalog, follow/like/comment/posts | **KEEP** | Correct production spine |
| `SocialRepository` Demo vs Live split | **KEEP** | Honesty architecture |
| `theme.ts` token map, Baloo/Noto, tab metrics | **KEEP** | Visual system start |
| PhotocardCropper + holding media | **KEEP** | Matches collect photo |
| `/match` + `SeoullyTradeMatch` | **KEEP** | Repair copy/density only |
| Companion mount + hide on auth/thread | **KEEP** | Repair motion/nav |
| `production.ts` empty public shelves, Discover stub, sendShare throw, notices empty | **REPAIR** | Stop lying; then fill contracts |
| `rooms.ts` `theme_id` select | **REPAIR** | Unblock GET without fake theme persist |
| Feed post actions in Live | **REPAIR** | Match production web until comms exist |
| Search collectible destination | **REPAIR** | Web opens owner; native opens Add |
| Profile/collector presentation | **REPLACE PRESENTATION** | Same data (own) but not web hierarchy/glimpse |
| Native Room R3F vs web CSS world | **REPLACE PRESENTATION** | Keep GL if it can express zones/binder/inspect; do not keep “orbit a crate” as the product |
| Binder screen | **REPLACE PRESENTATION** | Data KEEP; object must live in Room |
| Onboarding | **REPLACE PRESENTATION** | Keep PATCH tastes; rebuild beats from web |
| Paper `SeoullyRoomUnderlay` | **REPLACE IMPLEMENTATION** | Conflicts with web identity-over-room |
| Pending `20261001` as final comms | **REPLACE IMPLEMENTATION** | Conflicts with web `sendMessage({ postId, templateIds })` |
| Fixture slug tastes as catalog groups | **REPAIR** | Conflicts with people-engine UUIDs |
| Seoully Vision | **KEEP REMOVED** | Web collect UI does not use it |

Sunk cost is irrelevant.

---

## 9. Demo vs Live (do not confuse)

Example **Minji / other collector:**

| | Demo | Live |
|--|------|------|
| Shelves | full rows, imagery, trade | count, empty lists |
| Compatibility | domain 65% fixture story | people engine + trade DTO |
| Message | honest block | API error |
| Enter Room | honest block | `/collector-room` (public RPC) |
| Avatar/theme | fixture | none |

**PARITY STATUS: NOT ACHIEVED** for other-collector identity.

Own Live collection (holdings/wishlist/trade/remove) is the rare place Live is **closer** to production web than Demo. Search people/catalog Live is **more production** than web search (still fixture). That is not license to treat Demo Feed/Inbox/Notices as Live.

---

## 10. Migration reality (do not apply)

| Migration | Parity effect |
|-----------|----------------|
| `20260930` onboarding_step | **Applied.** Enables native taste beats only — not web collect/reveal. |
| `20261001` DMs | Unapplied. Body-only. **Cannot** reproduce web Send to (`postId`) or trade (`templateIds`) or unread. Must revise before approval. |
| `20261002` `rooms.theme_id` | Unapplied. Current DAL already selects it → own Room load fails. Needed for theme persist; placements already exist without it. |

Web messages never used these tables. Native must not treat “web has inbox” as “body-only SQL is enough.”

Recommended comms shape (specification only): text + `kind` + `post_id` + template/holding attachments + participant `last_read_*`. Notices are a separate table (web `pushNotice` kinds).

---

## 11. Definition of done (repeated)

1. Native presentation reproduces the web experience (not a cousin).  
2. Interaction reproduces web product behavior (or an explicit platform adaptation).  
3. Real production contract.  
4. Writes persist.  
5. Read-back.  
6. Navigation.  
7. Intentional loading/error/empty.  
8. `npm run mobile:verify` passes.  
9. Physical iPhone proves the journey.

---

## 11b. Slice 7 physical lock

Physical iPhone QA after the native slices proved Room is useful but not product-parity. **KEEP THE ENGINE, REBUILD THE EXPERIENCE** (R3F, Expo GL, RoomPlacement DAL, representation, media, focus, Binder data, persist/rollback, public security). `20261002000000_native_room_theme.sql` stays unapplied until Slice 7D review. There is **no Closet**.

Decomposition:

- **7A** — immersive Room + touch camera. Physically accepted after CAMERA/SHELL REPAIR 04 (`7dbc60d`): Room is not a bottom tab; social tabs disappear inside Room; swipe-back disabled on Room routes only; world replaces zone-pill navigation; one-finger pan across the Room (window, not miniature fit); pinch dolly; object inspection restores prior framing; heart is the existing Ask Seoully. One known defect remains: a thin **slanted** sliver can appear below the floor at some framings. **DEFERRED TO 7D** — world envelope / visual reconstruction. 7D acceptance: no permitted camera framing may expose unfinished world/exterior/native shell. Do not chase it by changing the accepted 7A camera.
- **7B** — touch-first direct object manipulation. **Physically verified** on iPhone (`1916f58`); interaction frozen. Locked gestures: normal Room tap = inspect, empty drag = pan, pinch = dolly; Edit Room empty drag = pan, pinch = dolly, long-press object = acquire, drag acquired object = move object, valid release = settle/persist RoomPlacement, invalid release = return origin. Arbitrary user scaling and Turn left/right are no longer primary editing interactions. Entrance title is an overlay over the arriving world, not a splash that gates Canvas mount. **Known temporary defect:** legacy Stored tray has layering/layout problems, including the search field being obscured by collectible cards. Do not polish the legacy tray; replace it during world-storage implementation. World-storage / merch-box reconstruction is **NEXT** — not started.
- **7C** — Binder as part of the world. Not started.
- **7D** — materials / lighting / world envelope / customization. Not started. Owns the deferred 7A slanted floor sliver.
- **7E** — physical integration QA. Not started.

See `docs/native-road-to-ship.md` Slice 7.

Live Profile Appearance remains a Slice 7 contract gap: Demo can theme Profile controls and the focused Profile tab bar from fixture `appearance` + room; production mobile APIs have no appearance field, and `20261002` is unapplied. Repair 01 follow-up themes native Profile (and Profile-tab chrome only) from whatever `SocialTheme` the current DAL already returns. Collector theme must not leak into Discover.

---

## 12. Validation this pass

| Check | Result |
|-------|--------|
| `npm run check:fixtures` | Passed |
| `npm run mobile:verify` | **Failed** Expo Doctor: `expo 57.0.25` vs `~57.0.26` (also `expo-constants`, `expo-router`) |
| Implementation | None |

Execution plan: `docs/native-road-to-ship.md`.
