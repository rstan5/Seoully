# Production media and iOS release preparation

Local implementation only. No hosted migrations, configuration, uploads, builds,
Apple submissions, deployments or Git pushes are performed by these changes.

## Implemented boundary

Native Holding/Binder photos, catalog reference contributions, avatars and posts
now use `POST /api/mobile/uploads` (JSON authorization), Supabase's single-object
signed upload API, then `POST /api/mobile/uploads/:id` (JSON completion). Both
Next handlers use the Node runtime. Metadata bodies are streamed with a 16 KiB
limit. Media bytes go directly from Expo File to the configured Supabase client;
no arbitrary upload host, bucket or destination is accepted from a screen.

Authentication uses the existing bearer client and canonical Seoully identity.
Seoully user IDs are NOT Supabase Auth IDs. The server checks Holding ownership,
catalog contribution/ownership permission, and permitted tag existence using the
caller's existing RLS context. Only then does its server-only privileged Storage
client issue a non-upsert token for an immutable random staging object.

`media-upload-staging` is private, capped at 50 MiB and has no anonymous or
ordinary authenticated policies. A token authorizes exactly one staging object
for Supabase's two-hour validity period. No signing token is persisted on-device.
The owner-scoped ticket binds purpose, context, MIME, exact size and post metadata.
Changing retry details is rejected; authentication is rechecked at completion.

Completion checks actual Storage metadata and byte signatures; streamed SHA-256 checks also verify exact bytes on copy collisions. Images are also
fully decoded, with a 64-megapixel safety bound, without changing original bytes,
orientation or crop. Header-only/truncated images are rejected. Existing supported
video container signatures remain supported; no new native video picker is added.
Storage performs the copy to the established destination; Vercel does not proxy it.

The service-only completion RPC locks the ticket. Post, media metadata, collector
and collectible tags, and the completion receipt commit atomically. Concurrent or
lost-response retries return the same result, not a second post. Deleted posts
are not recreated from their receipts. No upload operation creates a Holding.

Private receipts are inaccessible to anon/authenticated roles. The RPC cannot be
called by mobile clients to bypass server verification. Public responses contain
existing safe DTOs, never ticket payloads, source keys, private paths or tokens.
Authorization responses necessarily contain the requesting owner's staging path
and single-object token; these must never be logged or published.

## Flow audit

- Personal Holding/photocard photo: `api.uploadHoldingPhoto` → direct upload,
  `collectible-media`, `media_assets.holding_id`. JPEG/PNG/WebP ≤10 MiB. Owner-only
  association, existing private/public-Room read rules unchanged. Binder continues
  to resolve the same personal-photo association; no geometry/texture changes.
- Catalog reference: `api.uploadCatalogReferencePhoto`, `communityCatalog` and the
  existing explicit legacy image action → direct upload, `catalog-reference-images`,
  `catalog_reference_images.collectible_template_id`. JPEG/PNG/WebP ≤10 MiB.
  Explicit sharing only, contributor or owner authorization, active shared-image
  reads retain existing authenticated signing. Migration 11 publishes valid entries
  immediately. No personal image is automatically reused or made public.
- Avatar: `api.uploadProfileAvatar` → direct upload, `profile-avatars`, existing
  owner/submission.jpg path. JPEG ≤5 MiB. Upload confirms the avatar submission;
  existing Edit Profile Save selects `profiles.avatar_id`. Public projection still
  signs only the selected avatar. An upload alone never changes the Profile.
- Post: Create screen → `api.createNativePost` → direct upload, `post-media`,
  `posts`, `post_media`, `post_user_tags`, `post_collectible_tags`. Existing 50 MiB
  JPEG/PNG/WebP/MP4/WebM/QuickTime contract. Native picker remains photos-only.
  The existing post destination bucket is public; selecting a post photo explicitly
  means public post media. Random copied objects can exist before DB commit on a
  failed completion; cleanup removes these unassociated objects after expiration.
  Private Holding/Avatar/catalog buckets remain private.
- Web prototype's local representation/photo features are unchanged. Older multipart
  routes and server actions remain for compatibility. They are NOT upgraded into
  a new production web media client and retain Vercel's request-size limitation.
  Repository search found no production web composer invoking those upload actions.
  Do not advertise large legacy multipart uploads as Vercel-compatible.

