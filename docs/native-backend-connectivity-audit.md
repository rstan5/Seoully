# Native backend & functional connectivity audit

**Scope:** read-only. No UI, API, schema, RLS, or production-data changes.  
**Tree:** `mobile-native` at `bdde759` plus the current uncommitted working tree (companion, notices, Send to, match API, holdings DELETE, import-boundary gate).  
**Date:** 2026-09-29.  
**Physical device:** not available this pass. Nothing is marked **PROVEN CONNECTED**.

Status key:

| Status | Meaning |
|--------|---------|
| **CONNECTED BUT UNPROVEN ON DEVICE** | Native → API → DAL → persisted store → read-back exists and contracts appear aligned. Never physically executed on iPhone. |
| **PARTIALLY CONNECTED** | Some production layers exist; a required layer is missing, stubbed, or mismatched. |
| **DEMO/LOCAL ONLY** | Works through `__DEV__` fixtures / in-memory repository, or local-only state (AsyncStorage). |
| **BLOCKED BY SCHEMA** | Implementation exists; required production schema is not applied (or current DAL requires an unapplied column). |
| **NOT BUILT** | No complete implementation on the native → production path. |

A route, component, or TypeScript compile is not treated as functional.

---

## 1. Executive summary

The native app has a real production boundary: bearer-authenticated `/api/mobile/*` (plus public `/api/catalog/search`) talking to Supabase via RLS-scoped DAL. Demo is `__DEV__`-only (`useSocialRepository` → `demo/repository.ts`). Production builds use `productionRepository`.

**What is genuinely wired (code-complete, unproven on device):**

- Email/password sign-in, SecureStore session restore, sign-out, auth-code deep-link exchange
- Bearer session identity (`GET /api/mobile/session` → `ensure_current_seoully_identity`)
- Onboarding progress (`profiles.onboarding_step`; migration `20260930000000` is applied)
- Own holdings / wishlist CRUD, trade status, holding delete
- Add-to-collection: catalog search → `POST /api/mobile/holdings` **creates a Holding immediately** (photo optional)
- Manual catalog contribution + optional consented catalog reference image
- Personal holding media upload to private `collectible-media`
- Following feed, like, comment, image post create, collector posts, follow/unfollow
- People search, collectible search, room discovery search, suggested collectors
- Live Ask Seoully: `POST /api/mobile/assistant` → bearer ALS → production tools (no fixture social data)
- Pair compatibility + trade intel via `GET /api/mobile/collectors/:id/match` (`graph_pair_snapshot` + `computeCompatibilityPeople` + `computeTradeOpportunity`)
- Own Binder grouping from production holdings (release/group keys; no separate catalog-set table)
- Public Room **read** via `get_public_room_by_handle` (does not require `theme_id`)

**What only looks connected:**

- Discover feed tab (UI live; production returns `[]`)
- Repost (optimistic UI; production `{ persisted: false }`; no table)
- Save/bookmark (no-op)
- Notifications bell (always empty / `persisted: false` in Live)
- Send to (recipient search works; delivery throws `messages_unavailable`)
- Public collector Owned/Wishlist shelves (count may be non-zero; lists hardcoded `[]`)
- Profile “Room” underlay (theme paper + 85% veil, not `NativeRoomRenderer`)
- Messages tab (calls production API; tables not applied → error empty state)
- Own Room editor (DAL `SELECT theme_id` against unapplied `20261002000000`)
- Ask cards that navigate to search (query/destination dropped)
- Compatibility scores (Demo uses `computeCompatibility`; Live uses `computeCompatibilityPeople` — same UI, different math)

**Demo/local-only:** full social world (feed Discover, notices, reposts, Send-to memory, Ask over fixtures, collector holdings/wishlist/avatar/theme). Several **Live screens still hit `api.ts` even in Demo** (`collection.tsx`, `collectible.tsx`, `messages.tsx`, `room.tsx`, `binder.tsx`).

**Blocked by schema:** direct messages (`20261001000000` unapplied); own Room GET/theme (`20261002000000` unapplied, but current DAL already selects/writes `theme_id`).

**Not built:** avatars, production notifications, Discover feed query, post search, reposts, save, OS share, public collector holding/wishlist lists, trade-message prefill, unread/read receipts, notification→navigation, catalog merge/correction UI, Seoully Vision (correctly absent).

**Verification this pass (no production writes):**

| Check | Result |
|-------|--------|
| `npm run check:fixtures` | Passed (canonical Demo `computeCompatibility` 65% Soo↔Minji) |
| `apps/mobile` `tsc --noEmit` | Passed |
| `expo lint` | Passed |
| `npm run mobile:verify` | **Failed** at Expo Doctor: patch skew `expo 57.0.25` vs expected `~57.0.26` (also `expo-constants`, `expo-router`) |
| DEV iOS Metro export | 1952 modules; includes Demo Ask graph + fixture assets |
| production iOS export | 1756 modules; no `minji.png` / `public/avatars` / `public/posts` |
| production Android export | 1836 modules; same fixture-asset exclusion |
| Authenticated production GET | **Not invoked** (no secret-safe session exercise without risking identity leakage) |

---

## 2. Architecture map

