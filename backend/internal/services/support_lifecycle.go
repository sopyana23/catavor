package services

import (
	"fmt"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/storage"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// RunSupportLifecycle applies the same transitions for the scheduler and the administrator.
func RunSupportLifecycle(db *gorm.DB, strg storage.StorageService, origin, actor string) (string, error) {
	start := time.Now().UTC()
	var reminders, resolved, closed, breaches int64
	err := db.Transaction(func(tx *gorm.DB) error {
		var tickets []models.SupportTicket
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
			Where("status = 'waiting_user' AND ((reminder_count = 0 AND last_message_at <= ?) OR (reminder_count >= 1 AND reminder_sent_at <= ?))", start.Add(-72*time.Hour), start.Add(-48*time.Hour)).
			Order("id").Find(&tickets).Error; err != nil {
			return err
		}
		for _, ticket := range tickets {
			var owner models.User
			if err := tx.First(&owner, ticket.UserID).Error; err != nil {
				return err
			}
			name := owner.Name
			if name == "" {
				name = "Bapak/Ibu Merchant"
			}
			var updates map[string]interface{}
			var message string
			if ticket.ReminderCount == 0 {
				updates = map[string]interface{}{"reminder_count": 1, "reminder_sent_at": start}
				message = fmt.Sprintf("Halo %s, apakah kendala pada tiket #%s masih Anda alami? Tiket akan ditandai selesai dalam 48 jam jika belum ada tanggapan.", name, ticket.TicketNumber)
				reminders++
			} else {
				updates = map[string]interface{}{"status": "resolved", "resolved_at": start}
				message = fmt.Sprintf("Halo %s, tiket #%s telah ditandai selesai setelah 48 jam tanpa tanggapan. Anda dapat membalasnya selama masa sanggah tujuh hari.", name, ticket.TicketNumber)
				resolved++
			}
			if err := tx.Model(&ticket).Updates(updates).Error; err != nil {
				return err
			}
			if err := tx.Create(&models.SupportMessage{TicketID: ticket.ID, SenderID: ticket.UserID, SenderType: "system", Message: message, CreatedAt: start}).Error; err != nil {
				return err
			}
		}
		update := tx.Model(&models.SupportTicket{}).Where("status = 'resolved' AND resolved_at <= ?", start.AddDate(0, 0, -7)).
			Updates(map[string]interface{}{"status": "closed", "closed_at": start})
		if update.Error != nil {
			return update.Error
		}
		closed = update.RowsAffected
		update = tx.Model(&models.SupportTicket{}).Where("status IN ? AND first_response_at IS NULL AND NOT sla_breached AND sla_due_at <= ?", []string{"open", "in_progress", "waiting_agent"}, start).Update("sla_breached", true)
		breaches = update.RowsAffected
		return update.Error
	})
	var stats TicketRetentionStats
	if err == nil {
		stats, err = PurgeExpiredClosedTickets(db, strg)
	} else {
		reminders, resolved, closed, breaches = 0, 0, 0, 0
	}
	summary := fmt.Sprintf("%d pengingat, %d tiket selesai, %d tiket ditutup, %d pelanggaran SLA, %d tiket melewati retensi.", reminders, resolved, closed, breaches, stats.PurgedTickets)
	total := reminders + resolved + closed + breaches + stats.PurgedTickets
	status, fault := "success", ""
	if err != nil {
		status, fault = "error", err.Error()
	}
	tracker := GetAutomationTracker()
	tracker.RecordWorkerHeartbeat("support_lifecycle", status, summary, fault, total, start.Add(15*time.Minute))
	tracker.RecordLog(AutomationLogEntry{BotName: "support_lifecycle", BotTitle: "Siklus helpdesk dan SLA", Target: "Tiket platform", Action: "executed_cycle", TriggerType: origin, TriggeredBy: actor, Status: status, Details: summary, ErrorMessage: fault, AffectedCount: total, DurationMs: time.Since(start).Milliseconds()})
	return summary, err
}
