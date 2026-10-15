# Community catalog publication

Valid authenticated contributions publish automatically; `status=community` is
provenance, not a moderator queue. Publication is a separate database state.

## Native journey

Manual contribution requires title, artist/group, type and an explicitly shared
reference photo. Member/release/edition distinguish otherwise similar items.
Before creation, bounded searches of those fields show existing templates with
reference artwork and version metadata. Selecting a match opens the existing
personal-copy flow. Confirming a distinct candidate requires version details;
ambiguous historical identities are rejected rather than merged.

The contribution operation persists its exact details, retry UUID and a private
app-document copy of the selected reference. It creates/reuses a draft template,
uploads one authorized shared reference, then reads back `publication_state` and
a usable signed reference URL. Only confirmed publication opens `/add`.
The existing Holding UUID/reconciliation flow creates the user's independent copy.
No private personal photo is implicitly published, and a second shared upload is
not requested. The reference bucket remains private; existing authenticated shared
image policies/signed URLs serve the community.

An interrupted operation resumes with the same contribution/reference retry key.
Already-published matches reuse their image. Completed operations and replacement photos
clean up only app-owned local reference copies. Server errors preserve the draft.

## Existing image-less entries

Read-only hosted audit on 2026-10-14: 12 templates, all photocards, zero reference
rows. No production data was changed. Names alone cannot establish duplicates.

Migration 11 classifies existing image-less templates `needs-media`; they remain
searchable and their IDs, Holdings, placements, wishlists and tags are preserved.
New entries start `draft` and are not publicly discoverable. Missing imagery is
labelled honestly, not represented as a successful reference upload.

A copy owner opens their owned collectible details and chooses **Contribute a
shared reference photo**, explicitly selects/crops a photo they may share, and
uploads it into the separate community reference bucket. The existing template
publishes automatically once the stored reference is valid. Personal media is
never copied from private storage. This is gradual owner-driven remediation;
there is no bulk backfill, deletion, forced recreation or automatic merge.

## Rollout dependency

Read-only remote migration listing: head `20261009000000`; migrations 10 (reposts)
and 11 (catalog image publication) are unapplied. Migration 11 already contains
automatic publication, contributor/owner authorization, private retry-key protection,
legacy classification and typographic identity matching. Its automatic-publication
intent is now explicit in its comment; no additional migration is needed here.
The updated server refuses contribution writes if that schema is unavailable.
Existing catalog reads and personal copies remain supported during rollout.

Do not run a blanket database push: review/approve pending migrations separately.
No production migration, data mutation, push or deployment was performed.

## Verification boundaries

`check:community-catalog` covers native orchestration/storage and publication
confirmation. `check:social-integration` exercises the actual catalog DAL and shared
search/tag imagery. The isolated Docker migration runner replays all migrations,
executes pgTAP owner/public/private checks and independent concurrent submissions.
Its Auth/Storage tables simulate service boundaries; physical Expo Go media,
network interruption and second-account end-to-end testing still require device QA
after approved database rollout.
