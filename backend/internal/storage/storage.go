package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"catavor-backend/internal/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/rs/zerolog/log"
)

// StorageService defines the standard enterprise-grade contract for object/file storage.
type StorageService interface {
	Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (string, error)
	Delete(ctx context.Context, key string) error
	DeletePrefix(ctx context.Context, prefix string) error
	GetURL(key string) string
	GetDriverName() string
	Get(ctx context.Context, key string) (io.ReadCloser, string, int64, error)
	GetPresignedURL(ctx context.Context, key string, expiry time.Duration) (string, error)
}

// PrivateKeyPrefix menandai object yang tidak boleh disajikan sebagai aset
// publik (bukti pembayaran, lampiran tiket bantuan).
//
// SECURITY (ST-01): sebelumnya seluruh isi storage root dilayani satu route
// statis tanpa autentikasi, sehingga berkas privat dapat diunduh siapa pun
// yang mengetahui URL-nya. Sekarang key privat selalu berawalan "private/"
// dan dipetakan ke root terpisah yang tidak pernah dilayani route statis.
//
// Pola yang sama tetap benar saat pindah ke S3: prefix "private/" berada di
// bucket yang sama, tetapi bucket policy hanya mengizinkan pembacaan anonim
// pada prefix di luar "private/".
const PrivateKeyPrefix = "private/"

// IsPrivateKey melaporkan apakah key termasuk namespace privat.
func IsPrivateKey(key string) bool {
	clean := strings.TrimLeft(filepath.ToSlash(strings.TrimSpace(key)), "/")
	return strings.HasPrefix(clean, PrivateKeyPrefix)
}

// LocalStorageService implements StorageService using local filesystem with S3-mirroring key structure.
type LocalStorageService struct {
	localRoot     string
	privateRoot   string
	publicBaseURL string
}

func NewLocalStorageService(cfg *config.Config) *LocalStorageService {
	_ = os.MkdirAll(cfg.StorageLocalRoot, 0755)
	// Root privat memakai 0700: hanya proses aplikasi yang boleh membacanya.
	_ = os.MkdirAll(cfg.StoragePrivateRoot, 0700)
	return &LocalStorageService{
		localRoot:     cfg.StorageLocalRoot,
		privateRoot:   cfg.StoragePrivateRoot,
		publicBaseURL: strings.TrimRight(cfg.StoragePublicURL, "/"),
	}
}

// targetFor memetakan key ke (root disk, key relatif terhadap root, privat).
// Key privat membuang prefix "private/" saat dipetakan ke disk agar struktur
// direktori privat identik dengan struktur key publik.
func (s *LocalStorageService) targetFor(key string) (string, string, bool) {
	cleanKey := strings.TrimLeft(filepath.ToSlash(strings.TrimSpace(key)), "/")
	if IsPrivateKey(cleanKey) {
		return s.privateRoot, strings.TrimPrefix(cleanKey, PrivateKeyPrefix), true
	}
	return s.localRoot, cleanKey, false
}

func (s *LocalStorageService) Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (string, error) {
	root, relKey, _ := s.targetFor(key)
	cleanKey := strings.TrimLeft(filepath.ToSlash(strings.TrimSpace(relKey)), "/")
	if cleanKey == "" || root == "" {
		return "", fmt.Errorf("refusing to upload with empty storage key: %q", key)
	}
	// Tolak path absolut, skema drive, dan traversal sebelum menyentuh disk.
	if filepath.IsAbs(cleanKey) || strings.Contains(cleanKey, ":") ||
		cleanKey == ".." || strings.HasPrefix(cleanKey, "../") || strings.Contains(cleanKey, "/../") {
		return "", fmt.Errorf("invalid storage key: %q", key)
	}

	targetPath := filepath.Join(root, filepath.FromSlash(cleanKey))

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

	// GetURL memakai key asli agar deteksi namespace privat tetap benar.
	return s.GetURL(key), nil
}

