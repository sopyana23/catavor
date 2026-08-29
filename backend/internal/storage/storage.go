package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"catavor-backend/internal/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/rs/zerolog/log"
)

// StorageService defines the standard enterprise-grade contract for object/file storage.
type StorageService interface {
	Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (string, error)
	Delete(ctx context.Context, key string) error
	GetURL(key string) string
	GetDriverName() string
}

// LocalStorageService implements StorageService using local filesystem with S3-mirroring key structure.
type LocalStorageService struct {
	localRoot     string
	publicBaseURL string
}

func NewLocalStorageService(cfg *config.Config) *LocalStorageService {
	_ = os.MkdirAll(cfg.StorageLocalRoot, 0755)
	return &LocalStorageService{
		localRoot:     cfg.StorageLocalRoot,
		publicBaseURL: strings.TrimRight(cfg.StoragePublicURL, "/"),
	}
}

func (s *LocalStorageService) Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (string, error) {
	cleanKey := strings.TrimLeft(filepath.ToSlash(key), "/")
	targetPath := filepath.Join(s.localRoot, filepath.FromSlash(cleanKey))

	// Ensure subdirectories exist
	if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
		return "", fmt.Errorf("failed to create directory structure: %w", err)
	}

	out, err := os.Create(targetPath)
	if err != nil {
		return "", fmt.Errorf("failed to create destination file: %w", err)
	}
	defer out.Close()

	if _, err := io.Copy(out, r); err != nil {
		return "", fmt.Errorf("failed to write file content: %w", err)
	}

	return s.GetURL(cleanKey), nil
}

func (s *LocalStorageService) Delete(ctx context.Context, key string) error {
	cleanKey := strings.TrimLeft(filepath.ToSlash(key), "/")
	targetPath := filepath.Join(s.localRoot, filepath.FromSlash(cleanKey))
	if err := os.Remove(targetPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete local file: %w", err)
	}
	return nil
}

func (s *LocalStorageService) GetURL(key string) string {
	cleanKey := strings.TrimLeft(filepath.ToSlash(key), "/")
	return fmt.Sprintf("%s/%s", s.publicBaseURL, cleanKey)
}

func (s *LocalStorageService) GetDriverName() string {
	return "local"
}

// S3StorageService implements StorageService for AWS S3, MinIO, Cloudflare R2, and S3-compatible providers.
type S3StorageService struct {
	client        *minio.Client
	bucket        string
	publicBaseURL string
}

func NewS3StorageService(cfg *config.Config) (*S3StorageService, error) {
	endpoint := cfg.S3Endpoint
	// Extract host:port from endpoint if full URL provided
	if strings.HasPrefix(endpoint, "http://") || strings.HasPrefix(endpoint, "https://") {
		u, err := url.Parse(endpoint)
		if err == nil {
			endpoint = u.Host
		}
	}

	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.S3AccessKeyID, cfg.S3SecretAccessKey, ""),
		Secure: cfg.S3SSL,
		Region: cfg.S3Region,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to initialize S3 client: %w", err)
	}

	// Verify bucket existence or create if accessible
	ctx := context.Background()
	exists, err := client.BucketExists(ctx, cfg.S3Bucket)
	if err != nil {
		log.Warn().Err(err).Str("bucket", cfg.S3Bucket).Msg("S3 Bucket verification warning (proceeding)")
	} else if !exists {
		log.Info().Str("bucket", cfg.S3Bucket).Msg("S3 Bucket not found, attempting to create...")
		err = client.MakeBucket(ctx, cfg.S3Bucket, minio.MakeBucketOptions{Region: cfg.S3Region})
		if err != nil {
			log.Warn().Err(err).Str("bucket", cfg.S3Bucket).Msg("Failed to auto-create S3 bucket; ensure it exists on cloud provider")
		} else {
			log.Info().Str("bucket", cfg.S3Bucket).Msg("S3 Bucket created successfully")
		}
	}

	publicBaseURL := strings.TrimRight(cfg.StoragePublicURL, "/")
	if publicBaseURL == "" || strings.Contains(publicBaseURL, "localhost") {
		// Fallback to direct S3 public URL format
		scheme := "http"
		if cfg.S3SSL {
			scheme = "https"
		}
		if cfg.S3UsePathStyle {
			publicBaseURL = fmt.Sprintf("%s://%s/%s", scheme, endpoint, cfg.S3Bucket)
		} else {
			publicBaseURL = fmt.Sprintf("%s://%s.%s", scheme, cfg.S3Bucket, endpoint)
		}
	}

	return &S3StorageService{
		client:        client,
		bucket:        cfg.S3Bucket,
		publicBaseURL: publicBaseURL,
	}, nil
}

func (s *S3StorageService) Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (string, error) {
	cleanKey := strings.TrimLeft(filepath.ToSlash(key), "/")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	_, err := s.client.PutObject(ctx, s.bucket, cleanKey, r, size, minio.PutObjectOptions{
		ContentType: contentType,
		UserMetadata: map[string]string{
			"x-amz-meta-uploaded-by": "catavor-core",
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload object to S3: %w", err)
	}

	return s.GetURL(cleanKey), nil
}

func (s *S3StorageService) Delete(ctx context.Context, key string) error {
	cleanKey := strings.TrimLeft(filepath.ToSlash(key), "/")
	err := s.client.RemoveObject(ctx, s.bucket, cleanKey, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete S3 object: %w", err)
	}
	return nil
}

func (s *S3StorageService) GetURL(key string) string {
	cleanKey := strings.TrimLeft(filepath.ToSlash(key), "/")
	return fmt.Sprintf("%s/%s", s.publicBaseURL, cleanKey)
}

func (s *S3StorageService) GetDriverName() string {
	return "s3"
}

// NewStorageService is the factory function that creates the appropriate storage driver based on configuration.
func NewStorageService(cfg *config.Config) (StorageService, error) {
	switch strings.ToLower(cfg.StorageDriver) {
	case "s3", "minio", "r2":
		log.Info().Str("driver", "s3").Str("bucket", cfg.S3Bucket).Str("endpoint", cfg.S3Endpoint).Msg("Initializing S3 / Cloud Object Storage driver")
		return NewS3StorageService(cfg)
	default:
		log.Info().Str("driver", "local").Str("root", cfg.StorageLocalRoot).Str("public_url", cfg.StoragePublicURL).Msg("Initializing Local Disk Storage driver")
		return NewLocalStorageService(cfg), nil
	}
}