Changed post drafts are handled without duplicate publishing: a server row lock
cancels an unfinished previous attempt before a fresh operation is authorized.
Late callbacks cannot publish the canceled attempt. If the original already
committed, the collector is told it was shared and their edits remain intact;
an explicit “Start a new post with these edits” action is required for another post.
Nothing silently drops tags or replaces committed content.

Native transport rejects overlapping changed intents instead of silently coalescing
different content. Composer fields are disabled while a publish is pending.
Native transport coalesces concurrent identical operations and persists owner-scoped
retry IDs and descriptors in AsyncStorage. No bearer or signed token is stored
there. Post drafts now have a durable operation UUID, account-scoped metadata and
private document-directory photo copy. Clear the draft only after confirmed success;
a process death after server commit recovers the same receipt. Legacy unscoped
composer drafts are not automatically assigned to another signed-in account.

Expired pending jobs can renew authorization under the same ID after authorization
and unchanged-payload checks. Completed receipts remain available after expiry.
`cleanupExpiredUploads` is a server-only operational hook, not a public endpoint
or automatically enabled cron. It claims at most 25 jobs older than the expiration
plus a 24-hour grace, deletes staging objects and tracked unassociated failed copies, then
acknowledges the claim. It never deletes completed destination media or receipts.
Claims exclude renewal/completion, and failed workers may be reclaimed after an
hour. Before release, approve a protected periodic worker/schedule for this hook;
monitor staging age, rejected media, failure rates and Storage capacity. No cleanup
has been executed against production. A process death between Storage copy and recording
its successful creation can leave an untracked orphan; cleanup conservatively leaves
that object for an association-aware inventory review rather than risk deleting an
existing object. Replaced personal/unused avatar files retain
the existing ownership protections; broader retention/deletion policy needs review.

## Database rollout dependency

A fresh read-only production inspection during this task confirmed migration 09:
20 Profiles, 20 Rooms, 12 photocard templates, 29 Holdings, 10 MediaAssets, no shared
references and no orphan Holding links. The upload-jobs table is not present yet.
These are database metadata checks, not verification of every stored media byte.

Pending order:
1. `20261010000000_profile_post_reposts.sql`
2. `20261011000000_catalog_image_publication.sql`
3. `20261012000000_direct_media_uploads.sql`

Migration 12 is additive: private staging bucket, owner-keyed server-only job table,
cleanup index and five hardened service-only RPCs. It also revokes authenticated raw reference-row
inserts so unverified clients cannot bypass image decoding. The legacy reference
DAL retains its authenticated ownership checks and now decodes imagery and uses a
server-only publication RPC that rechecks context permission atomically with the insert.
Before migration 12 only, a missing-RPC response uses the existing authenticated
insert/RLS after full decoding. Authorization errors never trigger this fallback;
after migration 12 the revoked raw insert also makes a stale schema cache fail closed. It rewrites no existing
Profile, template, Holding, placement, count or repost records and alters no
existing policies. The sole existing grant tightening is reference INSERT; all
other existing grants remain. Migration 11 retains legacy `needs-media` discovery and
ownership identities; explicit image contribution updates the existing template.

Before separate approval: repeat linked-project/head/schema checks, fresh private
DB recovery backup and verification (plus a separate plan for Storage bytes),
inspect the exact three pending migrations and dry-run scope. Apply only approved
files, verify grants/RLS/data preservation, then deploy the backend, then distribute
the compatible mobile build for this initial rollout. If a backend is already serving
collectors, first roll out this backward-compatible legacy upload implementation
before migration 12 revokes its old authenticated insert permission; activate the
new direct-upload mobile client only after migration 12. Use a quiet controlled
window and do not leave an older backend behind the tightened reference grant. The new mobile upload path intentionally fails closed
against a backend/database without migration 12. Do not release it ahead of them.
No migrations were applied by this task.

## Vercel environment and rollout

