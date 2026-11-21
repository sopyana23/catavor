# QA harness — bukti runtime

Skrip QA yang menjadi bukti pengukuran, dipakai oleh sesi kerja halaman
kebijakan (mobile / tablet / desktop) dan Graphify.

Di-commit sebagai aset, bukan artefak: angka di laporan (`21/21`, `42/42`,
`7/7`, header 53px, touch 44×44) hanya bisa direproduksi kalau skripnya ada.

**Bukan bagian dari build produksi.** Tidak ada impor dari `frontend/` maupun
`backend/`. Jalankan manual dari `C:\MyProject\DFauna\tests` (Playwright di
sana), dengan server uji di `http://127.0.0.1:8001`.

## Isi

| Skrip | Assertion | Catatan |
|:---|:---|:---|
| `qa_mobile_policy_header.cjs` | 21/21 | Header policy 53px, tombol visual 36px, sentuh 44×44 |
| `qa_btn_scope_audit.cjs` | 7/7 | 6 call-site `.btn-back-circle`; 1 varian policy, 5 tetap 44×44 |
| `qa_policy_routing_v2.cjs` | 42/42 | 7 dokumen × 3 device × 2 (route + render) |

Harness parser **tidak** di sini — file aslinya
`frontend/desktop/policyParser.check.mts` (21/21). Runner itu gagal di mesin
ini karena `react` / `lucide-react` tak ter-resolve; bukti 21/21 diperoleh
dari harness terpisah.

Skrip yang ada di sini tapi **tidak** dirujuk laporan mana pun adalah hasil
probe sekali pakai — simpan hanya kalau masih bisa dijalankan.