```
apps/mobile (Expo SDK 57 / RN 0.86 / Expo Router)
  app/index.tsx              → supabase-js Auth (direct)
  app/_layout.tsx            → session restore, Linking code exchange, SeoullyCompanion
  app/(tabs)/*               → Feed, Search, Create, Messages, Profile (+ hidden notices, send-to)
  stack screens              → collector, collectible, collect, add, edit-profile, onboarding,
                               thread, collection, collector-room, room, binder
  src/supabase.ts            → SecureStore session
  src/api.ts                 → bearer fetch to EXPO_PUBLIC_API_URL
  src/data/index.ts          → useSocialRepository()
       ├─ __DEV__ && demo    → demo/repository.ts (fixtures + computeCompatibility)
       └─ else               → production.ts → api.ts
  src/room/*                 → NativeRoomRenderer, representationForHolding (client-side DigitalRepresentation)
  src/binder/*               → photocard spreads from NativeHolding[]
  src/media/*                → PhotocardCropper, signed-URL cache

Next.js API
  /api/mobile/*              → createSupabaseBearerClient(Authorization: Bearer)
  /api/catalog/search        → public (anon RLS), no bearer

src/server
  dal/{profile,holdings,wishlist,catalog,media,social,rooms,messages,discovery,collection-graph*}
  compatibility/service.ts   → computeCompatibilityPeople
  trade/service.ts           → computeTradeOpportunity
  discovery/service.ts       → discoverCollectors / discoverRooms
  assistant/{service,registry}.ts + request-client ALS for bearer Ask
  supabase/bearer.ts, request-client.ts

src/domain
  compatibility.ts           → computeCompatibility (Demo / web memory-repository only)
  fixtures/*                 → Demo + Live onboarding picker (GROUPS/MEMBERS slug IDs)
  representation.ts          → web DigitalRepresentation (kind-derived; not a DB table)

Supabase (applied through 20260930)
  auth.users → trigger provision_seoully_identity → users, profiles
  holdings, wishlist_entries, collectible_templates, catalog_{groups,members,releases,contributions}
  media_assets + bucket collectible-media
  rooms, room_placements
  posts, post_media, post_likes, post_comments, follows
  graph_pair_snapshot / discovery RPCs
  Storage: collectible-media (private), catalog-reference-images, post-media

Unapplied local migrations
  20261001000000_direct_messages.sql
  20261002000000_native_room_theme.sql
```

### Bearer boundary

Every `/api/mobile/*` handler uses `createSupabaseBearerClient(request)` and returns 401 without a token. DAL calls pass that client so RLS sees `auth.uid()` / `current_seoully_user_id()`.

Ask is special: `runWithSupabaseClient(client, () => askSeoullyProduction(body))` so `getCurrentIdentity()` and registry tools resolve `requestSupabaseClient()` instead of cookie SSR. That path is correctly bearer-bound.

Catalog search is **not** on the bearer boundary: native `searchCatalog` GETs `/api/catalog/search` with no `Authorization`. RLS `collectible_templates_public_read` allows anon select where `status <> 'restricted'`.

### Demo vs Live switch

`apps/mobile/src/data/mode.tsx`: Demo allowed only when `__DEV__`. Production binaries throw `demo_world_forbidden` if Demo is requested.

**Bypass:** several screens import `api.ts` directly and always talk to production if a session + `EXPO_PUBLIC_API_URL` exist.

### DigitalRepresentation

There is **no** `digital_representations` table. Native Room/Binder compute `representationForHolding(holding)` from `template.kind` + optional `personalMediaUrl`. Ownership is the `holdings` row. Placement is a separate `room_placements` row. Binder is a view over photocard holdings.

### Config trap

`mobileConfig.isConfigured` is true when only Supabase URL + publishable key exist. `EXPO_PUBLIC_API_URL` is required for almost every product call and is **not** part of that gate. Sign-in can succeed while identity/collection/feed all fail silently or error.

---

## 3. Capability status matrix

| Capability | Status | Production persistence | Notes |
|------------|--------|------------------------|-------|
| Sign in | CONNECTED BUT UNPROVEN ON DEVICE | Auth + provision trigger | Direct supabase-js |
| Session restore | CONNECTED BUT UNPROVEN ON DEVICE | SecureStore | |
| Sign out | CONNECTED BUT UNPROVEN ON DEVICE | Auth | |
| Auth-code deep link | CONNECTED BUT UNPROVEN ON DEVICE | Auth | `exchangeCodeForSession` |
| Bearer `/api/mobile` | CONNECTED BUT UNPROVEN ON DEVICE | | Fails closed without token |
| Current-user identity | CONNECTED BUT UNPROVEN ON DEVICE | `users`/`profiles` | `GET /session` |
| Onboarding progress | CONNECTED BUT UNPROVEN ON DEVICE | `profiles.onboarding_step` | Applied `20260930`; picker is **fixture IDs** |
| Load own profile | CONNECTED BUT UNPROVEN ON DEVICE | | Identity + holdings + posts + counts |
| Edit profile text | CONNECTED BUT UNPROVEN ON DEVICE | `PATCH /profile` | |
| Avatar | NOT BUILT | | Live forces `avatarUrl` undefined |
| Favorite groups / biases | PARTIALLY CONNECTED | `profiles.*_ids` | Slug IDs from fixture catalog, not `catalog_groups` UUIDs |
| Eras | NOT BUILT (native UI) | column exists | `production.ts` sets `eras: []` |
| Collector metadata | CONNECTED BUT UNPROVEN ON DEVICE | profiles | |
| Own collection counts | CONNECTED BUT UNPROVEN ON DEVICE | `holdings` length | |
| Follower/following counts | CONNECTED BUT UNPROVEN ON DEVICE | `follows` | |
| Public collector profile | PARTIALLY CONNECTED | profiles + follows + posts | Holdings/wishlist lists empty |
| Follow/unfollow | CONNECTED BUT UNPROVEN ON DEVICE | `follows` | |
| Compatibility (Live) | CONNECTED BUT UNPROVEN ON DEVICE | derived RPC | People engine + trade service |
| Compatibility (Demo) | DEMO/LOCAL ONLY | | Domain engine |
| Load own holdings | CONNECTED BUT UNPROVEN ON DEVICE | `holdings` | |
| Load own wishlist | CONNECTED BUT UNPROVEN ON DEVICE | `wishlist_entries` | |
| Add/remove wishlist | CONNECTED BUT UNPROVEN ON DEVICE | POST/DELETE wishlist | |
| Holding trade status | CONNECTED BUT UNPROVEN ON DEVICE | PATCH holdings | |
| Remove holding | CONNECTED BUT UNPROVEN ON DEVICE | DELETE holdings | Profile tab; not collection screen |
| Collectible detail | CONNECTED BUT UNPROVEN ON DEVICE | GET holdingId | |
| Personal image get/replace | CONNECTED BUT UNPROVEN ON DEVICE | `media_assets` | |
| Add via catalog search | CONNECTED BUT UNPROVEN ON DEVICE | holdings insert | Holding first, photo optional |
| Add manually | CONNECTED BUT UNPROVEN ON DEVICE | contribution RPC + holding | |
| Catalog consent image | CONNECTED BUT UNPROVEN ON DEVICE | `catalog_reference_images` | Requires contribution row |
| Production catalog search | CONNECTED BUT UNPROVEN ON DEVICE | templates | Public GET |
| Groups/members search (Live) | PARTIALLY CONNECTED | derived from catalog hits | No dedicated entity API |
| Catalog merge/correction | NOT BUILT | | Not exposed |
| Following feed | CONNECTED BUT UNPROVEN ON DEVICE | posts + follows | Includes self |
| Discover feed | NOT BUILT (Live) | | `production.loadFeed("discover")` → `[]` |
| Create image post | CONNECTED BUT UNPROVEN ON DEVICE | posts + post-media | Demo writes blocked |
| Like/unlike | CONNECTED BUT UNPROVEN ON DEVICE | `post_likes` | |
| Comments | CONNECTED BUT UNPROVEN ON DEVICE | `post_comments` | |
| Repost | DEMO/LOCAL ONLY | | Live `{ persisted: false }` |
| Share / Send to delivery | PARTIALLY CONNECTED | | UI + people search; Live send throws |
| Suggested collectors | CONNECTED BUT UNPROVEN ON DEVICE | discovery RPC | |
| Collector posts | CONNECTED BUT UNPROVEN ON DEVICE | posts | |
| Video posts | PARTIALLY CONNECTED | DAL allows; UI images-only | No playback |
| Search people | CONNECTED BUT UNPROVEN ON DEVICE | profiles ilike | UUIDs match `/collector` |
| Search rooms | PARTIALLY CONNECTED | discovery + people | Live → `/collector-room`; Demo → `/collector` |
| Search posts | DEMO/LOCAL ONLY | | Live `[]` |
| Search collectibles | CONNECTED BUT UNPROVEN ON DEVICE | catalog | Live add → `/add` |
| DM inbox/thread/send | BLOCKED BY SCHEMA | | Code exists; tables unapplied |
| Unread / receipts | NOT BUILT | | Absent from pending SQL |
| Trade-message CTA | NOT BUILT | | Stub; no template context |
| Notifications | DEMO/LOCAL ONLY | | No production table |
| Ask Seoully Live | CONNECTED BUT UNPROVEN ON DEVICE | production DAL | Context always `{ surface: "home" }` |
| Ask navigation fidelity | PARTIALLY CONNECTED | | Search query dropped |
| Own Room load/place | BLOCKED BY SCHEMA | placements exist | DAL requires `theme_id` |
| Public Room load | CONNECTED BUT UNPROVEN ON DEVICE | RPC | Hardcoded hearth; placement id ≠ holding id |
| Room theme persist | BLOCKED BY SCHEMA | | Unapplied column |
| Profile → Enter Room | PARTIALLY CONNECTED | | Demo blocked; Live `/room` then blocked by theme select |
| Binder | CONNECTED BUT UNPROVEN ON DEVICE | holdings + media | Own photocards only |
| Camera/crop/upload | CONNECTED BUT UNPROVEN ON DEVICE | | Demo writes blocked |

