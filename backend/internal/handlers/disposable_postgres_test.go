//go:build automationqa

package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"catavor-backend/internal/database"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Start a new cluster. This suite never accepts a DSN or reads application .env files.
func automationTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	root := t.TempDir()
	t.Setenv("PGOPTIONS", "")
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		t.Fatal(err)
	}
	password := hex.EncodeToString(raw)
	file := filepath.Join(root, "auth")
	if err := os.WriteFile(file, []byte(password+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	data := filepath.Join(root, "cluster")
	run := func(name string, args ...string) {
		t.Helper()
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		cmd := exec.CommandContext(ctx, name, args...)
		// postgres inherits pg_ctl handles on Windows. A pipe here stays open
		// for the lifetime of the daemon, including after pg_ctl exits.
		report := filepath.Join(root, name+".log")
		out, err := os.Create(report)
		if err != nil {
			t.Fatal(err)
		}
		cmd.Stdout, cmd.Stderr = out, out
		err = cmd.Run()
		out.Close()
		if err != nil {
			output, _ := os.ReadFile(report)
			t.Fatalf("%s: %v\n%s", name, err, output)
		}
	}
	run("initdb", "-D", data, "-U", "qa", "-A", "scram-sha-256", "--pwfile", file, "--no-locale", "-E", "UTF8")
	socket, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := socket.Addr().(*net.TCPAddr).Port
	socket.Close()
	run("pg_ctl", "-D", data, "-l", filepath.Join(root, "postgres.log"), "-o", fmt.Sprintf("-h 127.0.0.1 -p %d", port), "-w", "start")
	t.Cleanup(func() { run("pg_ctl", "-D", data, "-m", "fast", "-w", "stop") })
	db, err := gorm.Open(postgres.Open(fmt.Sprintf("host=127.0.0.1 port=%d user=qa password=%s dbname=postgres sslmode=disable", port, password)), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	conn, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	if err := database.BootstrapProductionSchema(db); err != nil {
		t.Fatal(err)
	}
	return db
}
