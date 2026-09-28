package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"catavor-backend/internal/models"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type EmailQueueService struct {
	db *gorm.DB
}

var (
	globalEmailQueue   *EmailQueueService
	emailQueueOnce     sync.Once
	queueTriggerChan   = make(chan struct{}, 100)
	workerShutdownChan = make(chan struct{})
)

// InitEmailQueue initializes the singleton EmailQueueService and starts the worker daemon.
func InitEmailQueue(db *gorm.DB) *EmailQueueService {
	emailQueueOnce.Do(func() {
		globalEmailQueue = &EmailQueueService{db: db}
		go globalEmailQueue.runWorker()
		log.Info().Msg("Transactional Email Queue & Retry Worker initialized successfully")
	})
	return globalEmailQueue
}

// GetEmailQueue returns the singleton EmailQueueService instance.
func GetEmailQueue() *EmailQueueService {
	return globalEmailQueue
}

// EnqueueEmail persists an email job to the PostgreSQL database and immediately signals the worker.
func EnqueueEmail(recipientEmail, recipientName, fromName, subject, bodyHTML, category, referenceID string) (*models.EmailJob, error) {
	if globalEmailQueue == nil || globalEmailQueue.db == nil {
		log.Warn().Str("to", recipientEmail).Str("subject", subject).Msg("Email queue service is not initialized, falling back to direct send")
		_ = SendHTMLEmail(recipientEmail, subject, fromName, bodyHTML)
		return nil, nil
	}

	now := time.Now().UTC()
	jobID := fmt.Sprintf("job_mail_%d_%s", now.UnixNano(), uuid.New().String()[:8])

	job := models.EmailJob{
		ID:             jobID,
		RecipientEmail: recipientEmail,
		RecipientName:  recipientName,
		FromName:       fromName,
		Subject:        subject,
		BodyHTML:       bodyHTML,
		Category:       category,
		ReferenceID:    referenceID,
		Status:         "pending",
		Attempts:       0,
		MaxAttempts:    5,
		NextRetryAt:    &now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := globalEmailQueue.db.Create(&job).Error; err != nil {
		log.Error().Err(err).Str("to", recipientEmail).Msg("Failed to enqueue email job to database")
		// Safe fallback: try direct sending if database insert fails
		_ = SendHTMLEmail(recipientEmail, subject, fromName, bodyHTML)
		return nil, err
	}

	log.Info().
		Str("job_id", job.ID).
		Str("to", recipientEmail).
		Str("category", category).
		Str("subject", subject).
		Msg("Email job successfully persisted to queue")

	// Trigger worker immediately for zero-delay delivery
	select {
	case queueTriggerChan <- struct{}{}:
	default:
	}

	return &job, nil
}

// runWorker is the daemon goroutine that continuously monitors and processes email jobs with backoff retry.
func (s *EmailQueueService) runWorker() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-workerShutdownChan:
			log.Info().Msg("Email queue worker received shutdown signal")
			return
		case <-ticker.C:
			s.processPendingJobs()
		case <-queueTriggerChan:
			s.processPendingJobs()
		}
	}
}

// processPendingJobs queries and dispatches pending or eligible retry email jobs.
func (s *EmailQueueService) processPendingJobs() {
	if s.db == nil {
		return
	}

	now := time.Now().UTC()
	var jobs []models.EmailJob

	// Fetch up to 10 jobs that are pending or failed-retryable whose retry time has arrived
	err := s.db.Where(
		"(status = 'pending' OR (status = 'failed' AND attempts < max_attempts)) AND (next_retry_at IS NULL OR next_retry_at <= ?)",
		now,
	).Order("created_at ASC").Limit(10).Find(&jobs).Error

	if err != nil || len(jobs) == 0 {
		return
	}

	for _, job := range jobs {
		s.dispatchJob(job)
	}
}

// dispatchJob attempts to deliver a single email job and updates its status/backoff accordingly.
func (s *EmailQueueService) dispatchJob(job models.EmailJob) {
	now := time.Now().UTC()

	// 1. Mark as processing
	s.db.Model(&models.EmailJob{}).Where("id = ?", job.ID).Updates(map[string]interface{}{
		"status":     "processing",
		"updated_at": now,
	})

	// 2. Execute SMTP delivery
	err := SendHTMLEmail(job.RecipientEmail, job.Subject, job.FromName, job.BodyHTML)

	if err == nil {
		// Delivery Successful
		s.db.Model(&models.EmailJob{}).Where("id = ?", job.ID).Updates(map[string]interface{}{
			"status":     "sent",
			"sent_at":    &now,
			"last_error": "",
			"updated_at": now,
		})
		log.Info().
			Str("job_id", job.ID).
			Str("to", job.RecipientEmail).
			Str("subject", job.Subject).
			Msg("Email job successfully delivered via queue")
	} else {
		// Delivery Failed: apply exponential backoff
		newAttempts := job.Attempts + 1
		backoffDuration := calculateBackoff(newAttempts)
		nextRetry := now.Add(backoffDuration)

		newStatus := "pending"
		if newAttempts >= job.MaxAttempts {
			newStatus = "failed"
		}

		s.db.Model(&models.EmailJob{}).Where("id = ?", job.ID).Updates(map[string]interface{}{
			"status":        newStatus,
			"attempts":      newAttempts,
			"last_error":    err.Error(),
			"next_retry_at": &nextRetry,
			"updated_at":    now,
		})

		log.Warn().
			Err(err).
			Str("job_id", job.ID).
			Int("attempt", newAttempts).
			Str("status", newStatus).
			Time("next_retry_at", nextRetry).
			Msg("Email job delivery failed, scheduled for retry")
	}
}

// calculateBackoff implements industry-standard exponential backoff:
// Attempt 1: 15s | Attempt 2: 1m | Attempt 3: 5m | Attempt 4: 15m | Attempt 5: 1h
func calculateBackoff(attempt int) time.Duration {
	switch attempt {
	case 1:
		return 15 * time.Second
	case 2:
		return 1 * time.Minute
	case 3:
		return 5 * time.Minute
	case 4:
		return 15 * time.Minute
	default:
		return 1 * time.Hour
	}
}

// ShutdownEmailWorker cleanly shuts down the email worker.
func ShutdownEmailWorker(ctx context.Context) {
	select {
	case workerShutdownChan <- struct{}{}:
	default:
	}
}