// resolveSafeKey menormalkan key klien dan memastikan hasilnya tetap di dalam
// root yang sesuai (publik atau privat). Mengembalikan (path absolut, true)
// bila aman.
//
// SECURITY (N-40): sebelumnya Delete/DeletePrefix memakai filepath.Join tanpa
// pemeriksaan, sehingga key seperti "../../x" menghapus file di luar root.
// Pemanggil saat ini (storage_handler.go) sudah memvalidasi lewat
// ResolveInsidePrefix, tetapi lapisan storage tidak boleh bergantung pada
// kesopanan pemanggil — satu jalur baru yang lupa memvalidasi cukup untuk
// menghapus data di luar storage.
func (s *LocalStorageService) resolveSafeKey(key string) (string, bool) {
	root, relKey, _ := s.targetFor(key)
	cleanKey := strings.TrimLeft(filepath.ToSlash(strings.TrimSpace(relKey)), "/")
	if cleanKey == "" || root == "" {
		return "", false
	}
	// Tolak path absolut dan skema drive (C:\...) sebelum digabung.
	if filepath.IsAbs(cleanKey) || strings.Contains(cleanKey, ":") {
		return "", false
	}

	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", false
	}
	candidate := filepath.Join(absRoot, filepath.FromSlash(cleanKey))

	// EvalSymlinks bila ada, agar symlink keluar root ikut tertangkap.
	resolved := candidate
	if rp, err := filepath.EvalSymlinks(candidate); err == nil {
		resolved = rp
	}

	rel, err := filepath.Rel(absRoot, resolved)
	if err != nil {
		return "", false
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) || filepath.IsAbs(rel) {
		return "", false
	}
	return resolved, true
}

func (s *LocalStorageService) Delete(ctx context.Context, key string) error {
	targetPath, ok := s.resolveSafeKey(key)
	if !ok {
		return fmt.Errorf("refusing to delete outside storage root: %q", key)
	}
	if err := os.Remove(targetPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete local file: %w", err)
	}
	return nil
}

func (s *LocalStorageService) DeletePrefix(ctx context.Context, prefix string) error {
	targetDir, ok := s.resolveSafeKey(prefix)
	if !ok {
		return fmt.Errorf("refusing to delete prefix outside storage root: %q", prefix)
	}
	// Jangan pernah RemoveAll pada root storage itu sendiri.
	root, _, _ := s.targetFor(prefix)
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return fmt.Errorf("invalid storage root: %w", err)
	}
	if filepath.Clean(targetDir) == filepath.Clean(absRoot) {
		return fmt.Errorf("refusing to delete storage root itself")
	}
	if err := os.RemoveAll(targetDir); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete local prefix directory: %w", err)
	}
	return nil
}

func (s *LocalStorageService) GetURL(key string) string {
	cleanKey := strings.TrimLeft(filepath.ToSlash(key), "/")
	// Object privat tidak punya URL publik. Konsumen wajib menyajikannya
	// lewat endpoint ber-otorisasi (mis. GET /api/support/attachments/:id).
	if IsPrivateKey(cleanKey) {
		return ""
	}
	return fmt.Sprintf("%s/%s", s.publicBaseURL, cleanKey)
}

func (s *LocalStorageService) GetDriverName() string {
	return "local"
}

func (s *LocalStorageService) Get(ctx context.Context, key string) (io.ReadCloser, string, int64, error) {
	targetPath, ok := s.resolveSafeKey(key)
	if !ok {
		return nil, "", 0, fmt.Errorf("refusing to access file outside storage root: %q", key)
	}
	info, err := os.Stat(targetPath)
	if err != nil {
		return nil, "", 0, err
	}
	if info.IsDir() {
		return nil, "", 0, fmt.Errorf("path is a directory")
	}

	f, err := os.Open(targetPath)
	if err != nil {
		return nil, "", 0, err
	}

	ext := strings.ToLower(filepath.Ext(targetPath))
	contentType := mimeByExtension(ext)

	return f, contentType, info.Size(), nil
}

