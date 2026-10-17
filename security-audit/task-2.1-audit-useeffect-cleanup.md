# Task 2.1 — Audit `useEffect` cleanup (hasil pengukuran ulang)

**Tanggal**: 2026-10-17
**Klaim audit awal**: ~41 `useEffect` mobile dan ~39 desktop kurang `return () =>` cleanup.
**Hasil pengukuran**: **0 kebocoran resource.** Klaim tidak sesuai kode aktual.
**Kode produksi diubah**: **tidak ada.** Task ini menghasilkan guard regresi + koreksi angka.

---

## 1. Kenapa angka audit menyesatkan

Audit menghitung `useEffect` yang tidak punya `return () =>` — tanpa membedakan
effect yang **mendaftarkan resource** dari effect yang murni (set state, sinkron
DOM sekali, baca localStorage, dsb). Mayoritas `useEffect` di App.tsx adalah
tipe kedua, yang memang **tidak butuh** cleanup.

Pengukuran ulang memakai brace-matching (bukan grep baris) dan hanya menuntut
cleanup untuk resource yang benar-benar wajib dibersihkan:

| Resource | Wajib dibersihkan dengan |
|---|---|
| `addEventListener` | `removeEventListener` |
| `setInterval` | `clearInterval` |
| `new EventSource` / `WebSocket` | `.close()` |
| `new Intersection/Resize/MutationObserver` | `.disconnect()` |
| `subscribeAuthSync` | `unsubscribe()` |
| `requestAnimationFrame` | `cancelAnimationFrame` |
| `reconnectTimer =` (SSE backoff) | `clearTimeout(reconnectTimer)` |

`setTimeout` **tidak** dimasukkan: timeout sekali-jalan yang hanya memanggil
`setState`/scroll tidak menahan apa pun setelah unmount, dan memaksakan
`clearTimeout` untuk semuanya justru menambah kode tanpa manfaat. Yang
diperiksa khusus adalah timer backoff/reconnect yang dipakai ulang.

---

## 2. Angka aktual

| | Mobile (`App.tsx`) | Desktop (`App.tsx`) |
|---|---|---|
| `useEffect` total | 72 | 74 |
| Effect tanpa resource (aman, tak perlu cleanup) | 49 | 48 |
| Effect ber-resource **dengan** cleanup | 23 | 26 |
| Effect ber-resource **tanpa** cleanup | **0** | **0** |

Pasangan mentah juga seimbang:

| | Mobile | Desktop |
|---|---|---|
| `addEventListener` / `removeEventListener` | 18 / 18 | 22 / 22 |
| `setInterval` / `clearInterval` | 6 / 8 | 6 / 8 |
| `new EventSource` | 1 | 1 |
| `.close()` | 4 | 4 |

`clearInterval` lebih banyak dari `setInterval` karena ada `clearInterval`
defensif di beberapa handler; tidak ada interval tanpa pembersih.

---

## 3. Kandidat yang diperiksa satu per satu (semua aman)

Semua `useEffect` yang memakai `setTimeout` diperiksa manual:

| Lokasi | Isi timeout | Verdict |
|---|---|---|
| mobile L2556 / desktop L2761 | `focus()` textarea saat fullscreen | aman — tidak menahan resource |
| mobile L5309 / desktop L5463 | SSE: `reconnectTimer` + `addEventListener` | aman — `isMounted=false`, `clearTimeout(reconnectTimer)`, `eventSource.close()` di cleanup |
| mobile L6622 / desktop L6666 | scroll ke atas setelah `rafId` | aman — `cancelAnimationFrame(rafId)`; `setTimeout` hanya scroll |
| mobile L9170 / desktop L8053 | scroll chat tiket ke bawah | aman — `setState`/scroll saja |
| mobile L11051 / desktop L10870 | `subscribeAuthSync` | aman — `return () => unsubscribe()` |
| mobile L11679 | scroll listener | aman — `removeEventListener` di cleanup |

---

## 4. Yang dikerjakan

**Guard regresi** — `tests/e2e/task-21-effect-cleanup.spec.ts`

Dua test per platform (dijalankan lewat runner Playwright yang sudah ada, jadi
tidak menambah framework):
- memastikan selalu ada >10 effect ber-resource yang diperiksa (test tidak
  lulus secara hampa kalau file berubah bentuk)
- gagal bila ada effect ber-resource tanpa pembersih, dengan menyebut nomor baris

**Bukti guard benar-benar bekerja**: satu effect bocor disuntik sementara
(`addEventListener('resize')` tanpa `removeEventListener`) → test **FAIL**;
setelah file direvert → **PASS** 4/4. Jadi guard tidak selalu-hijau.

---

## 5. Kesimpulan

Task 2.1 **tidak punya pekerjaan perbaikan kode**. Screening yang dilakukan
tidak menemukan kebocoran listener, interval, SSE, observer, atau subscription.
Yang tersisa dari audit adalah angka yang salah metrik, bukan cacat nyata.

Kalau gejala "memori naik pada sesi panjang" masih dilaporkan, penyebabnya
bukan effect cleanup di App.tsx — perlu pengukuran heap langsung (DevTools
Memory Profiler) atau penelusuran sumber lain: cache SWR, akumulasi state,
atau bundle besar.
