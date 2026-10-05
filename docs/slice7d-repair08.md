# Slice 7D Repair 08 — physical Room polish

Implementation target: native Expo app in `apps/mobile` on `mobile-native`. The web UI was not changed. Shared mobile API/DAL changes support native persistence and safe public rendering. Physical success is not claimed; iPhone QA remains the next authority.

## Desk audit and cleanup

The Desk origin was Y −0.82 and its leg bottom was local Y −1.09, leaving the visible bottom at −1.91 against floor Y −2.08: a 0.17-unit gap. Its origin is now derived from geometry contact, Y −0.99.

The upper drawer front was centered at local Y 0.18 with height 0.22, reaching 0.29 above the tabletop top at 0.0825. Drawer centers are now −0.16, −0.42, −0.68; fronts and handles stay underneath the tabletop.

The burgundy Desk object was `NativeOpenBinder` at its closed/rest pose, not decorative clutter or an Archive. Its closed mesh is hidden; it remains mounted for the existing Desk-relative travel/open/close architecture. Tap Desk, then the small **Open Binder** contextual action to access it. Existing photocard inspection access also remains. The invisible home Binder hotspot is excluded to avoid an unexplained empty-space tap target. No Holding, Binder contents, eligibility, or ownership is deleted.

## Grounding and dimensions

`roomGrounding.ts` defines floor Y, visible lower bounds in each authored pivot frame, and `groundedOrigin(surfaceY, lowerBound, offset)`. Native defaults, parsing/clamps and Shop spawn use this deterministic rule. Invisible hit meshes and shadow decals do not participate in visible bounds. The focused geometry test measures the actual authored Three geometry and compares it with the contact metadata.

Shelf, Desk, Case, Chair, Lamp, Plant and Archive have visible lower bounds exactly at −2.08. Rug bottom is −2.078, a 0.002-unit anti-z-fight separation. This is geometry evidence, not a physical-device visual acceptance claim.

Collectibles use representation-specific visible bounds, scale and XYZ rotation, with a 0.002-unit contact separation. Preview, settling, current world rendering and placement persistence share those bounds. The authoritative Repair 06 resolver derives current support height from the live parent surface without rewriting child placements or applying a second delta. Actual rendered collectible forms are checked against their bounds, including lightstick, plush, figure and thin paper. The figure base is a horizontal cylinder. Selection does not enlarge a resting object and push its bottom through its support.

Inner half-width changes from 4.068 to 3.6612; full inner width changes from 8.136 to 7.3224, exactly another 10%. Central width scale changes 0.90 → 0.81. Depth scale stays 0.80. Inner walls, trim, window, authored coordinates, placement clamps, surfaces and camera containment follow the central layout. Coverage geometry remains large enough for allowed camera rays. Furniture sizes and HOME camera/FOV are unchanged.

## Shop, Chair and surfaces

Shop order is Furniture (Shelf, Desk, Chair, Display Case), Decor (Rug, Lamp, Plant, Archive), Wall (Wall Frame, Photo String). Each item has a locally authored native SVG miniature. There are no remote thumbnails, WebView, world screenshots, additional Three Canvas, purchase controls or prices.

Chair has a seat, backrest and four simple legs, coordinated with Furniture style. It is unique, floor-bound, Shop-addable, movable and removable. Its seat top is local Y 0.06 and is a general landing surface. Chair Turn is deliberately not exposed; no new rotation-carry architecture is introduced.

Shop Add creates and renders a valid grounded/clamped starter position immediately, dismisses Shop and selects the object. Add is saved as a single layout/history action. Undo removes it and Redo restores it; later long-press movement is a separate action. There is no invalid acquired ghost waiting for the first pointer movement. Floor spawns search deterministic nearby positions against furniture footprints. Wall spawns search visible back-wall positions. Spawn spacing does not reject the user's later intentional overlap or clutter.

