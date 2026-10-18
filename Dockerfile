# syntax=docker/dockerfile:1

# =============================================================================
# Catavor — image produksi multi-stage
#
# Tahap 1-2 membangun frontend (desktop & mobile) dengan Node sesuai .nvmrc.
# Tahap 3 mengompilasi backend Go sebagai binary statis.
# Tahap 4 hanya memuat binary + aset statis + CA certificate, berjalan sebagai
# user non-root, tanpa shell dan tanpa package manager.
#
# Build:
#   docker build -t catavor:<tag> .
#
# Runtime wajib menyediakan: JWT_SECRET, DB_* (lihat .env.example).
# Migrasi TIDAK dijalankan otomatis — DB_AUTO_MIGRATE=false di produksi.
# =============================================================================

# -----------------------------------------------------------------------------
# Tahap 1: dependensi frontend
# Dipisah agar cache layer npm tidak invalid saat source berubah.
# -----------------------------------------------------------------------------
FROM node:22.13.0-bookworm-slim AS node-base

WORKDIR /app

# Manifest saja dulu supaya cache npm install stabil.
# Root repo tidak punya package.json — hanya .nvmrc sebagai penanda versi.
COPY .nvmrc ./
COPY frontend/desktop/package.json frontend/desktop/package-lock.json ./frontend/desktop/
COPY frontend/mobile/package.json frontend/mobile/package-lock.json ./frontend/mobile/

# `npm ci` memakai lockfile apa adanya → build deterministik.
# --no-audit/--no-fund hanya memangkas waktu, tidak mengubah isi.
RUN cd frontend/desktop && npm ci --no-audit --no-fund \
 && cd ../mobile && npm ci --no-audit --no-fund

# -----------------------------------------------------------------------------
# Tahap 2: build frontend
# Output masuk ke frontend/<spa>/public/ sesuai konfigurasi Vite.
# -----------------------------------------------------------------------------
FROM node-base AS frontend-build

COPY frontend/desktop/ ./frontend/desktop/
COPY frontend/mobile/ ./frontend/mobile/

RUN cd frontend/desktop && npm run build \
 && cd ../mobile && npm run build

# -----------------------------------------------------------------------------
# Tahap 3: build backend
# CGO_ENABLED=0 → binary statis, bisa jalan di image minimal tanpa libc.
# -trimpath menghapus path build lokal dari binary (reproducible + tidak
# membocorkan struktur direktori mesin build).
# -----------------------------------------------------------------------------
FROM golang:1.26-bookworm AS backend-build

WORKDIR /src

# Modul dulu, supaya cache `go mod download` tidak invalid saat source berubah.
COPY backend/go.mod backend/go.sum ./
RUN go mod download && go mod verify

COPY backend/ ./

RUN CGO_ENABLED=0 GOOS=linux go build \
      -trimpath \
      -ldflags="-s -w" \
      -o /out/catavor-server \
      ./cmd/server

# Direktori storage dibuat di sini karena image distroless tidak punya shell
# untuk `mkdir` saat runtime.
RUN mkdir -p /tmp/storage

# -----------------------------------------------------------------------------
# Tahap 4: runtime
# distroless/static sudah membawa CA certificate (dibutuhkan untuk HTTPS
# keluar: Google OAuth, Sentry, S3) dan /etc/passwd dengan user nonroot.
# -----------------------------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot AS runtime

WORKDIR /app

# Binary hasil build.
COPY --from=backend-build /out/catavor-server /app/catavor-server

# Aset statis. Struktur dipertahankan karena config men-resolve path relatif
# terhadap CWD: public/desktop, public/mobile.
COPY --from=frontend-build /app/frontend/desktop/public /app/public/desktop
COPY --from=frontend-build /app/frontend/mobile/public /app/public/mobile

# Direktori unggahan. Di produksi sebaiknya di-mount volume atau pakai S3
# (STORAGE_DRIVER=s3); direktori container ini hilang saat container diganti.
# Distroless tidak punya shell dan tidak bisa membuat direktori, jadi dibuat
# di tahap build lalu disalin dengan kepemilikan user nonroot (uid 65532).
COPY --from=backend-build --chown=65532:65532 /tmp/storage /data/storage

USER nonroot:nonroot

ENV PORT=8000 \
    APP_ENV=production \
    DB_SSLMODE=require \
    STORAGE_DRIVER=local \
    STORAGE_LOCAL_ROOT=/data/storage

# Storage sebagai volume agar unggahan bertahan antar container.
VOLUME ["/data/storage"]

EXPOSE 8000

# distroless tidak punya shell, jadi healthcheck memakai binary itself tidak
# memungkinkan — endpoint /healthz dipantau oleh orchestrator (lihat deploy.yml).
ENTRYPOINT ["/app/catavor-server"]
