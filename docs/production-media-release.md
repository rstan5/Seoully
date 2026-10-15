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

Deploy metadata handlers only after the migration. Smoke tests must use separately
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