The repository root is the Next application. Build with `npm ci` and `npm run build`.
The deployed backend needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and one server-only
SUPABASE_SECRET_KEY (or deliberate legacy SERVICE_ROLE alternative), plus SITE_URL
and existing assistant configuration. Never place privileged values in Expo vars.
Use a stable approved HTTPS API origin, without `/api`, and no Vercel login wall.
Choose and verify the origin; none is invented here. Verify Storage's hosted global
limit, egress/storage quotas and request-rate controls before beta.

Deploy the compatible backend before migration 12 when any backend is already active. Keep the new direct-upload client disabled until all three migrations are verified. Smoke tests must use separately
authorized development/beta accounts and genuine intended contributions, not mutate
other collectors' data. Verify max-size media through Supabase, invalid/oversized
rejection, delayed/lost responses, shared thumbnails and private-media isolation.
Rollback backend/mobile compatibly; receipts and schema are additive and should
remain. Prefer forward fixes over dropping tickets or reverting published imagery.

## EAS archive and release configuration

Committed root `.gitignore` covers nested backups, dump formats, env secrets,
credentials, signing files and sensitive development directories. No `.easignore`
is added: it would override nested gitignore rules and risk dropping exclusions.
The actual EAS CLI Ignore matcher is tested without copying, compressing or uploading
files. Required monorepo source, manifests, lockfiles, assets, config and R3F patch
remain included. `requireCommit: true` adds a release safeguard, not a substitute
for ignore rules. Never place secrets in source/assets or public env variables.

`apps/mobile/eas.json` prepares store-distributed preview/production profiles, distinct
channels/environments, remote build numbers and automatic increments. Both profiles
set SEOULLY_RELEASE_CONFIG=1. `app.config.ts` fails closed until these approved values
are supplied: SEOULLY_EAS_PROJECT_ID, SEOULLY_IOS_BUNDLE_IDENTIFIER and a public HTTPS
EXPO_PUBLIC_API_URL. Local Expo Go keeps the existing app config. No project ID,
registered identifier, Apple account or HTTPS origin has been invented or linked.

Expo SDK-compatible `expo-updates` is installed locally. Release config uses
`runtimeVersion: { policy: "fingerprint" }` and the approved EAS project's update
URL. No production update/channel is created or published. Native dependency,
permission or configuration changes require a compatible NEW binary. Test JS-only
updates on preview with the same runtime; only after device approval publish/promote
the exact verified update with production environment values. Monitor crashes and
roll back to the last compatible update or embedded update. Never point an existing
binary at arbitrary native functionality or change channels during this task.

Remaining setup: chosen Expo owner/project, registered bundle ID, Apple Developer
membership, signing and provisioning, App Store Connect app/numeric ID, submit
profile, preview/production public Supabase + HTTPS API env, native permission copy,
privacy labels/manifests, age rating, support/privacy URLs, screenshots and review
access. Visual inspection confirms `apps/mobile/assets/icon.png` is still the Expo
template icon; supply an approved Seoully app icon before the store build. App Review also needs verified account deletion and UGC report/block/filter
and response workflows; this task does not implement or certify them. They were not
found as production-backed native flows in the scoped audit and require readiness
review before public submission. Automatic catalog publication does not require a
human preapproval queue, but does not replace abuse reporting and response.

Recommended authorized future commands (NOT executed): from apps/mobile,
`npx eas-cli@24.14.0 build --platform ios --profile preview`, then an explicitly
configured `submit --platform ios --id <verified-build-id>` after Apple setup.
Preview is a store/TestFlight build, not ad hoc. Invite 10–20 collectors only after
backend smoke tests; external testers require Apple's beta review. After critical
bugs are resolved, prepare the production-channel binary and App Store submission.
Do not assume a preview-channel TestFlight binary automatically changes channels
when promoted to the App Store. Test the production candidate in TestFlight too.

## Authentication

