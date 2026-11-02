package storage

import (
	"bytes"
	"io"
	"testing"
)

// TestReadSeeker_RewindSafety memastikan stream bertipe io.ReadSeeker dapat dibaca berulang kali
// tanpa kehilangan data, yang menjadi prasyarat retry otomatis pada Cloudflare R2 / S3.
func TestReadSeeker_RewindSafety(t *testing.T) {
	content := []byte("DATA_TEST_BUFFER_UNTUK_RETRY")
	reader := bytes.NewReader(content)

	// Baca pertama kali
	b1, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read 1 failed: %v", err)
	}
	if string(b1) != string(content) {
		t.Errorf("read 1 content mismatch: got %q, want %q", string(b1), string(content))
	}

	// Cek bahwa reader sudah di ujung
	if reader.Len() != 0 {
		t.Errorf("reader len should be 0, got %d", reader.Len())
	}

	// Rewind ke awal seperti yang dilakukan S3StorageService.Upload
	_, err = reader.Seek(0, io.SeekStart)
	if err != nil {
		t.Fatalf("seek failed: %v", err)
	}

	// Baca kedua kali (simulasi attempt retry kedua)
	b2, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read 2 failed: %v", err)
	}
	if string(b2) != string(content) {
		t.Errorf("read 2 content mismatch: got %q, want %q", string(b2), string(content))
	}
}

