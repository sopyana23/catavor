-- N-60: persistence prerequisites for MFA / 2FA.
-- This is the immutable tracked migration. Legacy installs with an empty ledger
-- require an explicit operator upgrade; the runner's legacy baseline skips it.

ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enforced BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret_enc TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enrolled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_setup_jti VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_last_totp_step BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_two_factor_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_two_factor_enforced ON users(two_factor_enforced) WHERE two_factor_enforced = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_platform_role_2fa ON users(platform_role, two_factor_enabled);
CREATE INDEX IF NOT EXISTS idx_users_two_factor_setup_jti ON users(two_factor_setup_jti) WHERE two_factor_setup_jti IS NOT NULL;

CREATE TABLE IF NOT EXISTS two_factor_recovery_tickets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_by_staff_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    cooling_off_expires_at TIMESTAMP WITH TIME ZONE,
    cancellation_token_hash VARCHAR(255) NOT NULL,
    approver_1_staff_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approver_1_nonce VARCHAR(64),
    approver_1_signature VARCHAR(255),
    approver_1_at TIMESTAMP WITH TIME ZONE,
    approver_2_staff_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approver_2_nonce VARCHAR(64),
    approver_2_signature VARCHAR(255),
    approver_2_at TIMESTAMP WITH TIME ZONE,
    execution_method VARCHAR(50),
    break_glass_nonce VARCHAR(64),
    break_glass_actor VARCHAR(100),
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_2fa_recovery_user_state ON two_factor_recovery_tickets(user_id, state);

CREATE TABLE IF NOT EXISTS mfa_auth_completions (
    id BIGSERIAL PRIMARY KEY,
    purpose VARCHAR(50) NOT NULL,
    token_jti VARCHAR(64) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    factor_type VARCHAR(20) NOT NULL CHECK (factor_type IN ('totp', 'backup_code')),
    consumed_hash_ref VARCHAR(64),
    session_id BIGINT NOT NULL REFERENCES user_sessions(id),
    payload_enc TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending_redis' CHECK (status IN ('pending_redis', 'redis_committed', 'manual_recovery')),
    redis_committed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mfa_bcc_purpose_jti ON mfa_auth_completions(purpose, token_jti);
CREATE INDEX IF NOT EXISTS idx_mfa_bcc_status ON mfa_auth_completions(status) WHERE status <> 'redis_committed';
CREATE INDEX IF NOT EXISTS idx_mfa_bcc_user ON mfa_auth_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_bcc_expires_at ON mfa_auth_completions(expires_at);

CREATE TABLE IF NOT EXISTS mfa_account_lockouts (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    window_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_until TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mfa_challenge_failures (
    token_jti VARCHAR(64) NOT NULL,
    lease_generation BIGINT NOT NULL CHECK (lease_generation > 0),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (token_jti, lease_generation)
);
CREATE INDEX IF NOT EXISTS idx_mfa_challenge_failures_created_at ON mfa_challenge_failures(created_at);
CREATE INDEX IF NOT EXISTS idx_mfa_challenge_failures_user_created ON mfa_challenge_failures(user_id, created_at);
