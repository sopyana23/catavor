package services

import (
	"fmt"
	"net/smtp"
	"os"
	"strings"

	"github.com/rs/zerolog/log"
)

type MailConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	From     string
	FromName string
}

// GetMailConfig extracts SMTP / Mail configuration supporting both standard Go SMTP_*
// and framework-compatible MAIL_* environment variables.
func GetMailConfig() MailConfig {
	host := os.Getenv("SMTP_HOST")
	if host == "" {
		host = os.Getenv("MAIL_HOST")
	}
	port := os.Getenv("SMTP_PORT")
	if port == "" {
		port = os.Getenv("MAIL_PORT")
	}
	user := os.Getenv("SMTP_USER")
	if user == "" {
		user = os.Getenv("MAIL_USERNAME")
	}
	pass := os.Getenv("SMTP_PASSWORD")
	if pass == "" {
		pass = os.Getenv("MAIL_PASSWORD")
	}
	pass = strings.Trim(pass, `"'`)

	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = os.Getenv("MAIL_FROM_ADDRESS")
	}
	if from == "" {
		from = user
	}

	fromName := os.Getenv("SMTP_FROM_NAME")
	if fromName == "" {
		fromName = os.Getenv("MAIL_FROM_NAME")
	}
	fromName = strings.Trim(fromName, `"'`)
	if fromName == "" {
		fromName = "Catavor"
	}

	return MailConfig{
		Host:     strings.TrimSpace(host),
		Port:     strings.TrimSpace(port),
		User:     strings.TrimSpace(user),
		Password: strings.TrimSpace(pass),
		From:     strings.TrimSpace(from),
		FromName: strings.TrimSpace(fromName),
	}
}

// SendHTMLEmail sends an HTML email via SMTP if configured, or gracefully logs if unconfigured.
func SendHTMLEmail(toEmail, subject, fromName, htmlBody string) error {
	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" {
		return nil
	}

	cfg := GetMailConfig()
	if cfg.Host == "" || cfg.Port == "" {
		log.Info().Str("to", toEmail).Str("subject", subject).Msg("SMTP not configured; email simulation logged")
		return nil
	}

	if fromName == "" {
		fromName = cfg.FromName
	}

	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	var auth smtp.Auth
	if cfg.User != "" && cfg.Password != "" {
		auth = smtp.PlainAuth("", cfg.User, cfg.Password, cfg.Host)
	}

	headerFrom := fmt.Sprintf("%s <%s>", fromName, cfg.From)
	msg := []byte(fmt.Sprintf("From: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n\r\n"+
		"%s", headerFrom, toEmail, subject, htmlBody))

	err := smtp.SendMail(addr, auth, cfg.From, []string{toEmail}, msg)
	if err != nil {
		log.Warn().Err(err).Str("to", toEmail).Str("subject", subject).Msg("Failed to dispatch email via SMTP")
		return err
	}

	log.Info().Str("to", toEmail).Str("subject", subject).Msg("Email successfully delivered via SMTP")
	return nil
}
