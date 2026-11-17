package models

import "time"

// TwoFactorRecoveryTicket tracks an explicitly authorized account recovery workflow.
// State transitions are enforced by the recovery service, not by this persistence model.
type TwoFactorRecoveryTicket struct {
	ID                    uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID                uint       `gorm:"not null;index:idx_2fa_recovery_user_state,priority:1" json:"user_id"`
	State                 string     `gorm:"size:50;not null;default:REQUESTED;index:idx_2fa_recovery_user_state,priority:2" json:"state"`
	RequestedAt           time.Time  `gorm:"not null" json:"requested_at"`
	VerifiedByStaffID     *uint      `json:"verified_by_staff_id,omitempty"`
	VerifiedAt            *time.Time `json:"verified_at,omitempty"`
	CoolingOffExpiresAt   *time.Time `json:"cooling_off_expires_at,omitempty"`
	CancellationTokenHash string     `gorm:"size:255;not null" json:"-"`
	Approver1StaffID      *uint      `json:"approver_1_staff_id,omitempty"`
	Approver1Nonce        *string    `gorm:"size:64" json:"-"`
	Approver1Signature    *string    `gorm:"size:255" json:"-"`
	Approver1At           *time.Time `json:"approver_1_at,omitempty"`
	Approver2StaffID      *uint      `json:"approver_2_staff_id,omitempty"`
	Approver2Nonce        *string    `gorm:"size:64" json:"-"`
	Approver2Signature    *string    `gorm:"size:255" json:"-"`
	Approver2At           *time.Time `json:"approver_2_at,omitempty"`
	ExecutionMethod       *string    `gorm:"size:50" json:"execution_method,omitempty"`
	BreakGlassNonce       *string    `gorm:"size:64" json:"-"`
	BreakGlassActor       *string    `gorm:"size:100" json:"-"`
	ExecutedAt            *time.Time `json:"executed_at,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
	User                  *User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	VerifiedByStaff       *User      `gorm:"foreignKey:VerifiedByStaffID;constraint:OnDelete:SET NULL" json:"-"`
	Approver1             *User      `gorm:"foreignKey:Approver1StaffID;constraint:OnDelete:SET NULL" json:"-"`
	Approver2             *User      `gorm:"foreignKey:Approver2StaffID;constraint:OnDelete:SET NULL" json:"-"`
}

func (TwoFactorRecoveryTicket) TableName() string { return "two_factor_recovery_tickets" }

// MFAAuthCompletion records durable factor consumption while Redis settlement is pending.
// PayloadEnc must contain authenticated encryption; bearer/session plaintext is never stored.
type MFAAuthCompletion struct {
	ID               uint         `gorm:"primaryKey;autoIncrement" json:"id"`
	Purpose          string       `gorm:"size:50;not null;uniqueIndex:uq_mfa_bcc_purpose_jti" json:"purpose"`
	TokenJTI         string       `gorm:"size:64;not null;uniqueIndex:uq_mfa_bcc_purpose_jti" json:"token_jti"`
	UserID           uint         `gorm:"not null;index:idx_mfa_bcc_user" json:"user_id"`
	FactorType       string       `gorm:"size:20;not null;check:chk_mfa_auth_completion_factor,factor_type IN ('totp','backup_code')" json:"factor_type"`
	ConsumedHashRef  *string      `gorm:"size:64" json:"-"`
	SessionID        uint         `gorm:"not null" json:"session_id"`
	PayloadEnc       string       `gorm:"type:text;not null" json:"-"`
	Status           string       `gorm:"size:20;not null;default:pending_redis;check:chk_mfa_auth_completion_status,status IN ('pending_redis','redis_committed','manual_recovery')" json:"status"`
	RedisCommittedAt *time.Time   `json:"redis_committed_at,omitempty"`
	CreatedAt        time.Time    `gorm:"not null" json:"created_at"`
	UpdatedAt        time.Time    `gorm:"not null" json:"updated_at"`
	ExpiresAt        time.Time    `gorm:"not null;index:idx_mfa_bcc_expires_at" json:"expires_at"`
	User             *User        `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Session          *UserSession `gorm:"foreignKey:SessionID;constraint:OnDelete:RESTRICT" json:"-"`
}

func (MFAAuthCompletion) TableName() string { return "mfa_auth_completions" }

// MFAAccountLockout is the PostgreSQL-authoritative lockout state for MFA factors.
type MFAAccountLockout struct {
	UserID          uint       `gorm:"primaryKey;autoIncrement:false" json:"user_id"`
	FailedAttempts  int        `gorm:"not null;default:0;check:chk_mfa_lockout_attempts,failed_attempts >= 0" json:"failed_attempts"`
	WindowStartedAt time.Time  `gorm:"not null" json:"window_started_at"`
	LockedUntil     *time.Time `json:"locked_until,omitempty"`
	UpdatedAt       time.Time  `gorm:"not null" json:"updated_at"`
	User            *User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

func (MFAAccountLockout) TableName() string { return "mfa_account_lockouts" }

// MFAChallengeFailure is the idempotency ledger for factor-failure accounting.
type MFAChallengeFailure struct {
	TokenJTI        string    `gorm:"size:64;primaryKey" json:"token_jti"`
	LeaseGeneration int64     `gorm:"primaryKey;check:chk_mfa_challenge_failure_lease,lease_generation > 0" json:"lease_generation"`
	UserID          uint      `gorm:"not null;index:idx_mfa_challenge_failures_user_created,priority:1" json:"user_id"`
	CreatedAt       time.Time `gorm:"not null;index:idx_mfa_challenge_failures_created_at" json:"created_at"`
	User            *User     `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

func (MFAChallengeFailure) TableName() string { return "mfa_challenge_failures" }