The installed Supabase SDK expects an authorization CODE, not the callback URL.
The handler now accepts only `seoully://auth/callback`, parses exactly one nonempty
code, forwards a validated optional SDK `sb_flow_id` to its matching PKCE slot,
rejects foreign/error/fragment links and coalesces cold/warm duplicate events.
It checks returned errors and ignores callbacks after disposal. PKCE enables the
SDK's existing persisted verifier; password authentication and session persistence
remain unchanged. No OAuth provider or confirmation requirement is enabled.
Future callback use requires the approved Supabase redirect allowlist entry and
appropriate redirectTo; these hosted settings were not changed. Current password
sign-in does not require a callback; a custom-scheme callback needs the standalone
app/development client and has not been tested through Expo Go. Expired/malformed callbacks fail safely without
logging credentials, codes or tokens.

## Physical iPhone acceptance

After separately approved schema/backend rollout, use an isolated signed-in test
collector. Create a photo/caption post with multiple collectible and collector tags;
interrupt once and retry, then force-close/reopen. Confirm one post and retained
media/tags. Replace avatar and save/reopen Profile. Add existing photocard with a
private photo and verify Binder imagery. Contribute a distinct new image-backed
item and find it from another collector in search/tagging/wishlist. Explicitly
remediate a legacy image-less item and verify identical template/Holding links.
Verify unauthorized viewers cannot access personal media. Exercise onboarding,
Profile/Room/Home, returning welcome and language switching. On TestFlight, repeat
on cellular without the Mac, then test one compatible preview OTA and rollback.
No physical iPhone or live Storage end-to-end verification is claimed here.

Sources: https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl
https://supabase.com/docs/reference/javascript/storage-from-copy
https://supabase.com/docs/reference/javascript/storage-from-info
https://vercel.com/docs/functions/limitations
https://docs.expo.dev/build-reference/easignore/
https://docs.expo.dev/eas-update/runtime-versions/
https://docs.expo.dev/submit/testflight/
https://developer.apple.com/app-store/review/guidelines/

## Local verification result

418 Node regression tests passed, including direct media/HTTP/SDK/retry tests,
social integration, catalog/identity, Profile, Room/Binder, real Expo Router lifecycle,
web/native type boundaries, crop and shared loading regressions. Startup and the
existing physical-QA assertion scripts passed. Stale multipart/header harness
expectations were updated to the verified current contracts, not suppressed.

The isolated network-disabled PostgreSQL replay applied all 28 local migrations and
passed 480 pgTAP assertions, plus real two-session catalog and post completion races.
`npm run build`, root/server and mobile typechecks, mobile lint and the Expo Go iOS
export passed. Native configuration introspection confirmed camera/photo permission
strings and no unused microphone permission.

No physical iPhone verification, live authorized Storage upload, signed cloud build,
TestFlight/App Store submission or hosted production rollout was performed. These
remain explicit acceptance steps after the required approvals and configuration.


## Controlled deployment preflight — 2026-10-15

Baseline: clean `mobile-native` at `21c8423`. Read-only linked-project inspection
confirms `ttmynanbwxlvcczeobgj`, migration head `20261009000000`, 20 Profiles,
20 Rooms, 12 templates, 29 Holdings, zero shared references and zero orphan
Holding links. No upload-jobs table exists yet. These aggregate checks establish
metadata preservation, not a byte-level audit or exhaustive hosted schema diff.
Only local migrations 10, 11 and 12 follow that head.

Accessible Vercel inventory contains ryan-stanford, proof-ai and coursemap-ai;
no Seoully project is present in that scope. No repository Vercel link/configuration
establishes an existing Seoully deployment. Other accounts are not ruled out.

### Configuration contract

Use repository root `.`, Next.js preset, `npm ci`, `npm run build`, framework-default
output (no static export/output override), Node.js 24.x matching local validation.
Keep native builds separate. Choose the account/team and production branch explicitly;
never accept an unrelated existing project or assume `main` is the approved source.
Initially use the assigned stable production `*.vercel.app` hostname. A custom domain
is optional only after ownership is confirmed. Preview URLs are not the mobile API origin.

