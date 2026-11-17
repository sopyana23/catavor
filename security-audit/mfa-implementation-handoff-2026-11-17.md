# MFA Fase 4 — Implementation handoff

Date: 2026-11-17
Baseline source HEAD: `aae215a`. Worktree recheck: `AGENTS.md` modified, two prior audit docs untracked, this plan/handoff untracked. Branch reported `agent-B`; verify exact workspace before production-code edits.

## Authorization / scope gate
The user's preference for industry-best-practice recommendations adopts the bounded MFA policy and authorizes source-code and disposable-test changes only. No deployment, target DB migration, service restart, credential rotation, live edge change, or production operational recovery is authorized. Organizational recovery runbook is not included in this patch and is not yet implemented.

## Decisions
- MFA mandatory for every canonical platform staff/admin account; merchants remain opt-in.
- Unenrolled staff may only use a short-lived, narrowly scoped enrollment capability; staged/cohort rollout, no admin/business access until enrollment. Prepare recovery before strict target enforcement.
- Fresh re-auth for enrollment/disable/reset, credential change and recovery, ≤10 minutes; if MFA active, prove second factor. Bind pending enrollment to user, expiry and one-time CAS.
- No app self-service bypass/recovery endpoint in scope. Backup codes remain second factors. Operational recovery requires a separate dual-control support runbook/approval and is not implemented here.
- PostgreSQL is durable authority for one-time challenge redemption, factor consumption, lockout and session. Verify factor + atomically consume challenge/factor + persist session before returning cookie/token; fail closed on DB errors. No claim of PG+Redis atomicity.
- Every session-issuing provider uses one shared MFA policy; config/schema unavailable must not create a staff bypass.
- Stable explicit `MFA_ENCRYPTION_KEY` separate from JWT secret is a deployment prerequisite; changes to keys/rotation are out of code-test authorization.
- N-56 live infrastructure and target DB changes are out of scope. Validate schema only on disposable DB.

## Minimal patch sequence
1. Reconcile canonical staff predicate, all login/provider/session issuance callsites, route groups, middleware token classes, feature flag, migration ledger/startup. No conclusion from empty search alone.
2. Implement durable PG challenge completion: unique JTI and transactional factor consumption + durable session creation. Row lock/CAS, duplicate redemption rejection; protect TOTP and backup parallel replay. Add immutable migration only if necessary; disposable PostgreSQL tests only.
3. Apply shared mandatory-staff policy to password, Google and every other session issuer. Unenrolled staff get restricted setup capability. Merchants remain opt-in.
4. Require re-auth and CAS for enrollment/disable; revoke old sessions on disable/reset. Implement atomic lockout/failure handling; no recovery endpoint.
5. Targeted/full backend tests, race tests, vet; frontends only if API contract changes. Runtime tests isolated/disposable.
6. Per-finding report (code-closed/runtime-proven/pending/unknown), review diff; recommend commit, do not commit without separate request.

## Acceptance evidence
- No full session token/cookie before second factor for enrolled users or mandatory staff.
- Unenrolled staff cannot access admin/business routes; enrolled staff challenge applies on every provider.
- At most one redemption/session per challenge even concurrent; DB/storage failure, replay, stale setup or missing durable session yields no token.
- Re-auth/CAS-safe setup/disable and old session revocation.
- Actual test exit statuses reported; no credentials/tokens/codes in artifacts.
- No production deployment, live DB migration, restart, key rotation or live N-56 change.

## Unknowns
N-60 target status, key continuity readiness, N-56 topology/live status, and raw results for historical tests are unknown. Historical reviews flagged async session persistence, MFA completion wiring, Google SSO and enrollment/disable/lockout gaps; revalidate all before modifying code.