---

## 4. Detailed capability traces

### 4.1 Auth / account

```
index.tsx
  supabase.auth.signInWithPassword | signUp
  → routeAfterAuth() → GET /api/mobile/onboarding
_layout.tsx
  supabase.auth.getSession()
  Linking url with code= → exchangeCodeForSession
profile/edit-profile
  supabase.auth.signOut() → /
api.ts resolveNativeIdentity
  GET /api/mobile/session + Bearer
  → getCurrentIdentityFromClient → RPC ensure_current_seoully_identity
  → users (active) + profiles
```

**Onboarding:** `GET/PATCH /api/mobile/onboarding` reads/writes `profiles.onboarding_step`, `favorite_group_ids`, `bias_member_ids`, `collector_interests`. Picker options are `GROUPS`/`MEMBERS` from `src/domain/fixtures/catalog.ts` (slug ids such as `skz`, `skz-hyunjin`). PATCH rejects IDs not in that fixture set.

**Hard rule check (identity):** Auth is real. Seoully rows depend on the provision trigger + `ensure_current_seoully_identity`.

### 4.2 Profile

**Own profile** (`(tabs)/profile.tsx`):

- Live: `loadIdentity` + `loadFollowCounts` + `loadCollectorPosts` + `loadMyHoldings` + `loadMyWishlist` + `loadNativeOnboarding` (names for chips). Avatar explicitly cleared.
- Demo: `loadCollector` fixture including avatar, theme, full shelves.

**Edit:** `PATCH /api/mobile/profile` → `updateCurrentProfile` (displayName, tagline, bio, location). No GET `/profile`. No avatar upload. Tastes via `/onboarding?edit=1`. Demo save blocked.

**Public collector** (`collector.tsx` → `production.loadCollector`):

```
GET /api/mobile/collectors/:userId     → getPublicProfile + getFollowState
GET /api/mobile/collectors/:userId/posts
GET /api/mobile/collectors/:userId/match  (optional)
GET /api/mobile/onboarding               (viewer's fixture catalog to name chips)
PATCH /api/mobile/collectors/:userId { following }
```

`production.ts` sets `holdings: []`, `wishlist: []`, `eras: []`, and `holdingCount` from `collectionSummary.holdingCount`. UI can show a collected count with empty Owned/Wishlist shelves.

`getPublicProfile` does not return avatar. `roomAvailable` is true when `get_public_room_by_handle` returns a room object (`collection_public`).

**Follow:** `follows` upsert/delete. RLS owner-scoped.

### 4.3 Collection

```
GET    /api/mobile/holdings?offset&limit     listMyHoldings
GET    /api/mobile/holdings?holdingId=       getMyHolding
POST   /api/mobile/holdings { templateId }   createMyHolding
PATCH  /api/mobile/holdings { holdingId, tradeStatus }
DELETE /api/mobile/holdings { holdingId }
GET/POST/DELETE /api/mobile/wishlist
```

DAL: `src/server/dal/holdings.ts`, `wishlist.ts`. Tables: `holdings`, `wishlist_entries`, joins to `collectible_templates` + catalog names + signed `media_assets`.

`createMyHolding` inserts as soon as the template exists and is not `restricted`. Catalog completeness (verified vs community, missing member/release, missing photo) does **not** block the Holding. That satisfies: **Add to Collection means the collectible belongs to the user digitally immediately.**

`collection.tsx` always uses `api.ts` (Live), including when Demo mode is on.

### 4.4 Add collectible (canonical)

