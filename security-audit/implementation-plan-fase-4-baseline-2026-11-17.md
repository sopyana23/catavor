# MFA Fase 4 — Implementation Plan

**Status:** Best-practice scope adopted; bounded source-code and disposable-test work authorized. No production deployment, target DB migration, credential rotation, live infrastructure change, or operational recovery is authorized.

**Baseline:** Source HEAD `aae215a` (`feat(mfa): complete TOTP and backup-code login flow`). Worktree status has pre-existing `AGENTS.md` changes and untracked audit artifacts; preserve them. Verify exact branch/status before code changes.

## Scope decisions

1. MFA mandatory for all canonical platform staff/admin accounts; merchants remain opt-in.
2. Unenrolled staff may access only a short-lived narrowly scoped MFA setup capability, never admin/business routes. Roll out in cohorts and do not enforce against target before enrollment and recovery readiness.
3. Re-authenticate sensitive enrollment/disable/reset/credential changes within 10 minutes; prove second factor if MFA already active. Pending enrollment is user-bound, expiring and CAS-protected.
4. No application self-service bypass/recovery endpoint in this patch. Backup codes remain second factors. Operational recovery requires a separate dual-control support runbook, not implemented here.
5. PostgreSQL is durable authority for one-time challenge completion, factor consumption, lockout, and session. No token/cookie until all are committed. Fail closed on storage errors; do not assume PG+Redis atomicity.
6. All login/session providers use one policy. Mandatory MFA cannot be bypassed by disabled feature flag, missing config, or schema errors.
7. `MFA_ENCRYPTION_KEY` must be explicit/stable and separate from JWT secret; legacy ciphertext compatibility and rotation readiness are deployment prerequisites, not changed here.
8. N-56 live edge and target DB changes are out of scope. Migration verification uses disposable PostgreSQL only.

## Minimal patch sequence

A. Revalidate canonical staff predicate, all login/provider/session issuance callsites, route groups, middleware token classes, feature flag and migration behavior. Do not infer absence from empty identifier searches.

B. Centralize `requiresMFA(user)` (staff OR enrolled account). Apply before every normal session issue: password, existing-user Google, and each other issuer. For unenrolled staff issue only a restricted setup credential; explicitly gate all admin/business APIs. Merchants retain current behavior unless enrolled.

C. Implement durable single-use completion: in one PostgreSQL transaction lock/recheck user and challenge, validate TOTP/backup factor, CAS-consume factor, insert unique challenge-JTI completion and durable `UserSession`; commit before cookie/token. Same challenge under concurrent requests may result in at most one session. Use additive immutable migration only if source/schema review proves necessary; do not alter a migration that has been applied. No raw bearer in completion. Rework session repository boundary if necessary for transaction participation.

D. Harden setup/disable with fresh re-auth, expiry, user binding, CAS, and revocation of prior sessions. Make MFA lockout/failure counters atomic and fail closed on storage errors. No recovery endpoint; do not silently clear staff enforcement through disable.

E. Keep desktop/mobile/tablet API contract aligned only if a client change is needed. Verify existing MFA challenge UI handles the shared response.

## Required tests

- Staff enrolled/unenrolled across password, existing Google, and every discovered session issuer; merchant enrolled/unenrolled.
- Setup credential cannot access admin/business APIs; feature flag/config/schema failures fail closed.
- Valid/wrong/expired challenge; TOTP replay and backup reuse; duplicate JTI serial and parallel redemption.
- Fresh JTI brute-force/lockout and storage-fault semantics.
- DB failure before commit returns no bearer/cookie and leaves no partially consumed factor.
- Enrollment races, disable re-auth and previous session revocation.
- Existing login response compatibility; frontend regression/build/E2E if contract changes.
- Run only on disposable/test DB. Report real commands/output; build alone is not runtime proof.

## Gate boundaries

Code and disposable-test changes are authorized. Target DB status (including N-60), N-56 topology, key backup/rotation readiness, and prior raw test output are unknown. No target migration, deployment, service restart, live edge change, credential rotation, or operational recovery is authorized. Report each item as code-closed, runtime-proven, pending, or unknown; do not claim the system is fully secure.
