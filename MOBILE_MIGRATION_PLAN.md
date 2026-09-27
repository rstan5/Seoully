# Seoully Native Mobile Migration Plan

## Target architecture

Seoully will retain the existing Next.js application as the web/reference client and
add an Expo + React Native client under `apps/mobile`. Both clients use the existing
Supabase project, Postgres schema, storage/RLS, and production APIs. Native UI is
implemented progressively; no production data or identity model is duplicated.

## Current architecture

The reference client is a Next.js 16 App Router application. `src/domain` contains
catalog, Holding, media, placement, and fixture semantics. `src/server` contains
Supabase-backed actions/DAL and API routes. `src/world` contains the social shell and
the immersive Room/Binder, which currently depend heavily on React DOM, CSS 3D,
Motion DOM layout, pointer events, and browser image URLs.

## Reuse classification

- **A — direct:** domain types, catalog/Holding semantics, compatibility and graph
  algorithms, Binder grouping math, Zod contracts, locale dictionaries, Supabase schema,
  RLS/storage model, and server-side security rules.
- **B — adapt:** Zustand state, repository interfaces, media upload contracts, auth
  session semantics, API clients, localization access, and DigitalRepresentation data.
- **C — native adapter:** Supabase auth persistence, camera/library/crop/upload, secure
  storage, navigation, notifications, deep links, safe areas, gestures, and image cache.
- **D — native rebuild:** Feed, Search, Profile, Messages, onboarding, forms, sheets,
  and the Add Collectible UI.
- **E — high-risk renderer:** Room and Binder. Their data survives, but CSS 3D and DOM
  interaction must be replaced by a native graphics/gesture renderer.

## Phases

1. Foundation: Expo app, strict TypeScript, environment contract, native Supabase
   client, secure session adapter, localization, tokens, navigation/loading shell.
2. Native social: auth/onboarding, Feed, Search, Create, Messages, Profile, notices,
   and discovery using production APIs.
3. Native collection: catalog search, manual contribution, camera/library, photocard
   crop, media upload, Holding persistence, and representation data.
4. Room data boundary: extract platform-neutral Room/Binder models and adapters.
5. Room Renderer V2 proof: native world, one real Holding/media texture, tap/drag,
   placement persistence, and device performance measurement.
6. Progressive native Room/Binder parity, then device QA and release hardening.

## Native API/auth strategy

The mobile client uses Supabase Auth with secure native persistence and calls existing
authenticated HTTP APIs where available. Server Actions are not imported into native
code. New endpoints are added only when an existing production API cannot safely serve
the native flow; privileged operations remain server-side and RLS is unchanged.

## Room/Binder strategy

Keep the current web Room as the reference implementation while native social and
collection surfaces are built. RoomPlacement, Holding, MediaAsset, DigitalRepresentation,
and Binder page/group semantics remain shared contracts. A small native renderer proof
must precede a full Room rewrite; the final renderer will be selected based on gesture,
texture, memory, and real-device performance evidence.

## Risks and validation

Highest risks are native Room rendering, signed-media delivery, gesture arbitration,
camera/crop memory behavior, and keeping server authorization identical. Every phase
requires typecheck, fixture/API checks, and web regression checks. Physical camera,
safe-area, gesture, FPS, memory, and thermal behavior are explicitly device-QA items.

## Definition of done

Native auth/navigation/social/collection flows use production data and preserve RLS;
native camera/crop/media creates durable Holdings and representations; native Room and
Binder render personal media with persisted placements; iOS/Android device QA is
complete or explicitly tracked; the existing web reference remains buildable and
recoverable; no secrets or production-destructive changes are introduced.