```
collect.tsx search
  GET /api/catalog/search?q=&limit=24     searchSharedCatalog (anon)
  → /add?templateId&name&kind
add.tsx
  POST /api/mobile/holdings { templateId }     → holdings row  ✅ ownership
  optional PhotocardCropper + ImageManipulator
  POST /api/mobile/media multipart holdingId+file → collectible-media + media_assets
  GET holdings (detail) → personalMediaUrl
  Profile holdingCount = holdings.length
  Binder = photocards among those holdings (no extra catalog-set table)
  Room place = PUT /api/mobile/room (currently blocked by theme_id select)
```

Manual:

```
POST /api/mobile/catalog/contributions
  RPC create_catalog_contribution → template + catalog_contributions
  → /add?...&newTemplate=true
  Holding as above
  optional consent → POST /api/mobile/catalog/reference-images
    requires catalog_contributions row for (user, template)
    bucket catalog-reference-images  ≠  collectible-media
```

Personal media never becomes a catalog reference without that explicit checkbox **and** a contribution row. Room `representation.ts` uses **only** `personalMediaUrl`, never catalog reference images.

Subsequent catalog searchability: new community templates are selected by `searchSharedCatalog` (`status <> restricted`) via `search_text` ILIKE. Duplicate matching is inside `create_catalog_contribution` (identity_key); native does not expose merge/correction.

### 4.5 Catalog

| Action | Endpoint | Auth |
|--------|----------|------|
| Search templates | `GET /api/catalog/search` | None |
| Contribute | `POST /api/mobile/catalog/contributions` | Bearer |
| Reference image | `POST /api/mobile/catalog/reference-images` | Bearer + contribution |

`NativeCatalogTemplate.colorway` is optional in native types; DAL `CatalogTemplateDTO` has **no** colorway. Live UI uses initials/color fallbacks.

No native catalog-correction or merge API.

### 4.6 Feed / social

```
GET  /api/mobile/feed                 getProductionFeed = follows ∪ self → public posts
PUT/DELETE /api/mobile/posts/:id/like
GET/POST /api/mobile/posts/:id/comments
POST /api/mobile/posts                multipart createPost → posts + post_media + post-media bucket
GET  /api/mobile/collectors/:id/posts
POST /api/mobile/discovery/collectors
```

Discover tab: `productionRepository.loadFeed("discover")` returns empty. No non-follow feed query.

Repost: no `repost_of` column in `20260927000000_social_layer.sql`; DAL has no repost functions.

`setPostSaved`: production no-op.

Share: `SeoullyFeedPost` → `/send-to`. Live `sendShare` throws. No iOS share sheet.

Video: create UI `mediaTypes: ["images"]`. DAL would accept some video MIME types. Display is poster + overlay, not playback.

### 4.7 Search / explore

| Dest | Demo | Live API | Destination contract |
|------|------|----------|----------------------|
| People | fixture USERS | `GET /api/mobile/search?q=` | `/collector?userId=` (UUID) |
| Rooms | synthetic from people | `POST /api/mobile/discovery/rooms` + people merge | Live `/collector-room`; Demo `/collector` |
| Posts | fixture POSTS | **stub `[]`** | n/a |
| Collectibles | fixture templates | `GET /api/catalog/search` | Live `/add?templateId=` (UUID) |
| Groups & members | GROUPS/MEMBERS fixtures | derived from catalog search hits | retargets People search with entity `query` string (name, not UUID) |

Live entity IDs are catalog group/member UUIDs but navigation uses the **display name as a people query**, not a group screen. Contract is lossy but not UUID-invalid.

### 4.8 Collection graph / compatibility

**Do not merge these engines.**

| | `computeCompatibility` (`src/domain/compatibility.ts`) | `computeCompatibilityPeople` (`src/server/compatibility/service.ts`) |
|--|--|--|
| Used by | Demo repository, web memory-repository, `check:fixtures` | Native Live match, discovery rank, web `/api/compatibility`, Ask tools |
| Weights | groups 0.20, bias 0.18, members 0.12, items 0.16, eras 0.08, interests 0.08, **complement 0.18** | templates 0.40, groups 0.25, members 0.15, releases 0.10, favoriteGroups 0.05, biasMembers 0.05 |
| Wishlist in score | Yes (complement) | **No** — `computeTradeOpportunity` separately |
| Eras / interests | Yes | Ignored |
| Data | Fixture holdings/wishlists/slug tastes | `graph_pair_snapshot` UUID templates + string taste IDs |
| Reasons | Prose | `{ code, count }` |
| `SocialCompatibility.source` | `"domain"` | `"production"` |

Live match route does **not** return another collector’s raw holdings graph; it returns coded reasons + aggregated trade template lists (`theyOwnYourWants` / `youOwnTheirWants`).

**User-visible inconsistency:** Demo 65% Soo↔Minji (fixture CI) is not comparable to a Live people-engine percentage. Favorite-group overlap in Live compares onboarding **slugs** (`skz`) while holding-derived `SHARED_GROUP` uses catalog **UUIDs** — two ID spaces.

### 4.9 Messages / Send to

```
GET  /api/mobile/messages                      listDirectConversations
POST /api/mobile/messages { peerUserId }       ensureDirectConversation RPC
GET  /api/mobile/messages/:id                  listDirectMessages
POST /api/mobile/messages/:id { body }         sendDirectMessage
```

DAL: `src/server/dal/messages.ts` — body text only.

**Pending migration `20261001000000_direct_messages.sql` (NOT applied):**

Creates `direct_conversations`, `direct_conversation_participants`, `direct_messages(body)`, RPC `ensure_direct_conversation`, participant RLS.

**Confirmed gaps vs product:**

| Need | In pending SQL? |
|------|-----------------|
| Text 1:1 send | Yes |
| `post_id` / post share context | **No** |
| `template_ids` / holding / trade context | **No** |
| `last_read_at` / unread / receipts | **No** |
| Message kind (text vs share vs trade) | **No** |
| Participant insert policy for conversations | RPC security definer only (intentional) |

Messages tab always calls Live API. Without tables, `listDirectConversations` errors → `messagesUnavailable`. Collector “Message” uses `ensureConversation` (same). Trade CTA `messageAboutTrade` is a stub (`void templateIds`).

**Recommended coherent contract (do not apply in this pass):**