Live save failures roll back the optimistic Add and report that saving is unavailable; no successful Add history is fabricated. Move, configuration, Remove and Turn history are recorded only after a successful layout save. Failed object Undo/Redo restores its history stack. First-edit completion is not silently reported as saved after a failed layout write.

Normal collectibles accept any non-wall physical surface, including Floor, Shelf shelves, Desk tabletop, Chair seat, Case shelves/top, Archive lid and the Binder's existing Desk surface. Surface geometry decides contact, not a collectible-type × furniture-type matrix. Posters accept Wall only. Floor furniture/rugs never mount on walls. Wall Frame and Photo String never leave the back-wall plane.

## Photo String

One canonical wall object has a static authored sag curve, two anchors, five clips and five slot positions. No simulation or per-frame persistence is used. Hanging cards have small authored angle variations and inherit the same `FurniturePose` transform used for selection, hit testing and live drag. Their positions are the parent transform plus authored slot coordinates.

Owners tap Photo String in normal Room, or use **Choose photocards** on its contextual Edit row. A compact native sheet shows eligible owned photocard thumbnails, basic identity, selection state and 0–5 selected count. Tap a selection to remove it; then choose a replacement. Save stores a deep copy of the slots in object configuration. Other collectible kinds, restricted templates, unowned IDs, malformed arrays and duplicate IDs within the five slots are rejected. UUID duplicate comparison is case-insensitive.

Owner imagery follows existing Holdings media priority: personal media → catalog reference → standardized type fallback. Public cards never use the owner's personal crop. Their DTO contains only object ID, slot and safe catalog identity; the server may attach an active community-shared catalog reference URL through the existing reference-image DAL. If it is absent or unavailable, the standardized fallback renders. Storage paths, private crop URLs, acquisition/trade fields and Holding IDs are not exposed for Photo String attachments.

## Unapplied schema amendment

The actual existing file is `supabase/migrations/20261004000000_native_room_layout.sql`; it was amended in place. No new migration was created. The earlier 20261002 theme and 20261003 style migrations were inspected and remain unchanged.

20261004 now:

- permits `chair` and `photo-string` in the Room object kind allowlist;
- permits optional per-object `photoString: { slots: [Holding ID or null × 5] }` only on Photo String;
- rejects malformed configuration, non-UUID Live IDs, wrong slot counts and duplicate UUIDs;
- validates attachment Holding ownership, photocard kind and non-restricted eligibility in a trigger on Room insert/layout or owner updates, including direct REST writes;
- keeps existing owner RLS and creates no broad permissions or ownership mutations;
- returns an allowlisted geometry layout to public visitors instead of wholesale owner configuration;
- supplies a separate safe public Photo String catalog projection with no private media/storage data.

The native and server types share the portable kind/config contract; focused checks assert SQL kind parity. Demo uses its existing fixture Holding identifiers; Live identifiers are UUID-validated at the API and database boundaries.

Version-1 layouts without attachment configuration remain valid. Legacy `{}` remains the legacy furnished Room with first edit already complete, and does not retroactively add Chair or Photo String. Brand-new authored Room remains exactly Shelf + Lamp, with no placed collectibles. Demo reset clears placement/layout presentation but preserves Holdings and Binder eligibility.

20261002 applied: **NO**. 20261003 applied: **NO**. 20261004 applied: **NO — AMENDED ONLY**. No migration execution or production write was performed. Live layout persistence remains unavailable until the approved schema is separately applied and the corresponding API is deployed; failures are reported honestly. SQL was statically checked, not applied to a database.

## Helper and regressions

The first-entry helper keeps its existing lifetime: 2.6 seconds normally and 1.8 seconds for reduced motion. Opacity fades over its final 350 ms, or 100 ms for reduced motion, before unmounting. The starter still automatically enters Edit Room once, with existing completion semantics protecting returning users.

