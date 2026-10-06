# Slice 7 local persistence repair

Status: ready for a separate production-ledger/schema verification, **not approved for application**.
No database was connected to or modified by this repair. Native Room/Binder rendering and interaction files are unchanged.

## Pending chain

- `20261002_native_room_theme`: intentionally superseded, `select 1` only. Keeps the pending version/history slot without creating `theme_id`. No deployed column is dropped.
- `20261003_native_room_style`: required. Strict Style validation, visual allowlists, authenticated public Room projection, and a service-only placed-media locator.
- `20261004_native_room_layout`: required **after 03**. Strict layout validation, owner/eligible Photo String trigger, public geometry and safe attachment projection. Uses 03's Style/transform helpers and locator.

An ordinary ordered pending runner records 02's harmless no-op, then applies 03 and 04. The schema dependency order is 03 → 04. First verify the real production ledger, prerequisite schema, actual CLI version, and existing data; do not mark versions applied or run these SQL files manually from this document.

## Contracts

Style has required string enums `wall`, `floor`, `furniture`, `rug`, `light`, `brightness`; optional `binder` accepts Cream, Blush, Lavender, Sage, Sky, Cocoa, Charcoal (lowercase persisted values). Missing Binder defaults to Cream. Unknown keys/types/enum values are rejected. Sets match `src/server/dal/rooms.ts`.

Layout accepts legacy `{}` or version 1 with boolean `firstRoomEditCompleted` and an object array. Instances have distinct trimmed IDs (1–80 characters), one of the existing 12 kinds, required numeric XYZ in [-20,20], and numeric yaw in 0–330 at 30° intervals. Repeated kinds have no quantity cap. Optional parenting is only for `plant`/`table-lamp`, to a specific supported floor-furniture instance/authored surface, one level only. Optional `binderDesk` is true on a Desk, at most one; legacy missing designation remains valid and normalizes deterministically in native code. Optional Photo String config has exactly five nullable UUID slots, no duplicates within one String. The invoker trigger verifies owner, photocard kind, and non-restricted template without changing Holdings. Unknown fields are rejected at every JSON object boundary.

Existing Room rows get valid Style defaults and legacy `{}` layout without placement rewrites. `ensureMyRoom` still creates a missing owner Room with Shelf + Lamp + Desk/Binder. No user/layout reset, Holding deletion, or ownership change is introduced. Existing unexpected style/layout data or schema drift must be inspected before adding CHECK constraints; this repair does not silently rewrite it.

## Public boundary

Public RPC: authenticated execution and a non-null `auth.uid()`, existing `collection_public` gate, explicit null for absent/private Rooms. Minimal owner identity; Room ID; seven visual Style fields; version/completion and geometry-only object array; placement ID/zone/slot/surface, numeric transform/offset allowlists, catalog identity/trade status, and an image-presence boolean. Eligible placements are ordered by updated_at descending then ID ascending and capped at 500 **before aggregation**. No storage/unplaced Holding enumeration. Catalog parents with restricted status are excluded.

04 also returns Photo String object/slot/catalog identity only, using guarded UUID conversion (uppercase accepted). Attachment Holding IDs and personal media are omitted. The HTTP DAL repeats allowlists, replaces the image-presence bit with an authorized short-lived URL where available, and resolves only active shared catalog imagery for Photo Strings. Neither HTTP nor the ordinary authenticated RPC includes raw bucket/path fields or arbitrary owner-authored JSON metadata.

The public RPC remains the existing constrained `SECURITY DEFINER` read boundary because owner RLS intentionally blocks a visitor's direct table reads. Pure validation/projection helpers and the attachment trigger use `SECURITY INVOKER`. Every function has an explicit search path; anonymous/PUBLIC execute is revoked. Existing owner/table/storage RLS policies and grants are unchanged.

## Public imagery configuration

Other collectors' MediaAssets remain owner-RLS protected. A new isolated `server-only` Supabase client invokes **only** `get_public_room_media_locations(room_id, placement_ids)` in this code path. The function is `SECURITY INVOKER`, executable only by `service_role`, restricted to the same currently public, placed, eligible, first-500 rows and matching media owner/bucket. It returns no unrelated MediaAsset metadata.

The server requires `SUPABASE_URL` plus **server-only** `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) for this restricted locator. These are never mobile/`EXPO_PUBLIC_*`/`NEXT_PUBLIC_*` configuration. No credential value is included in diagnostics. Publishable/bearer/SSR clients remain viewer-authenticated for ordinary DAL reads and **storage signing**. Signed URLs use the viewer client and existing public-media storage policy (300 seconds), so the privileged client cannot bypass signing authorization. Missing locator configuration/lookup failure is an explicit error, not a fake success. Catalog-only/empty-media Rooms do not need the privileged lookup. Configure and verify this server prerequisite separately before eventual deployment/application.

This follows Supabase's [server-only secret key boundary](https://supabase.com/docs/guides/getting-started/api-keys) and [separate privileged client guidance](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z). A service key is broadly privileged by Supabase; isolation and the restricted RPC call path are deliberate. It is not used as a replacement for caller-auth clients.

## Transactions and verification limits

Repository migrations use no explicit BEGIN/COMMIT. The reviewed [Supabase CLI migration executor](https://github.com/supabase/cli/blob/develop/apps/cli-go/pkg/migration/file.go) batches compatible statements with the migration-history write; [pgconn ExecBatch](https://pkg.go.dev/github.com/jackc/pgx/v5/pgconn#PgConn.ExecBatch) executes that batch in an implicit transaction. These migrations contain no incompatible operations (concurrent indexes, VACUUM, etc.) or transaction control, preserving that behavior. Do not use an autocommit SQL editor as the application mechanism. The exact eventual installed runner/version still needs verification.

These are ordered once-only migrations, not universal idempotent scripts. Columns use IF NOT EXISTS; helpers/RPCs use CREATE OR REPLACE; named CHECK constraints and the attachment trigger are replaced deliberately. An atomic failed batch should roll back DDL and its ledger entry, permitting a corrected retry. IF NOT EXISTS does not prove an unexpected existing column has the correct type/default/constraint.

`npm run check:room-persistence` executes current TypeScript/Zod contracts and mocked real server functions, plus explicit SQL source assertions. `supabase/tests/room_persistence.test.sql` adds rollback-only pgTAP execution coverage for validators, grants, trigger/RLS behavior, missing Rooms, real 501-placement cap/order, private/unplaced media, and uppercase attachments. **No PostgreSQL/Supabase/Docker executable or existing disposable local database was available; that SQL suite was not executed.** Static tests and mocked signing are not SQL replay or real Storage authorization proof.

Local results: Slice 7, 7C, 7D, fixtures, scoped strict server compiler, focused persistence tests, and native verification passed. The initial online `mobile:verify` stopped at Expo Doctor's six newly published patch-version recommendations; the installed versions matched this installed SDK's bundled module list. `EXPO_OFFLINE=1 npm run mobile:verify` then passed Doctor (21/21), native compiler/lint, DEV iOS and production iOS/Android exports without dependency changes. This is an explicit installed-SDK verification; online version freshness remains a separate caveat.

Before application, verify the actual ledger and prerequisite columns/functions/roles/policies, inspect existing rows for constraint compatibility, replay against a confirmed disposable schema copy, execute pgTAP, and verify server secret configuration and viewer-authorized Storage signing. Production remains untouched during this repair.