```
direct_conversation_participants
  last_read_message_id uuid null
  last_read_at timestamptz null

direct_messages
  body text null check (length)          -- allow attachment-only later
  kind text not null default 'text'      -- text | share | trade
  post_id uuid null references posts(id)
  created_at, sender_user_id, conversation_id  -- existing

direct_message_attachments
  message_id uuid
  kind text  -- template | holding
  template_id uuid null
  holding_id uuid null
```

Unread = messages after participant `last_read_at`. Send to = `kind='share'` + `post_id`. Trade CTA = `kind='trade'` + template attachment rows. Notifications (separate table) can fan out on insert. **Revise the migration before applying**; shipping `20261001` as-is would lock a body-only product and force a follow-on migration for the actual loop.

### 4.10 Notifications

```
SeoullyHeader → unreadNoticeCount()
(tabs)/notices.tsx → loadNotices / markNoticesRead
```

Live: `{ items: [], persisted: false }`, unread `0`, mark no-op.  
Demo: `src/domain/fixtures/social.ts` `NOTICES` (like, comment, follow, trade, activity, repost). **No `message` kind.**

No `notifications` / `notices` table in `supabase/migrations`. Web memory-repository `pushNotice` is in-memory only.

**Missing for production:** notifications table (recipient, actor, kind, post_id, template_ids, conversation_id, read_at), write hooks on like/comment/follow/repost/trade/message, `GET/PATCH /api/mobile/notices`, native repository wiring, tap routes (`/collector`, post detail — post detail is itself thin).

### 4.11 Ask Seoully

```
SeoullyCompanion
  social.askSeoully(question, locale, history)
Demo: demo/ask.ts → runAssistantTools(memory-repository, viewer SOO)
Live: askSeoullyNative → POST /api/mobile/assistant
      → ALS bearer → askSeoullyProduction
      → planAssistantTool | deterministicTool
      → executeAssistantTool (registry)
      → generateAssistantReply | fallbackReply
      → { reply, cards, tool, mode }
```

Live tools (production DAL, no social fixtures): `get_my_collection`, breakdown, wishlist, wishlist owners, collectors wanting my items, reciprocal, missing known collectibles, owners/wanters of a template, `search_collectibles`, template details, `search_collectors`, `get_collector_compatibility`, `get_trade_relationship`, `discover_collectors|rooms|collectibles`, `estimate_collectible_value` (explicitly no live market), `navigate`.

| Ask capability | Live-backed? |
|----------------|--------------|
| App explanation | PARTIAL — no dedicated tool; LLM/fallback prose only |
| Catalog search | Yes |
| Collector search | Yes |
| Room search | Yes (`discover_rooms`) |
| Current collection | Yes |
| Wishlist | Yes |
| Trade opportunities | Yes (if target resolvable) |
| Missing-known collectibles | Yes |
| Similar collectors | Yes (`discover_collectors`) |
| Navigation | PARTIAL — routes exist; search query ignored; wishlist vs collection same `/collection` |

**Fixture leak in Live Ask:** `src/server/assistant/` does not import domain fixtures. Demo Ask is `__DEV__` require-gated. **Onboarding GET still returns fixture GROUPS/MEMBERS to Live clients** (separate from Ask).

**Context gap:** `production.askSeoully` always sends `{ surface: "home" }`. Companion does not pass `profileUserId` / `templateId` from the open screen, so collector-scoped tools often miss target.

Card → native routes: `profile`→`/collector`, `room`→`/collector-room`, `search`→`/search` (no params), `collection`/`wishlist`→`/collection`, `composer`→`/create`, `inbox`→`/messages`, `add`→`/collect`.

### 4.12 Room

**Own:**

```
GET    /api/mobile/room     ensureMyRoom SELECT theme_id + placements + all holdings
PUT    /api/mobile/room     upsertMyRoomPlacement (transform JSON; unique holding_id)
PATCH  /api/mobile/room     updateMyRoomTheme
DELETE /api/mobile/room     remove placement (holding remains)
```

`rooms` / `room_placements` from **applied** `20260922000000`. Current DAL **also selects `theme_id`**, added for `20261002000000` which is **not applied**. `ensureMyRoom` therefore fails against current production (`room_read_failed`). That blocks place/move/rotate/scale/store because they all go through ensure/list.

Without the theme column, renderer still has client presets (`hearth|blossom|midnight`). Persistence of theme is what the unapplied migration adds. **Placements already work in schema**; **current API code cannot read them until `theme_id` exists or DAL stops selecting it.**

Camera/focus: AsyncStorage only.

Profile Enter Room: Demo notice; Live `router.push("/room")`. Underlay is paper, not the 3D room.

**Public:**

```
GET /api/mobile/collectors/:userId/room → getPublicProfile handle → get_public_room_by_handle
```

Does not need `theme_id`. Native `collector-room.tsx` hardcodes `hearth`. `buildPublicRoomRenderables` uses **placement id** as `holding.id` (RPC does not return holding UUID) — Binder deep-link from a public room object would be wrong.

Public media: signed 300s if placed and `can_view_public_collectible_media` (placed + `collection_public`). Unplaced personal media stays private.

### 4.13 Binder

```
binder.tsx → loadAllMyHoldings() → buildNativeBinderPages
  photocards only
  set key groupId:releaseId or groupId:general
  6 pockets / page, partner blank page, memberName sort
  personalMediaUrl via useCachedSignedMedia
room.tsx photocard focus → /binder?holdingId= → spreadIndexForHolding
```

Depends on production `holdings` + template `groupId`/`releaseId`/`kind` — **not** on a nonexistent catalog-set table. Empty partner pages are local pagination, not missing catalog data.

No public/visitor binder. Always Live API (Demo mode still hits production holdings).

### 4.14 Media

```
iPhone camera/library
  → PhotocardCropper (photocards)
  → ImageManipulator JPEG 0.9
  → POST /api/mobile/media
  → storage collectible-media /{owner}/{assetId}/original
  → media_assets UPSERT on holding_id
  → sign 3600s → personalMediaUrl on holdings hydrate
  → Collection, Profile shelves, Binder, Room textures, not Posts
Posts: separate post-media bucket via createPost
Catalog reference: separate bucket + consent
Avatar: none
```

`width`/`height` columns exist; upload DAL does not populate them.

---

## 5. Demo vs Live discrepancies

