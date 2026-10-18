# Audit Keamanan — DFauna / Catavor

> **Status: cakupan rute 195/195 tuntas.** 12/12 temuan putaran 1 tertutup
> (H1–L6), 6 temuan putaran 2 tertutup (N-01…N-06), 17 temuan putaran 3
> tertutup (N-07…N-20), N-22 (urutan toko default), N-23 & N-24 (pemisahan
> bidang otorisasi: jalur admin platform tidak lagi mewajibkan toko),
> N-25 (penanda staf platform: 34 hardcode email → satu sumber kebenaran)
> dan N-26 (`DeleteStore` selalu 500 karena transaksi ter-abort).
> Satu temuan masih terbuka: **N-21** (fungsional) yang menunggu keputusan
> produk, bukan perbaikan kode.
>
> Seluruh 195 rute pada `routes.json` sudah diprobe dengan verifikasi runtime:
> PUBLIC 38, AUTH-ONLY 26, MERCHANT 27, ADMIN 45, sisa pengujian lintas-peran.
> Setiap penolakan (403/404/400) disertai **kontrol positif** pada aktor yang
> berhak, karena penolakan tanpa kontrol tidak membuktikan apa pun.
> Lihat [audit-putaran-3.md](audit-putaran-3.md) untuk rinciannya.

Riwayat panjang: putaran 1 adalah audit read-only (tanpa perubahan kode).
Putaran 2 dan 3 menyertakan perbaikan, masing-masing dengan verifikasi runtime.

## Laporan utama

| File | Isi |
|---|---|
| [audit-putaran-5.md](audit-putaran-5.md) | **Laporan terbaru** — N-25 & N-26: penanda staf tanpa hardcode email, perbaikan hapus toko |
| [audit-putaran-3.md](audit-putaran-3.md) | Laporan — N-07…N-22, cakupan rute 195/195, sisa risiko |
| [audit-putaran-4.md](audit-putaran-4.md) | Putaran 4 — N-23 & N-24: pemisahan bidang otorisasi staf platform vs merchant |
| [audit-putaran-2.md](audit-putaran-2.md) | Putaran 2 — N-01…N-06 (JWT secret, path guard, route gating) |
| [STATUS-AKHIR.md](STATUS-AKHIR.md) | Ringkasan putaran 1 (H1–L6) + cara verifikasi ulang |
| [security-audit-report.md](security-audit-report.md) | Audit #1 — keamanan aplikasi (OWASP), 2 HIGH / 4 MED / 6 LOW |
| [security-audit-report-update.md](security-audit-report-update.md) | **Re-audit** — status temuan lama + permukaan baru commit `0fd2143` |
| [perbaikan-h1-h2.md](perbaikan-h1-h2.md) | **Eksekusi H1 & H2** — CVE bump + body leak fix (terverifikasi runtime) |
| [perbaikan-m4.md](perbaikan-m4.md) | **Eksekusi M4** — `err.Error()` di response (31 titik → 0) |
| [perbaikan-m3.md](perbaikan-m3.md) | **Eksekusi M3** — Redis wajib di production (fail closed) |
| [perbaikan-m2-csp.md](perbaikan-m2-csp.md) | **Eksekusi M2** — CSP: hash script, tanpa unsafe-eval |
| [perbaikan-low-l1-l6.md](perbaikan-low-l1-l6.md) | **Eksekusi L1–L6** — traversal, sanitizer, CORS, JWT secret, DB SSL |
| [mitigasi-m1.md](mitigasi-m1.md) | **Mitigasi M1** — token 12 jam + deteksi anomali sesi |
| [perbaikan-m1-penuh.md](perbaikan-m1-penuh.md) | **M1 penuh** — cookie HttpOnly + CSRF + tiket SSE |
| [remediation-plan.md](remediation-plan.md) | Urutan fix + patch minimal |
| [findings.json](findings.json) | Data temuan (machine-readable) — H1–L6 + N-01…N-26 (29 temuan; hanya N-21 masih `open`) |

## Ketahanan sesi panjang (UI/memori/stabilitas)

| File | Isi |
|---|---|
| [long-session-resilience-audit.md](long-session-resilience-audit.md) | Master laporan (v1.2) — degradasi UI sesi panjang |
| [catatan-penyelesaian-fase1.md](catatan-penyelesaian-fase1.md) | Catatan implementasi Fase 1 + hasil E2E |
| [temuan-refresh-admin-multi-store.md](temuan-refresh-admin-multi-store.md) | Bug refresh merchant multi-store — **fixed** |
| review-*.md | Riwayat review iteratif (laporan & implementasi) |

## Ringkas status

- **Keamanan**: 12/12 temuan putaran 1 tertutup. Putaran 2: N-01…N-06 tertutup. Putaran 3: N-07…N-19 tertutup (4 KRITIS: N-13, N-14, N-18, N-19).
  Putaran 3: N-07…N-19 tertutup, semuanya diverifikasi runtime; N-11, N-12, N-15, N-16, N-17, N-18, dan N-19
  disertai kontrol negatif.
- **Cakupan uji**: 34 dari 195 rute (17,4 %) terbukti lewat probe runtime;
  161 rute (82,6 %) **belum** diprobe. Ada 140 handler unik (banyak rute alias). Angka ini adalah permukaan yang belum
  terbukti, bukan yang terbukti aman.
- **Sisa risiko**: secret JWT lama masih ada di riwayat git publik (nilainya
  inert); sesi lama tidak berlaku akibat rotasi secret; `git filter-repo`
  belum dijalankan (keputusan pemilik repo).
- **Resilience frontend**: Fase 1 selesai + terverifikasi E2E (14 test, 2 device).
- **Belum dikerjakan**: Fase 2 (cleanup ~40 useEffect), Fase 3 (idle-resync, telemetri, modularisasi), Fase 2 infrastruktur (WAF/TLS/backup).
