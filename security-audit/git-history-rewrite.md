# Git History Rewrite — Penghapusan Secret Lama

**Tanggal:** 2026-10-18
**Alasan:** Dua secret JWT pernah ter-commit ke repository publik
(`github.com/sopyana23/catavor`) dan masih dapat dibaca siapa pun dari history.

## Secret yang dihapus

| Commit asal | Secret | Panjang | Masih dipakai? |
|---|---|---|---|
| `a1f5eca` | `catavor_super_secret_jwt_key` | 28 char | Tidak |
| `f2a726f` | `catavor_super_secure_jwt_secret_key_2026_industrial_saas` | 56 char | Tidak |

Secret aktif saat ini adalah nilai 64 char acak yang **berbeda dari keduanya**
dan hanya ada di `backend/.env` (tidak ter-track git).

Catatan: karena kedua secret sudah tidak dipakai, risiko eksploitasinya rendah.
Penghapusan dilakukan untuk menghilangkan pola buruk (repo publik menyimpan
secret) sekaligus mencegah orang mengira nilai tersebut masih valid.

## Metode

`git-filter-repo --replace-text` dengan file aturan yang mengganti kedua string
menjadi `***REMOVED***` di seluruh 585 commit.

```
python -m git_filter_repo \
  --replace-text jwt-secret-replacements.txt --force
```

## Prosedur yang dijalankan

1. **Backup 3 lapis** sebelum menyentuh apa pun:
   - `git clone --bare` → direktori 293 MB, 585 commit
   - `git bundle create --all` → file 72 MB (portabel, 1 file)
   - `cp -r .git` → salinan mentah 293 MB
2. **Backup diuji** dengan clone dari bundle: 585 commit, HEAD `9bd26b3`,
   1173 file — terbukti dapat dipulihkan.
3. **Dry-run** pada salinan hasil clone bundle, bukan repo asli.
4. Rewrite repo asli.
5. Force-push `dev`, `main`, dan kedua tag.
6. **Verifikasi dari remote** dengan clone `--mirror` baru.

## Hasil verifikasi

Dijalankan dari clone bersih `https://github.com/sopyana23/catavor.git`:

- Total commit: **585** (tidak ada yang hilang)
- `dev` = `202f6fb`, `main` = `c730c5b`
- Tag: `checkpoint-before-multistore`, `checkpoint-multistore-completed`
- Secret `catavor_super_secret_jwt_key`: **0 commit**
- Secret `catavor_super_secure_jwt_secret_key_2026_industrial_saas`: **0 commit**
- Tree HEAD **identik** dengan sebelum rewrite (`git diff` kosong) — hanya
  history yang berubah, kode tidak tersentuh
- Build backend dari hasil rewrite: **sukses** (49 MB)
- Login runtime pasca-rewrite: **OK** (token 455 char, `superadmin`)
- `healthz`, `/`, `/desktop/`, `/mobile/`: semua **200**

## Dampak yang perlu diketahui

- **Semua commit SHA berubah.** Referensi ke SHA lama di dokumen/laporan
  audit sebelumnya tidak lagi cocok dengan history saat ini.
- Siapa pun yang sudah memiliki clone lama **wajib clone ulang**; `git pull`
  biasa akan gagal atau mencampur history.
- Tag lama (`7a96d94`, `d7603c1`) sekarang menjadi `64d4ee1`, `5126c84`.

## Catatan operasional

- `.env` lokal tidak tersentuh rewrite; secret aktif tetap sama.
- Lokasi backup (di `%LOCALAPPDATA%\Temp`, akan hilang bila Temp dibersihkan):
  - `dfauna-pre-filterrepo-*.bundle/` (bare clone)
  - `dfauna-backup-20261018.bundle` (file bundle)
  - `dfauna-dotgit-backup/` (salinan .git)

  Pindahkan ke penyimpanan permanen bila ingin dipertahankan.