| Surface | Demo | Live |
|---------|------|------|
| Feed default tab | Discover | Following |
| Discover feed | Full fixture | Empty |
| Repost | In-memory persisted | Flash unavailable |
| Notices | 5 fixture rows | Empty + unavailable banner |
| Send to | In-memory shares | Throws |
| Ask | Fixture SOO + domain tools | Production DAL |
| Compatibility | Domain engine + rich trade items | People engine + `kind: ""` on trade items |
| Collector shelves | Full holdings/wishlist | Empty arrays, count from summary |
| Avatar / theme | Fixture | None |
| Messages from collector | Honest block | API error until migration |
| Room from profile | Honest block | `/room` then theme_id failure |
| collection/binder/room/messages screens | Still call Live `api.ts` | Live |
| Search rooms dest | `/collector` | `/collector-room` |
| Create/add writes | Blocked in UI | Production |
| Entity search | Direct GROUPS/MEMBERS | Derived from catalog |

Live Ask cannot serve Demo posts/notices. Dev users can still toggle Demo locally.

---

## 6. Native / API / backend / schema contract mismatches

1. **`theme_id` selected in `rooms.ts` vs unapplied `20261002000000`** — own Room GET/PATCH broken against current prod DB.  
2. **`production.loadCollector` holdings/wishlist `[]` vs UI shelves and `holdingCount`.**  
3. **Onboarding fixture slugs vs catalog UUIDs** in pair snapshot / people-engine favorite overlap.  
4. **`NativeCatalogTemplate.colorway` / Demo `"published"` vs DAL `community|verified|restricted` and no colorway.**  
5. **Discover feed UI vs empty repository.**  
6. **Repost UI vs `{ persisted: false }` / no column.**  
7. **`sendShare` vs body-only DM schema (even after `20261001`).**  
8. **Ask `search` action query vs `/search` with no params; context always `home`.**  
9. **Public room `holding.id` = placement UUID vs Binder `holdingId`.**  
10. **`mobileConfig.isConfigured` omits `EXPO_PUBLIC_API_URL`.**  
11. **No GET `/api/mobile/profile`; identity only via `/session`.** (By design, but easy to misuse.)  
12. **Assistant registry `getCollectorCompatibility({ targetUserId })` relies on ALS; match route passes client explicitly — both OK if ALS set.**  
13. **Trade DAL accepts `open-to-offers`; native enum is `for-trade` \| `not-for-trade`.**  
14. **Demo repository richer `SocialCollector` than Live** (avatar, theme, eras, holdings). Types compile because fields are optional.  
15. **`setPostSaved` / Live `searchPosts` / `loadNotices` compile as repository methods but are stubs.**  
16. **Entity search IDs are UUIDs; navigation uses name string into People search.**  
17. **Signed URL TTL 3600 vs public room 300; cache key `holdingId:url` re-downloads on rotate.**

Independent TypeScript on mobile vs server will not catch these.

---

## 7. Database / migration reality

Evidence: files in `supabase/migrations/`, `MOBILE_MIGRATION_PROGRESS.md` (onboarding applied; DM and room-theme **not** applied). This audit did not query production `schema_migrations`.

### Required and present (treat as applied)

| Migration | Objects used by native |
|-----------|------------------------|
| `20260917000000_user_profile_foundation.sql` | users, profiles, provision RPC, RLS |
| `20260919000000` + slug fix | shared catalog, contribution RPC |
| `20260920000000_holdings.sql` | holdings |
| `20260921000000_wishlist_trade.sql` | wishlist, trade_status |
| `20260922000000_room_placement.sql` | rooms, room_placements |
| `20260923000000_media_assets.sql` | media_assets, collectible-media |
| `20260924000000_collection_graph.sql` | graph RPCs |
| `20260925000000_compatibility_trade_intelligence.sql` | `graph_pair_snapshot` |
| `20260926000000_discovery_candidates.sql` | discovery |
| `20260927000000_social_layer.sql` | posts, likes, comments, follows, post-media |
| `20260928000000` + patch | public room RPC, public media policy |
| `20260929000000` + policy fix | catalog_reference_images |
| **`20260930000000_native_onboarding_progress.sql`** | **`profiles.onboarding_step` — explicitly applied** |

### Required but missing (no migration)

- Notifications / notices  
- Reposts (`repost_of` or equivalent)  
- Saved posts  
- Discover-feed index/query (could be code-only on existing `posts`)  
- Avatar / profile media  
- Message unread, post context, template context (not in pending DM SQL either)  
- DigitalRepresentation table (not required if kept computed)

### Present locally but migration unapplied

| File | If applied as-is | Product fit |
|------|------------------|-------------|
| `20261001000000_direct_messages.sql` | Text 1:1 DMs | **Incomplete** for Send to / trade / unread |
| `20261002000000_native_room_theme.sql` | `rooms.theme_id` | Required by **current** DAL; placements already exist |

### Legacy / dormant

- Seoully Vision / identification — not in native product path; do not revive  
- Domain `computeCompatibility` — live for Demo/fixtures only  
- Web memory-repository notices/reposts — not production  
- Profile comment “later: NativeRoomRenderer” — dormant underlay

---

## 8. Functional dependency graphs