func (s *LocalStorageService) GetPresignedURL(ctx context.Context, key string, expiry time.Duration) (string, error) {
	url := s.GetURL(key)
	if url == "" {
		return "", fmt.Errorf("cannot generate presigned url for private local object")
	}
	return url, nil
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

	// ST-07: S3_USE_PATH_STYLE harus sampai ke SDK, bukan hanya dipakai saat
	// menyusun URL publik. Tanpa BucketLookup eksplisit, minio-go memakai
	// resolusi DNS virtual-host (bucket.endpoint) yang GAGAL pada MinIO,
	// Cloudflare R2, dan sebagian besar S3-compatible on-prem.
	lookup := minio.BucketLookupAuto
	if cfg.S3UsePathStyle {
		lookup = minio.BucketLookupPath
	}

	client, err := minio.New(endpoint, &minio.Options{
		Creds:        credentials.NewStaticV4(cfg.S3AccessKeyID, cfg.S3SecretAccessKey, ""),
		Secure:       cfg.S3SSL,
		Region:       cfg.S3Region,
		BucketLookup: lookup,
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
	if publicBaseURL == "" {
		// Fallback to direct S3 public URL format if no explicit public URL configured
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

func (s *S3StorageService) DeletePrefix(ctx context.Context, prefix string) error {
	cleanPrefix := strings.TrimLeft(filepath.ToSlash(prefix), "/")
	if cleanPrefix == "" {
		return fmt.Errorf("refusing to delete empty prefix from S3 bucket")
	}

	opts := minio.ListObjectsOptions{
		Prefix:    cleanPrefix,
		Recursive: true,
	}

	objectsCh := make(chan minio.ObjectInfo)
	go func() {
		defer close(objectsCh)
		for obj := range s.client.ListObjects(ctx, s.bucket, opts) {
			if obj.Err != nil {
				log.Warn().Err(obj.Err).Str("prefix", cleanPrefix).Msg("Error listing objects for prefix deletion")
				continue
			}
			objectsCh <- obj
		}
	}()

	errorCh := s.client.RemoveObjects(ctx, s.bucket, objectsCh, minio.RemoveObjectsOptions{})
	for err := range errorCh {
		if err.Err != nil {
			log.Warn().Err(err.Err).Str("object", err.ObjectName).Msg("Failed to delete S3 object in prefix batch")
		}
	}

	return nil
}

func (s *S3StorageService) GetURL(key string) string {
	cleanKey := strings.TrimLeft(filepath.ToSlash(key), "/")
	// Object privat tidak punya URL publik (lihat PrivateKeyPrefix). Bucket
	// policy S3 wajib menolak pembacaan anonim pada prefix "private/".
	if IsPrivateKey(cleanKey) {
		return ""
	}
	return fmt.Sprintf("%s/%s", s.publicBaseURL, cleanKey)
}

func (s *S3StorageService) GetDriverName() string {
	return "s3"
}

func (s *S3StorageService) Get(ctx context.Context, key string) (io.ReadCloser, string, int64, error) {
	cleanKey := strings.TrimLeft(filepath.ToSlash(key), "/")
	if cleanKey == "" {
		return nil, "", 0, fmt.Errorf("empty storage key")
	}

	obj, err := s.client.GetObject(ctx, s.bucket, cleanKey, minio.GetObjectOptions{})
	if err != nil {
		return nil, "", 0, fmt.Errorf("failed to get s3 object: %w", err)
	}

	info, err := obj.Stat()
	if err != nil {
		_ = obj.Close()
		return nil, "", 0, fmt.Errorf("failed to stat s3 object: %w", err)
	}

	contentType := info.ContentType
	if contentType == "" || contentType == "application/octet-stream" {
		ext := strings.ToLower(filepath.Ext(cleanKey))
		contentType = mimeByExtension(ext)
	}

	return obj, contentType, info.Size, nil
}

func (s *S3StorageService) GetPresignedURL(ctx context.Context, key string, expiry time.Duration) (string, error) {
	cleanKey := strings.TrimLeft(filepath.ToSlash(key), "/")
	if cleanKey == "" {
		return "", fmt.Errorf("empty storage key")
	}
	presignedURL, err := s.client.PresignedGetObject(ctx, s.bucket, cleanKey, expiry, nil)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}
	return presignedURL.String(), nil
}

func mimeByExtension(ext string) string {
	switch strings.ToLower(ext) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	case ".svg":
		return "image/svg+xml"
	case ".pdf":
		return "application/pdf"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".json":
		return "application/json"
	case ".csv":
		return "text/csv"
	case ".txt":
		return "text/plain"
	default:
		return "application/octet-stream"
	}
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