Production server variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY` (or deliberate `SUPABASE_SERVICE_ROLE_KEY` alternative),
`SITE_URL`; existing assistant requires `OPENAI_API_KEY` and `OPENAI_MODEL`.
`OPENAI_VISION_MODEL` is optional existing identification configuration, not a launch
requirement or authorization to enable identification features. Database passwords
are migration/backup operator credentials, not backend runtime variables.
Store privileged keys only in server environment configuration; no `NEXT_PUBLIC_`
or `EXPO_PUBLIC_` privileged keys. Server privileged modules use `server-only`.
Preview should use an isolated staging project and its own origin/credentials;
do not run preview write tests against production. Development retains local values.

Native release needs public `EXPO_PUBLIC_API_URL` (origin only),
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` plus approved
EAS project/bundle configuration already described above. Public key is not a substitute
for authenticated bearer identity. Native HTTP does not require browser CORS;
same-origin web routes need no cross-origin allowance. No wildcard CORS is introduced.
Future cross-origin browser clients need a deliberate allowlist. Keep API responses
accessible without a hosting login redirect while enforcing application authentication.
Custom-scheme callbacks require a separately approved Supabase redirect allowlist;
password sign-in remains unchanged and does not require that callback.

### Migration and operational findings

10 creates authenticated profile-only repost relationships and an invoker timeline;
original post visibility remains authoritative. 11 adds publication state and classifies
legacy image-less templates as searchable `needs-media`; it does not remove ownership
or merge identities. New entries remain drafts until a stored reference is present.
12 adds private staging/jobs and service-only completion/renewal/cleanup/abandon/reference
RPCs, and removes authenticated raw reference INSERT. Server image decoding and atomic
permission rechecks enforce publication. Public post media remains the existing explicit
public-post bucket; personal media is not automatically contributed.

Migrations are ledger-managed one-time SQL, not scripts to rerun blindly. RPC retries
are idempotent; a failed migration must be inspected against the ledger before retry.
Regular index creation and ALTER TABLE acquire locks; the template UPDATE touches 12
current rows. Expected load is small but a fresh lock/long-transaction inspection is
mandatory in the approved quiet window. Local isolated tests cannot certify hosted
PostgREST cache refresh, Storage service behavior, quotas or live serverless latency.

Required buckets: private collectible-media (10 MiB), private catalog-reference-images
(10 MiB), private profile-avatars (5 MiB), existing public post-media (50 MiB), and
migration-created private media-upload-staging (50 MiB, no ordinary-user policies).
Verify hosted global limits/MIME policies and capacity before enabling uploads. A protected
periodic worker for `cleanupExpiredUploads` is not installed; approve and implement its
operational invocation before sustained release traffic. Never expose it anonymously.

### Ordered rollout and approval gates

1. **REQUIRES USER APPROVAL — fresh recovery backup.** Reconfirm project, head,
   committed hashes, pending list and quiet-window locks. Use the established pinned
   Supabase CLI/Docker workflow: roles, schema, COPY data, migration-history schema/data
   in a new ignored `.backups` directory with directory 0700/files 0600. Verify nonempty
   files, checksums, COPY structure, ledger, aggregate counts, Auth/Storage metadata and
   an isolated restore rehearsal. Existing helper scripts are hardcoded to older heads;
   update their guards locally before use, never execute them unchanged. Database dumps
   do not include Storage object bytes: separately authorize a private object backup or
   documented provider recovery plan. No fresh backup was created in this preflight.
2. **REQUIRES USER APPROVAL — Vercel project configuration.** Select owner/team,
   create/link only Seoully, verify Git repository/source commit and production branch.
   Disable unintended automatic production promotion during controlled rollout.
3. **REQUIRES USER APPROVAL — server environment configuration.** Supply the above
   server values in Production; isolate Preview. Set SITE_URL to the assigned HTTPS origin.
4. **REQUIRES USER APPROVAL — HTTPS backend deployment.** Deploy this compatible
   backend; verify unauthenticated API rejection, origin/TLS and no hosting login wall.
   Before migration 12 new direct uploads fail closed; do not release the new native
   client yet. If an older backend exists, replace it before grant tightening. A first
   deployment may instead follow the migrations within the same approved quiet window,
   but there must never be an active old reference-upload backend after migration 12.
5. **REQUIRES USER APPROVAL — database rollout.** Re-run verified linked CLI dry-run;
   it must list only 10 → 11 → 12. Apply exactly that approved set with the established
   CLI workflow. Stop on extra files, drift or a changed head. Verify head 12, grants,
   policies, buckets, RPC signatures and unchanged identity/Holding/placement rows;
   legacy templates gain only the intended publication classification.