```
Auth
├── Supabase Auth client              CODE EXISTS
├── SecureStore session               CODE EXISTS
├── Deep-link code exchange           CODE EXISTS
├── EXPO_PUBLIC_API_URL               CONFIG GAP (not in isConfigured)
├── GET /session + provision RPC      CODE EXISTS
└── Onboarding 20260930               APPLIED

Profile
├── Identity                          CODE EXISTS
├── Follow counts / posts             CODE EXISTS
├── Own holdings/wishlist             CODE EXISTS
├── Edit text                         CODE EXISTS
├── Avatar                            MISSING
├── Eras UI                           MISSING
├── Taste IDs                         FIXTURE SLUGS ≠ CATALOG UUID
├── Public shelves                    API/REPO GAP (count without rows)
└── Enter Room                        DEMO BLOCK / LIVE THEME_ID BLOCK

Collection
├── Holdings CRUD                     CODE EXISTS
├── Wishlist CRUD                     CODE EXISTS
├── collection.tsx ignores Demo       MIXED MODE
└── Read-back Profile/Binder          CODE EXISTS (own)

Add Collectible
├── Catalog search                    CODE EXISTS (public)
├── Holding insert                    CODE EXISTS  ← ownership moment
├── Crop + private media              CODE EXISTS
├── Manual contribution               CODE EXISTS
├── Consent reference image           CODE EXISTS (contribution-gated)
├── Room place after add              BLOCKED (own room GET)
└── Catalog merge UI                  NOT BUILT

Catalog
├── Search / contribute / ref image   CODE EXISTS
├── Duplicate RPC                     SERVER
└── Correction/merge                  NOT BUILT

Feed/Social
├── Following feed                    CODE EXISTS
├── Discover feed                     STUB
├── Like / comment / create image     CODE EXISTS
├── Repost                            SCHEMA+DAL MISSING
├── Save                              NO-OP
├── Suggested collectors              CODE EXISTS
└── Video create/playback             NOT BUILT

Search
├── People / collectibles             CODE EXISTS
├── Rooms                             CODE EXISTS (nav Demo≠Live)
├── Posts                             LIVE STUB
└── Entities                          DERIVED / LOSSY NAV

Messages
├── conversation schema               BLOCKED (unapplied + incomplete)
├── text send API                     CODE EXISTS
├── Messages tab                      UI EXISTS / ERROR WITHOUT TABLES
├── Send To                           UI EXISTS / DELIVERY BLOCKED
├── trade message                     UI EXISTS / DELIVERY BLOCKED
├── unread                            MISSING
└── notifications                     MISSING

Notifications
├── Bell / list UI                    EXISTS
├── Demo fixtures                     DEV ONLY
├── Production table/API              MISSING
└── Tap navigation                    UNPROVEN / EMPTY LIVE

Ask Seoully
├── Companion UI                      CODE EXISTS
├── POST /assistant + ALS bearer      CODE EXISTS
├── Production tools                  CODE EXISTS
├── Demo tools                        DEV ONLY (no Live leak)
├── Screen context                    ALWAYS home
└── Card → route params               PARTIAL

Room
├── placements table                  APPLIED
├── GET/PUT/DELETE API                CODE EXISTS
├── theme_id column                   UNAPPLIED / DAL ALREADY SELECTS
├── public RPC read                   CODE EXISTS
├── Profile underlay 3D               NOT WIRED
└── public holdingId                  CONTRACT MISMATCH

Binder
├── Holdings → photocards             CODE EXISTS
├── release/group sections            USES TEMPLATE FIELDS (OK)
├── personal crop textures            VIA MEDIA
└── Room focus holdingId              OWN ROOM PATH BLOCKED

Media
├── Private holding upload            CODE EXISTS
├── Signed read-back                  CODE EXISTS
├── Catalog consent path              SEPARATE BUCKET
└── Avatar / post-from-holding        NOT BUILT
```

---

## 9. P0 / P1 / P2 / P3 gap list

### P0 — prevents basic production functionality or corrupts the loop

| Capability | Missing link | Where | Layer | Dependencies | Safest next step (do not do now) |
|------------|--------------|-------|-------|--------------|----------------------------------|
| Own Room load/persist | DAL `SELECT theme_id` vs unapplied column | `src/server/dal/rooms.ts`, `20261002000000` | schema vs code | placements already exist | Either make `theme_id` optional in SELECT until migration is approved, **or** review+apply theme migration — do not ship GET room against current prod as-is |
| Messages tab / collector Message | `direct_*` tables absent | `messages.ts`, `20261001000000` | schema | — | **Do not apply current SQL as the final product schema.** Revise for share/trade/unread, then apply once |
| Public collector shelves | Lists `[]` while `holdingCount` from summary | `production.ts`, collector UI, no public holdings route | API + contract | visibility RLS | Add a **visibility-respecting** public holdings/wishlist DTO **or** hide shelves until then (count-without-rows is the corruption) |
| API URL vs sign-in | `isConfigured` ignores `EXPO_PUBLIC_API_URL` | `apps/mobile/src/config.ts` | config | — | Fail closed before auth if API URL missing |
| Demo Collection/Binder/Room/Messages | Bypass repository, hit Live | `collection.tsx`, `binder.tsx`, `room.tsx`, `messages.tsx` | client | Demo toggle | Gate those screens on `social.kind` or stop advertising Demo as a full world |

### P1 — core Seoully loop missing

| Capability | Missing link | Where | Layer | Dependencies | Safest next step |
|------------|--------------|-------|-------|--------------|------------------|
| Notifications | No table/API | migrations, `production.ts` | schema + API | social events | Design notices table; do not fake Live from fixtures |
| Send to | No post_id on messages; `sendShare` throws | send-to, messages DAL | schema + API | revised DM | After DM contract, insert share message |
| Trade message | Stub + no template context | `collector.tsx` | schema + API | revised DM | Prefill/attachment after schema |
| Unread DMs | No last_read | pending SQL | schema | DM | Participant read cursor |
| Discover feed | Empty stub | `production.ts`, `social.ts` | API/DAL | existing posts | Non-follow public feed query |
| Avatar | No column/upload | profile DAL/UI | schema + media | storage | Profile media asset + PATCH |
| Public holdings/wishlist lists | Not on collector GET | collectors route | API | collection_public / wishlist_public | Paginated public DTOs, not raw private graph |
| Ask context | Always `surface: home` | `production.ts`, companion | client | assistant schema | Pass profile/template from route |
| Holding photo → Room | Own room GET blocked | rooms DAL | schema vs code | P0 theme | After Room GET works |

### P2 — parity / experience

| Capability | Missing link | Where | Layer | Safest next step |
|------------|--------------|-------|-------|------------------|
| Dual compatibility | Different engines | domain vs server | product (do not merge) | Label `source`; keep both |
| Taste ID space | slugs vs UUIDs | onboarding route vs catalog | data contract | Map or migrate tastes onto catalog ids |
| Post search | Live `[]` | `production.ts` | API | Caption/tag search on posts |
| Repost | No schema | social layer | schema | Only if product requires persistence |
| Save post | No-op | `production.ts` | API | Table or hide control |
| Ask search cards | Query dropped | `SeoullyCompanion` | navigation | `search?q=&destination=` |
| Profile Room underlay | Paper only | `SeoullyProfile.tsx` | UI | Wire read-only renderer after Room GET |
| Public room theme / holding ids | RPC + client mapping | `public-room.ts`, `model.ts` | contract | Extend RPC after theme migration |
| Video | No create/playback | create.tsx, SeoullyMedia | UI | Defer |
| Eras chips | `eras: []` | `production.ts` | client | Map `favoriteEraIds` |
| Catalog colorway | Native optional, API absent | catalog DTO | contract | Remove from native expectation or add |
| Entity → people | Name query not group screen | search.tsx | navigation | Accept or add group destination |

