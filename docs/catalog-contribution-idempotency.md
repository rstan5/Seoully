# Manual catalog submission retry safety (local repair)

`20261005000000_catalog_contribution_idempotency.sql` is pending. Do not apply it
until separately approved. It does not change Room, onboarding, or media schema.

The existing `create_catalog_contribution(jsonb)` RPC accepts optional
`submissionKey` (canonical UUID text). One authenticated collector plus one key
identifies one create operation. Repeating its original JSON details returns the
stored original RPC result, without updating catalog entities or adding history.
Reusing that key with different details raises SQLSTATE 22023. A new key permits
a later intentional contribution; another collector may use the same UUID.

The nullable `submission_key` / `submission_result` columns leave historical
records unchanged. A partial unique collector/key index and paired-state CHECK
protect persisted records. A transaction-scoped advisory lock serializes keyed
calls before any catalog upsert; the complete operation and cached result commit
atomically. A rolled-back create does not reserve a key. Hash collisions only
serialize unrelated operations. The supported RPC request isolation is normal
PostgREST READ COMMITTED, tested with two real PostgreSQL sessions.

Existing unkeyed callers deliberately retain their previous non-idempotent
behavior and response shape. They should opt in when retry safety is needed.
Template identity deduplication and contribution history remain separate.

SECURITY DEFINER remains necessary: authenticated callers have no direct write
privilege on these shared tables. Identity comes from the existing authenticated
identity helper, never a supplied user ID. The function keeps its explicit
`pg_catalog, public, auth` search path and schema-qualified application relations.
Existing execution grants are preserved; no PUBLIC/anon write capability or RLS
change is introduced. Cached results are scoped by authenticated collector and
not exposed through table grants.

Native manual Add uses one canonical API path. It persists a UUID before sending,
retains it after failures (including a lost committed response), and coalesces
simultaneous presses. Pending keys are stored per auth collector and exact draft
in AsyncStorage; credentials are never stored there. Re-entering the same draft
after relaunch retrieves that operation's key. Edited details represent a new
submission, while the original pending key remains recoverable. After confirmed
success the key is cleared, so a later intentional submission gets a new UUID.
The exact-draft lookup is only local recovery bookkeeping: database enforcement
uses the explicit collector/UUID key, never fuzzy payload/template deduplication.

Catalog retries do not create ownership or media. The existing `/add` confirmation
continues to create Holdings and upload media separately. This repair does not
claim general idempotency for those separate operations or resume Slice 8.

## Local verification

- `npm run check:catalog-idempotency` exercises key lifetime, relaunch, parallel
  taps, native API forwarding, DAL validation, and separation from Holding/media.
- `node scripts/check-catalog-database.cjs /absolute/path/to/docker` starts the
  isolated Supabase PostgreSQL 17.6 image with no network or exposed ports,
  replays all migrations, tests historical rows across migration 05, runs both
  pgTAP suites, and proves actual advisory-lock contention in two sessions plus
  committed-response-loss recovery. The container is removed on completion.
  Its Auth/Storage bootstrap is a local substitute, not hosted service testing.
- Existing Room in-memory verification remains available through
  `scripts/check-room-database.cjs`, now sharing the same disposable bootstrap.

No hosted database URL/password or production API is used by these test runners.
