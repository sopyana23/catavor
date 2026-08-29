package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"catavor-backend/internal/config"
	"catavor-backend/internal/storage"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	fmt.Println("=================================================================")
	fmt.Println("  Catavor Cloud Object Storage Migration Tool (Local -> S3/MinIO)")
	fmt.Println("=================================================================")

	cfg := config.LoadConfig()

	if cfg.S3AccessKeyID == "" || cfg.S3SecretAccessKey == "" {
		log.Error().Msg("S3 credentials not found in environment (.env). Please set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY before migrating.")
		os.Exit(1)
	}

	log.Info().
		Str("local_root", cfg.StorageLocalRoot).
		Str("s3_endpoint", cfg.S3Endpoint).
		Str("s3_bucket", cfg.S3Bucket).
		Str("s3_region", cfg.S3Region).
		Msg("Connecting to Cloud S3 Object Storage...")

	s3Driver, err := storage.NewS3StorageService(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize S3 storage driver")
	}

	localRoot := cfg.StorageLocalRoot
	if _, err := os.Stat(localRoot); os.IsNotExist(err) {
		log.Fatal().Str("path", localRoot).Msg("Local storage root directory does not exist")
	}

	var filesToMigrate []string
	err = filepath.Walk(localRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			filesToMigrate = append(filesToMigrate, path)
		}
		return nil
	})

	if err != nil {
		log.Fatal().Err(err).Msg("Failed to scan local storage directory")
	}

	total := len(filesToMigrate)
	log.Info().Int("total_files", total).Msg("Found files to migrate to S3/MinIO")

	if total == 0 {
		log.Info().Msg("No files to migrate. Storage directory is empty.")
		return
	}

	ctx := context.Background()
	successCount := 0
	failCount := 0

	startTime := time.Now()

	for idx, filePath := range filesToMigrate {
		relPath, err := filepath.Rel(localRoot, filePath)
		if err != nil {
			log.Warn().Err(err).Str("file", filePath).Msg("Failed to determine relative key")
			failCount++
			continue
		}

		objectKey := strings.TrimLeft(filepath.ToSlash(relPath), "/")

		file, err := os.Open(filePath)
		if err != nil {
			log.Warn().Err(err).Str("key", objectKey).Msg("Failed to open local file")
			failCount++
			continue
		}

		stat, err := file.Stat()
		if err != nil {
			file.Close()
			log.Warn().Err(err).Str("key", objectKey).Msg("Failed to stat local file")
			failCount++
			continue
		}

		// Detect content type
		header := make([]byte, 512)
		n, _ := file.Read(header)
		contentType := http.DetectContentType(header[:n])
		_, _ = file.Seek(0, 0) // Rewind

		log.Info().
			Int("progress", idx+1).
			Int("total", total).
			Str("key", objectKey).
			Int64("bytes", stat.Size()).
			Str("mime", contentType).
			Msg("Uploading object to S3...")

		_, err = s3Driver.Upload(ctx, objectKey, file, stat.Size(), contentType)
		file.Close()

		if err != nil {
			log.Error().Err(err).Str("key", objectKey).Msg("Failed to upload object to S3")
			failCount++
		} else {
			successCount++
		}
	}

	duration := time.Since(startTime)
	fmt.Println("=================================================================")
	log.Info().
		Int("successful", successCount).
		Int("failed", failCount).
		Str("duration", duration.String()).
		Msg("Migration completed!")
	fmt.Println("=================================================================")
}