### P3 — later

- OS share sheet  
- Populate media width/height  
- Post detail route  
- Catalog merge/correction admin  
- Notification `message` kind  
- Camera/focus server persistence  
- Expo Doctor patch pins (`expo@57.0.25` vs `57.0.26`)  
- `open-to-offers` vs native trade enum  

---

## 10. Required physical-device QA journeys (before beta)

Do not mark any of these done from this audit.

1. **Sign in** → session restore (kill/relaunch) → identity on Profile.  
2. **Sign out** → cold start → sign-in screen.  
3. **Auth-code deep link** (if used) → session.  
4. **Onboarding** (new account) group → bias → interests → `onboarding_step=done` → tabs. Re-edit tastes.  
5. **Edit profile** text persists after relaunch. Confirm avatar still initials until built.  
6. **Add collectible (catalog):** search production catalog → select template → skip photo → Holding exists → Profile count +1 → Collection list → Binder (if photocard) → Room place (only after Room GET works).  
7. **Add collectible (photo):** camera + photocard crop → private media on detail/Binder/Room; catalog search still has no personal image.  
8. **Add manually:** contribution → Holding immediately → optional consent reference → item searchable in catalog.  
9. **Wishlist** add from Search and remove from Collection; Profile wishlist count.  
10. **Trade status + remove holding** on Profile; count and Binder/Room update.  
11. **Follow** a live collector → Following feed shows their posts; unfollow.  
12. **Create image post** → appears on own Profile + Following (self included). Like + comment persist after relaunch. Confirm repost does **not** persist.  
13. **Search people** UUID → collector profile. **Search collectibles** UUID → add flow. **Search rooms** → public Room (not Demo collector). **Search posts** expected empty until built.  
14. **Public collector:** follow, posts, compatibility/trade match, Enter Room. Owned/Wishlist: expect empty lists until API exists — do not treat count as a list. Message: expect failure until revised DM schema.  
15. **Ask Seoully (Live):** collection, wishlist, catalog search, collector search, missing items, similar collectors. Confirm no Demo names. Tap cards: profile/room/collection. Search card does not prefill query.  
16. **Send to:** recipient search works; send shows blocked.  
17. **Notices:** empty Live; Demo list only in `__DEV__`.  
18. **Messages tab:** error/empty until schema; then 1:1 text after a **revised** migration.  
19. **Own Room:** load after theme story resolved; place/move/rotate/scale/store; relaunch restore; Binder from focused photocard; return.  
20. **Public Room:** another collector with `collection_public`; textures; no write.  
21. **Binder spreads** / empty partner page / personal crop.  
22. **Config:** app with missing `EXPO_PUBLIC_API_URL` (today may still show sign-in).  

Device-specific from `DEVICE_QA.md` still open: Expo Go Room R3F launch, Feed visual approval, SafeArea.

---

## 11. Recommended implementation order

Do **not** start these in this pass. Order minimizes corrupt UX and schema thrash.

1. **Room DAL vs `theme_id`** — unblock GET without pretending the migration is applied; then review `20261002` as a dedicated theme persist change.  
2. **Stop count-without-rows on public collectors** (hide shelves or add a real public list API with visibility).  
3. **Honest Demo gates** on screens that call `api.ts` directly.  
4. **Fail closed** when API URL is missing.  
5. **Revise DM contract** (text + share + trade attachments + read cursor) — **do not apply `20261001` as-is if those are beta requirements.** Apply once, with RLS review.  
6. **Send to + trade CTA** on that contract.  
7. **Notifications table + API** (or keep bell disabled in Live).  
8. **Discover feed** (code on existing posts) if the tab stays visible.  
9. **Ask:** pass route context; honor search query params.  
10. **Avatar** if Profile is a beta surface.  
11. **Taste ID alignment** with catalog UUIDs (compatibility quality).  
12. **Post search / hide the dest** if Live remains empty.  
13. **Profile 3D underlay** only after own Room GET is healthy.  
14. Repost/save/video/eras last.

Compatibility engines stay dual-purpose until an explicit product decision; do not “fix” them into one number.

---

## Appendix A — `/api/mobile` routes (current tree)

| Method | Path |
|--------|------|
| GET | `/api/mobile/session` |
| GET/PATCH | `/api/mobile/onboarding` |
| PATCH | `/api/mobile/profile` |
| GET/POST/PATCH/DELETE | `/api/mobile/holdings` |
| GET/POST/DELETE | `/api/mobile/wishlist` |
| POST | `/api/mobile/media` |
| GET | `/api/mobile/feed` |
| POST | `/api/mobile/posts` |
| PUT/DELETE | `/api/mobile/posts/[postId]/like` |
| GET/POST | `/api/mobile/posts/[postId]/comments` |
| GET | `/api/mobile/search` |
| POST | `/api/mobile/discovery/[surface]` |
| GET/PATCH | `/api/mobile/collectors/[userId]` |
| GET | `/api/mobile/collectors/[userId]/posts` |
| GET | `/api/mobile/collectors/[userId]/match` |
| GET | `/api/mobile/collectors/[userId]/room` |
| GET/PUT/PATCH/DELETE | `/api/mobile/room` |
| GET/POST | `/api/mobile/messages` |
| GET/POST | `/api/mobile/messages/[conversationId]` |
| POST | `/api/mobile/assistant` |
| POST | `/api/mobile/catalog/contributions` |
| POST | `/api/mobile/catalog/reference-images` |

Plus public `GET /api/catalog/search`.

## Appendix B — verification commands this pass

```
npm run check:fixtures          # pass
cd apps/mobile && npx tsc --noEmit && npx expo lint   # pass
npm run mobile:verify           # fail: Expo Doctor patch versions
npx expo export --platform ios --dev     # 1952 modules, Demo assets present
npx expo export --platform ios           # 1756 modules, no fixture assets
npx expo export --platform android       # 1836 modules, no fixture assets
```

No production rows were inserted, updated, or deleted. Pending SQL was inspected only.
