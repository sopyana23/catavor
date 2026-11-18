# syntax=docker/dockerfile:1

# =============================================================================
# Catavor — Image Produksi Multi-Stage (Tri-Frontend + Hardened Distroless)
#
# Tahap 1-2 membangun ketiga frontend native (desktop, tablet, & mobile)
# menggunakan Node sesuai .nvmrc.
# Tahap 3 mengompilasi binary statis server utama + CLI administrasi/break-glass.
# Tahap 4 memuat binary + bundel statis 3 form-factor + CA certificates dan
# berjalan sebagai user nonroot (uid 65532) tanpa shell dan tanpa package manager.
#
# Build produksi:
#   docker build \
#     --build-arg VITE_GOOGLE_CLIENT_ID="<google-client-id>" \
#     -t catavor:prod .
# =============================================================================

# -----------------------------------------------------------------------------
# Tahap 1: dependensi ketiga frontend (desktop, tablet, mobile)
# -----------------------------------------------------------------------------
FROM node:22.23.5-bookworm-slim AS node-base

WORKDIR /app

COPY .nvmrc ./
COPY frontend/desktop/package.json frontend/desktop/package-lock.json ./frontend/desktop/
COPY frontend/tablet/package.json  frontend/tablet/package-lock.json  ./frontend/tablet/
COPY frontend/mobile/package.json  frontend/mobile/package-lock.json  ./frontend/mobile/

RUN cd frontend/desktop && npm ci --no-audit --no-fund \
 && cd ../tablet        && npm ci --no-audit --no-fund \
 && cd ../mobile        && npm ci --no-audit --no-fund

# -----------------------------------------------------------------------------
# Tahap 2: build ketiga frontend native
# Sesuai vite.config.ts masing-masing SPA, outDir berada pada /app/public/<spa>.
# -----------------------------------------------------------------------------
FROM node-base AS frontend-build

ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY frontend/desktop/ ./frontend/desktop/
COPY frontend/tablet/  ./frontend/tablet/
COPY frontend/mobile/  ./frontend/mobile/

RUN cd frontend/desktop && npm run build \
 && cd ../tablet        && npm run build \
 && cd ../mobile        && npm run build

# -----------------------------------------------------------------------------
# Tahap 3: build backend Go statis (server + admin-cli untuk operasi break-glass)
# -----------------------------------------------------------------------------
FROM golang:1.26.11-bookworm AS backend-build

WORKDIR /src

COPY backend/go.mod backend/go.sum ./
RUN go mod download && go mod verify

COPY backend/ ./

RUN CGO_ENABLED=0 GOOS=linux go build \
      -trimpath \
      -ldflags="-s -w" \
      -o /out/catavor-server \
      ./cmd/server \
 && CGO_ENABLED=0 GOOS=linux go build \
      -trimpath \
      -ldflags="-s -w" \
      -o /out/catavor-admin-cli \
      ./cmd/admin-cli

# Siapkan direktori storage publik (0755) dan storage privat bukti bayar/tiket (0700)
# karena image distroless tidak memiliki shell pada saat runtime.
RUN mkdir -p /tmp/storage /tmp/private_storage \
 && chmod 0755 /tmp/storage \
 && chmod 0700 /tmp/private_storage

# -----------------------------------------------------------------------------
# Tahap 4: runtime minimal non-root
# -----------------------------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot AS runtime

WORKDIR /app

COPY --from=backend-build /out/catavor-server    /app/catavor-server
COPY --from=backend-build /out/catavor-admin-cli /app/catavor-admin-cli

# Bundel statis Tri-Frontend (Desktop, Tablet, Mobile) hasil kompilasi Vite.
COPY --from=frontend-build /app/public/desktop /app/public/desktop
COPY --from=frontend-build /app/public/tablet  /app/public/tablet
COPY --from=frontend-build /app/public/mobile  /app/public/mobile

# Direktori storage milik uid/gid 65532 (nonroot).
COPY --from=backend-build --chown=65532:65532 /tmp/storage         /data/storage
COPY --from=backend-build --chown=65532:65532 /tmp/private_storage /data/private_storage

USER nonroot:nonroot

# Di dalam jaringan jembatan internal Docker, container perlu menerima koneksi
# dari container reverse proxy (Caddy/Nginx) sehingga BIND_ADDR diset 0.0.0.0;
# port 8000 TIDAK dipublikasikan ke 0.0.0.0 host pada docker-compose.prod.yml.
ENV PORT=8000 \
    BIND_ADDR=0.0.0.0 \
    APP_ENV=production \
    DB_SSLMODE=require \
    DB_AUTO_MIGRATE=false \
    STORAGE_DRIVER=local \
    STORAGE_LOCAL_ROOT=/data/storage \
    STORAGE_PRIVATE_ROOT=/data/private_storage \
    DESKTOP_DIST_DIR=/app/public/desktop \
    TABLET_DIST_DIR=/app/public/tablet \
    MOBILE_DIST_DIR=/app/public/mobile

VOLUME ["/data/storage", "/data/private_storage"]

EXPOSE 8000

ENTRYPOINT ["/app/catavor-server"]
