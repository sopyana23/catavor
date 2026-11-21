# Graphify — Setup & Batasan (terukur)

Terakhir diukur: commit `ad25a7b`, 21 Nov 2026, mesin dev lokal (Windows, git-bash).

## Yang aktif

**Hanya graph backend.** Frontend sengaja tidak di-extract.

```bash
export PATH="$HOME/.local/bin:$PATH"
cd backend && graphify update .        # inkremental, 2.5s
```

Hasil backend: **2.017 node · 12.486 edge · 78 komunitas**,
92% EXTRACTED / 8% INFERRED (avg confidence 0.84), biaya token build **0**.

## Kenapa frontend tidak di-graph

Dua renderer monolitik mendominasi biaya parse:

| File | Ukuran |
|:---|:---|
| `mobile/src/App.tsx` | 2.0 MB |
| `desktop/src/App.tsx` | 1.8 MB |

tree-sitter harus mengurai ~3.8 MB TSX di dua file itu. Hasil ukur:

| | build | update inkremental |
|:---|---:|---:|
| backend (2.017 node) | 7s | **2.5s** |
| frontend (1.527 node) | **6m21s** | **6m20s** |

Incremental pada backend memang jalan (`No code-graph topology changes
detected`). Di frontend tidak menolong: file monolit diparse ulang penuh
setiap kali. Nol manfaat sepadan dengan 6 menit per build.

**Kalau butuh graph frontend**, extract per-app, jangan seluruh `frontend/`:

```bash
graphify extract ./frontend/tablet --code-only   # 0.1 MB, cepat
graphify extract ./frontend/mobile --code-only   # 2.0 MB, ~3 menit
```

`.graphifyignore` di `frontend/` sudah disiapkan untuk itu. Isinya
mencegah `dist/` dianggap arsitektur asli — itu alasan utamanya, bukan
percepatan (uji A/B: 6m33s vs 6m22s, selisih noise).

## Akurasi yang sudah diverifikasi

15 klaim baris-spesifik diuji dengan `sed` terhadap file aslinya.
**Semua tepat sampai nomor baris**, termasuk edge `INFERRED`:

| Klaim | Verifikasi |
|:---|:---|
| `AuthRequired` `auth.go:L307` | `func AuthRequired(...)` di L307 |
| dipanggil `main.go:L436` | `middleware.AuthRequired(cfg)` di L436 |
| `IsRedisAvailable` `auth.go:L617` | tepat di L617 |
| `User` struct `user.go:L10` | `type User struct {` di L10 |
| `RegisterSessionFingerprint` `auth.go:L640` | tepat di L640 |
| `.IsPlatformStaff()` L349 (INFERRED 0.85) | benar |

Temuan berguna: `graphify affected MfaPolicyFor` menemukan
`.RefreshToken()` di `auth_handler.go:L2054` — jalur refresh token
memang di-gate MFA. **Grep hanya menemukan 5 baris; graphify 12 pemanggil.**

## Batasan yang perlu diingat

1. **Bukan pengganti grep.** Untuk `grep -rn MfaPolicyFor` (53 kata) vs
   `graphify affected` (70 kata), grep **lebih hemat 32%** untuk pertanyaan
   sempit. Klaim "83x hemat" diukur vs membuang SELURUH corpus (134k token),
   bukan vs grep.
2. **Query natural-language kasar.** `query "alur autentikasi"` mengembalikan
   257 node, dipotong 20, dan memuat noise (`TestNotificationSuperadmin...`
   untuk pertanyaan soal token). Pertanyaan luas = hasil ngawur.
3. **Tanpa API key, komunitas jadi `Community 0..77`.** `GRAPH_REPORT.md`
   kehilangan nilai sebagai peta. Yang tetap berguna: God Nodes,
   Surprising Connections, Import Cycles.
4. **Simbol bernama sama ambigu.** `App()` ada 3 (mobile/desktop/tablet).
   Harus pakai `path::symbol` → `graphify explain "mobile/src/App.tsx::App()"`.
5. **11 file migrasi `.sql` tidak ter-extract** — butuh
   `pip install "graphifyy[sql]"`.

## Kapan pakai apa

| Pertanyaan | Alat |
|:---|:---|
| "X dideklarasikan di mana" | grep |
| "kalau X diubah, apa yang kena" | **graphify affected** |
| "alur A ke B lewat mana" | **graphify path** |
| "jelaskan struktur module X" | **graphify explain** |
| "hub arsitektur / import cycle" | **graphify god-nodes** |

Graphify untuk **peta**, grep untuk **konfirmasi**.