6. **REQUIRES USER APPROVAL — operational storage/cleanup configuration.** Verify
   hosted caps, retention and monitoring; install an authenticated protected cleanup
   schedule with bounded batches, leases and alerts. Preserve completed receipts.
7. **REQUIRES USER APPROVAL for smoke-test writes.** Use an explicitly authorized
   signed-in collector, not synthetic production accounts or another collector's data.
   Test photo/caption/both tag types, lost-response retry (one post), avatar save,
   private Holding photo, new image-backed contribution/reuse from another collector,
   legacy reference remediation without new identity, wishlist/counts and profile-only
   repost/undo. Confirm unauthorized/cross-owner rejection and private-media isolation.
8. **REQUIRES USER APPROVAL — native release environment.** Set the verified public
   HTTPS origin and approved public Supabase/EAS identifiers. Do not distribute until
   backend/schema/storage checks pass; no LAN/localhost release origin.
9. Physical iPhone acceptance: cellular without Mac, interrupted upload/relaunch,
   onboarding completion/Profile/Room/Home, Binder textures, language and returning welcome.
   Record failures; automated tests do not constitute device approval.
10. **REQUIRES USER APPROVAL — TestFlight.** Complete Apple/EAS signing, icon/privacy/
    review requirements; approve cloud build/archive upload and submission separately.
    Test the production candidate as well as the preview channel before public release.

### Failure recovery

Stop client distribution on any failed gate. Roll back to a compatible backend build
that retains verified reference publication; do not restore an old raw-INSERT backend
or regrant unsafe writes. Prefer additive forward fixes; keep upload receipts to prevent
lost-response duplicates. Do not drop new tables or erase published associations as a
rollback shortcut. A full restore requires separate approval, a write pause, verified
DB/Storage recovery artifacts and explicit handling of writes after the recovery point.
A backup without a restore rehearsal is not a proven recovery guarantee.

### Preflight decision

Vercel: **BLOCKED for launch**, locally build-ready; project/origin/env and live smoke
verification remain. Migrations: **READY for controlled approval**, subject to a fresh
verified recovery point, unchanged head/schema/lock checks and precisely scoped dry-run.
No production deployment or migration is authorized by this document. First action:
approve the fresh recovery backup and choose the Vercel owner/project; application and
mobile distribution remain later, separate approval checkpoints.


Verified local validation for this preflight: Next.js production build, root and mobile
TypeScript, mobile lint, Expo iOS export; 28 media-release + 28 social integration +
48 navigation lifecycle tests; startup checks. Isolated PostgreSQL replay passed
28 migrations and 480 pgTAP assertions, the added exact 09 → 10 → 11 → 12 upgrade
trial, historical preservation and real concurrent catalog/post retry tests.
CLI `npx supabase@2.121.0 db push --linked --skip-vault --dry-run` succeeded and
proposed only the three approved pending filenames. This was not an application.

Recorded SHA-256 migration fingerprints:
- 10: `fa7cccb6860320f385f86ce3f329b0a1c18db0dbcbf3d3a3a7b824f0f3ff5e35`
- 11: `d1571a2707261d20b008673a165b5f9c0c37a0a00aa8fd795eab8a406b60928b`
- 12: `9988370f1620732c619cd443cc04b37dd9c894a4a5e1809e71721e05b6f47084`

Backup command family verified against the existing workflow (NOT executed here):
`npx supabase@2.121.0 db dump --linked --role-only --file <private-directory>/roles.sql`,
then schema dump with no mode flag, data dump with `--data-only --use-copy`, and
separate schema/data dumps with `--schema supabase_migrations`. Substitute a newly
created protected ignored directory, verify the target first, and retain private logs.
Never run the old hardcoded backup/apply helpers against this new migration head.

Platform references: [Vercel function constraints](https://vercel.com/docs/functions/limitations)
and [Supabase backup scope](https://supabase.com/docs/guides/platform/backups).
Metadata request bodies are capped at 16 KiB; legacy multipart uploads still face
Vercel's 4.5 MB request limit. Storage bytes require a separate recovery plan.