Repair 04 builder/history/compact toolbar, Repair 05 texture filtering, 512/256 assets, anisotropy/mipmaps, 1024 shadow and MSAA, Repair 06 live transforms/inspection/docks, Repair 07 clean starter/ownership separation/Binder, 7B touch editing and 7C Storage/Binder integration are retained and covered by the existing regression gates. Ask Seoully remains outside the world; sheets reserve its existing bottom clearance. Public visitors remain read-only.

No physics, rope/cloth simulation, second Canvas, postprocessing, Vision, giant assets, migration application, production writes, push or Slice 8 implementation was introduced. The existing aggregate verification command also runs its pre-existing Slice 8 regression check; that is verification of existing code, not new Slice 8 work.

## Verification and next device QA

Required commands: `npm run check:slice7`, `npm run check:slice7c`, `npm run check:slice7d`, `npm run check:fixtures`, `npm run mobile:verify`. Repair 08 focused checks are integrated into `check:slice7d`, including actual furniture/collectible mesh bounds, five-slot validation, ownership invariance, public DTO privacy, general surfaces/wall restrictions, immediate Add/history, starter, helper and width. The aggregate gate includes native TypeScript, lint, Expo Doctor and dev iOS / production iOS / production Android bundles. Changed server DALs also receive an isolated strict TypeScript check.

Physical iPhone QA is required for all original ten scenarios: proportions, floor contact, Desk readability, helper fade, Shop miniatures, immediate Chair/Desk Add and movement, Photo String mounting/configuration/cards, normal collectibles on all general surfaces, direct-wall rejection, and floor/Chair collectible contact. Also exercise Add Undo/Redo, five-card replacement/removal, public read-only fallback imagery and Binder access from Desk. Do not interpret code/static geometry verification as device visual success.

## Verification result

All five requested commands passed. Native lint reported no errors or warnings; Expo Doctor passed 21/21 checks. Dev iOS, production iOS and production Android exports passed. Focused Demo attachment round trips and actual mesh-bound checks passed. Changed server DALs passed an isolated strict TypeScript check. An extra root-wide `tsc --noEmit` invocation was not clean because root script imports pull native modules into a configuration without the native aliases and with different strict-index settings; no web configuration was changed to address that unrelated gate.

## Changed files

- `apps/mobile/src/api.ts`
- `apps/mobile/src/i18n.ts`
- `apps/mobile/src/room/NativeOpenBinder.tsx`
- `apps/mobile/src/room/NativeRoomRenderer.tsx`
- `apps/mobile/src/room/PhotoStringSheet.tsx`
- `apps/mobile/src/room/RoomShopSheet.tsx`
- `apps/mobile/src/room/RoomWorldScreen.tsx`
- `apps/mobile/src/room/ShopMiniature.tsx`
- `apps/mobile/src/room/camera.ts`
- `apps/mobile/src/room/demoRoom.ts`
- `apps/mobile/src/room/envelope.ts`
- `apps/mobile/src/room/model.ts`
- `apps/mobile/src/room/photoString.ts`
- `apps/mobile/src/room/representation.ts`
- `apps/mobile/src/room/roomEnvironment.tsx`
- `apps/mobile/src/room/roomGrounding.ts`
- `apps/mobile/src/room/roomLayout.ts`
- `apps/mobile/src/room/roomObjectEdit.ts`
- `apps/mobile/src/room/roomObjects.ts`
- `apps/mobile/src/room/roomWorldTransform.ts`
- `apps/mobile/src/room/touchEdit.ts`
- `docs/slice7d-repair08.md`
- `package.json`
- `scripts/check-room-geometry.cjs`
- `scripts/check-room-repair08.ts`
- `scripts/check-slice7.ts`
- `scripts/check-slice7d.ts`
- `src/domain/public-room-layout.ts`
- `src/domain/room-object-schema.ts`
- `src/server/dal/catalog-reference-images.ts`
- `src/server/dal/public-room.ts`
- `src/server/dal/room-schema.ts`
- `src/server/dal/rooms.ts`
- `supabase/migrations/20261004000000_native_room_layout.sql`
