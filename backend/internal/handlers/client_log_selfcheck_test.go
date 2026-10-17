package handlers

import (
	"bytes"
	"strings"
	"testing"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// Self-check: pastikan field message+stack+tags benar-benar tercetak.
// ponytail: satu test ini cukup; menambah kasus saat ada field baru.
func TestClientLogFieldsEmitted(t *testing.T) {
	var buf bytes.Buffer
	prev := log.Logger
	log.Logger = zerolog.New(&buf)
	defer func() { log.Logger = prev }()

	ev := log.Warn().
		Str("section", strings.Repeat("S", 301)).
		Str("err_message", strings.Repeat("M", 2000)).
		Str("ip", "1.2.3.4")
	ev = ev.Strs("tags", []string{"a", "b"})
	ev = ev.Str("stack", "TypeError: boom")
	ev.Msg("Client runtime error")

	out := buf.String()
	for _, want := range []string{`"err_message"`, `"stack"`, `"tags"`, `"section"`} {
		if !strings.Contains(out, want) {
			t.Fatalf("field %q hilang dari output: %s", want, out)
		}
	}
	// key "message" hanya boleh muncul sekali (milik Msg()).
	if n := strings.Count(out, `"message"`); n != 1 {
		t.Fatalf("key message duplikat (%d kemunculan): %s", n, out)
	}
}
