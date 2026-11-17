## Review Putaran 14 — Verifikasi Konsistensi Rancangan (17 November 2026)

**Cakupan:** perbaikan kontrak pada implementation plan berdasarkan temuan Putaran 13. Ini adalah revisi desain dokumen dan probe DDL pada database clone; bukan implementasi MFA, pengujian handler/migrator end-to-end, maupun persetujuan.

### Rangkuman perubahan desain

| Area | Kontrak yang ditegaskan |
|---|---|
| Anti-replay TOTP | PostgreSQL `two_factor_last_totp_step` adalah otoritas monotonik di bawah row lock; Redis hanya cache opsional. |
| Lockout akun | PostgreSQL `mfa_account_lockouts` otoritatif, fixed window 15 menit, 5 faktor salah mengunci 15 menit; sukses tidak membuka lock aktif. Redis hanya challenge/lease. |
| Idempotensi kegagalan faktor | Tabel rancangan `mfa_challenge_failures` memakai `(token_jti, lease_generation)` unik agar retry setelah hasil Redis ambigu tidak menggandakan counter; implementasi Lua/handler belum ada. |
| Challenge dan sesi | PostgreSQL menyimpan konsumsi faktor + completion pending, Redis settlement bukan transaksi atomik; session row tetap revoked sampai CAS PG kedua. Cookie hanya setelah commit kedua. |
| Onboarding/backup code | Aktivasi MFA, hash backup code, setup binding, session pending, dan audit di transaksi PG; receipt Redis bukan recovery source. Receipt/response hilang tidak boleh me-mint ulang sesi/codes; login TOTP + rotate codes atau recovery ber-otorisasi. |
| Migrasi | N-60 belum menjadi file. Fresh AutoMigrate, tracked/manual, legacy baseline, `SKIP_DB_MIGRATE`, model, dan GORM insert masih memerlukan uji disposable. DDL embedded diaplikasikan dua kali pada clone 51-table; probe bukan bukti runtime. |
| Audit | `ActivityLog` insert wajib error-propagating di transaksi; `activity_logs` ber-retention dan bukan tamper-evident. SIEM/WORM diperlukan bila tamper evidence adalah requirement. |
| Break-glass | Table lock hanya serialisasi terbatas; urutan lock/timeout dan semua writer role harus tunduk pada protokol yang sama. Uji concurrence wajib. |
| Session middleware | `AuthRequired` saat ini hanya menolak row session jika query menemukan `is_revoked=true`; row hilang/query error tidak ditolak oleh cek itu. Perlu fail-closed perbaikan dan tes sebelum rollout. |

### Verifikasi yang dilakukan

- DDL yang diekstrak dari plan dijalankan dengan PostgreSQL `psql -v ON_ERROR_STOP=1` dua kali pada `catavor_n60_verify`, clone schema (51 tabel awal). Kedua eksekusi exit 0; setelahnya tabel `mfa_account_lockouts` dan `mfa_challenge_failures` terdeteksi dan total tabel 55. Ini membuktikan syntax/apply-repeat pada clone tersebut saja.
- Tidak menjalankan migration runner, AutoMigrate, Redis, handler, concurrency/fault-injection, atau tes aplikasi MFA.
- Pemeriksaan Git seluruh status: `AGENTS.md` modified; dua dokumen security-audit untracked. `git diff --check` exit 0 tetapi mencakup tracked diff saja dan tidak memeriksa isi dokumen untracked. Tidak stage/commit.

### Blocker tersisa

1. Reviewer independen menerima desain; plan berstatus **NOT APPROVED / NO CODE AUTHORIZATION**.
2. Buat N-60 sebenarnya beserta model GORM dan jalur upgrade legacy yang eksplisit; jalankan matriks fresh/tracked/legacy/skip pada disposable DB.
3. Tetapkan/implementasikan minimum Redis 6.2+ atau alternatif atomic-compatible; validasi startup dan availability fail-closed.
4. Implementasi challenge Lua, failure-event idempotency, session middleware fail-closed, durable completion/reconciler, cookie/response-loss recovery, audit tx, onboarding dan backup-code rotation; uji setiap crash/ambiguity point.
5. Tetapkan enkripsi payload, key lifecycle/retention, cleanup completion/event, retry identity, dan manual-recovery authorization/expiry.
6. Uji lockout lintas-JTI dan paralel, TOTP/backup-code concurrency, role-mutation vs break-glass, transaction rollback bila ActivityLog gagal, session insertion dan setiap migrator path.
7. Jangan mengubah `AGENTS.md`; jangan stage/commit perubahan ini tanpa instruksi.



## Review Putaran 15 — Penutupan Reaudit Dokumen (17 November 2026)

**Cakupan:** cek silang kedua setelah penyelarasan tabel login, endpoint merchant, lockout failure-idempotency, dan checklist gate. Revisi plan ini masih draf; review ini bukan approval atau eksekusi kode.

- Cek silang kontrak kanonik: anti-replay TOTP PG monotonik; lockout akun PG; challenge Redis lease/counter; sukses faktor diikuti completion pending → settlement → CAS PG dan penerbitan cookie setelah commit; receipt onboarding/backup code tidak menjadi sumber recovery plaintext.
- Plan sekarang secara eksplisit menyebut `AuthRequired` fail-open terhadap row session hilang/query error sebagai prasyarat yang perlu diperbaiki; readiness schema/Redis dan reconciler belum tersedia. DDL embedded pernah diuji apply/rerun pada clone saja; migration file N-60/model/runner belum dibuat/dijalankan.
- Checklist akhir menyatukan migration, completion, onboarding/merchant, audit, break-glass, middleware, dan tes; semua masih `[ ]` sebagai kerja ke depan.
- Git: `M AGENTS.md` adalah perubahan yang sudah ada dan tidak disentuh oleh revisi ini; plan dan catatan review berstatus untracked. `git diff --check` bersih untuk tracked diff; pemeriksaan whitespace teks pada kedua file untracked menemukan nol trailing spaces. Tidak ada file stage/commit.
- Batas provenance tetap berlaku: riwayat catatan review pernah dimodifikasi sebelumnya; tidak diklaim append-only/prefix immutable.
