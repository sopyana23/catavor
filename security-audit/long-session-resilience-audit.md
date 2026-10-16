# Master Laporan Audit — Ketahanan Sesi Panjang, Stabilitas Memori & Degradasi UI
### Catavor (DFauna) — Desktop & Mobile Single Page Application (SPA)

- **Tanggal Dokumen**: 2026-10-16 (Revisi v1.2 - 100% Solid & Final Verified)
- **Status Dokumen**: Master Consolidated Audit & Phased Implementation Plan (Ready for Execution)
- **Catatan Volatilitas Kode (N2)**: Nomor baris yang dikutip di bawah merupakan snapshot dari codebase saat audit (`mobile: 34.547 baris`, `desktop: 33.851 baris`). Saat tahap eksekusi perbaikan, developer diwajibkan mencari target via nama fungsi/simbol (*grep pattern*), bukan mengandalkan nomor baris statis.
- **Lingkup Audit**: 
  - `frontend/mobile/src/App.tsx` (34.547 baris, **308 `useState`**) & `frontend/desktop/src/App.tsx` (33.851 baris, **282 `useState`**)
  - `frontend/mobile/src/utils/` (`navigation.ts`, `apiClient.ts`, `authSync.ts`, dll.)
  - `frontend/desktop/src/utils/` (`navigation.ts`, `apiClient.ts`, `authSync.ts`, dll.)
  - Komponen Modal, Sheet, Drawer, dan Bottom Navigation
  - Backend Realtime Hub (`backend/notification_hub.go`, streaming handler)
- **Konteks Masalah**: Menilai ketahanan platform jika pengguna (merchant admin maupun publik) aktif intensif, tidak pernah keluar/refresh dalam jangka waktu lama, atau idle berjam-jam: apakah rentan memicu bug aneh seperti **footer/komponen tiba-tiba hilang**, **tombol kembali macet/stuck**, **aksi tak sinkron**, atau **layar error siluman**.

---

## 1. Ringkasan Eksekutif & Verdict Akhir

> **VERDICT AKHIR: RISIKO SANGAT NYATA & SISTEM SAAT INI BELUM SIAP (CRITICAL)**  
> Kekhawatiran Anda bahwa platform dapat mengalami anomali (seperti footer lenyap tiba-tiba, tombol kembali terkunci/susah kembali, atau layar blank saat beraktivitas lama) **BUKAN paranoid, melainkan konsekuensi nyata dari arsitektur frontend saat ini**.

Kombinasi antara komponen monolitik raksasa (**308 `useState` di mobile, 282 di desktop**), ketiadaan React Error Boundary sama sekali, pengikatan variabel boolean yang rapuh pada visibilitas footer (`!error`), race condition 150ms pada history stack back-navigation, serta SWR cache tanpa batas pada `localStorage` (limit 5MB) membuat gejala-gejala tersebut **pasti terjadi (probable)** jika sesi dibiarkan berjalan panjang tanpa refresh.

Backend platform (`backend/notification_hub.go`) terbukti sehat dan tangguh, sehingga **100% akar permasalahan berada di arsitektur klien (frontend)**.

---

## 2. Referensi Teknis Industri (Mengapa SPA Bisa "Rusak Sendiri" di Sesi Panjang?)

1. **Blast Radius Uncaught Error di React 18:**  
   Sejak React 16 hingga 18, perilaku baku React saat terjadi error runtime JavaScript di dalam fase rendering atau lifecycle adalah **meng-unmount seluruh subtree komponen terdekat yang tidak memiliki Error Boundary**. Tanpa boundary, error kecil pada satu kartu produk atau parsing tanggal langsung menghilangkan seluruh halaman atau bagian penting antarmuka (*blank screen / disappearing components*).
2. **Boolean State Drift & Entanglement:**  
   Dalam sesi panjang, state lokal cenderung mengalami desinkronisasi. Ketika visibilitas elemen kunci (seperti Bottom Nav) diikat secara ketat ke puluhan variabel state independen (`!error && !selectedItem && !isDetail && !actionMenu && ...`), kegagalan satu proses asinkron di latar belakang akan meninggalkan flag "tertinggal" yang membunuh elemen UI tersebut secara permanen.
3. **History Traversal Ping-Pong Loop (Back Button Trap):**  
   Saat pengguna menekan tombol Kembali, browser memicu event `popstate`. Jika aplikasi SPA mencoba mengelola sinkronisasi URL dua arah (URL $\leftrightarrow$ State) menggunakan timer debounce sembarangan, keterlambatan render pada perangkat akan memicu efek ping-pong: Browser bergerak mundur (*back*), tetapi effect mendeteksi URL berubah lalu mengeksekusi `pushState` maju kembali, mengunci pengguna di halaman yang sama (*trapped*). Solusi kanonis adalah **memisahkan popstate sepenuhnya dan tidak pernah memanggil `pushState` sebagai respon atas traversal history**.
4. **Browser Storage Exhaustion (5 MB Quota Exceeded):**  
   Penyimpanan browser (`localStorage`) memiliki batas kuota ketat 5 MB per origin. Tanpa algoritma eviksi (LRU - *Least Recently Used*), sesi penjelajahan publik atau admin aktif yang menyimpan riwayat request GET akan melampaui kuota ini. Begitu tercapai, browser melempar exception `QuotaExceededError`, melumpuhkan penyimpanan token login dan preferensi user seketika.
5. **Memory Leaks & Garbage Collection (GC) Thrashing di Mobile:**  
   Di HP dengan RAM terbatas (2–4 GB), alokasi ribuan closure per detik dari puluhan `useEffect` tanpa fungsi pembersih (`return () =>`) memaksa engine JavaScript melakukan *Garbage Collection stop-the-world* secara agresif. Ini terlihat oleh pengguna sebagai lag parah, frame drop, animasi macet, hingga webview crash/reload sendiri.

---

## 3. Master Daftar Temuan Audit (Severity-Ranked)

### 🔴 Tingkat Kritis (Critical - High Blast Radius)

#### [CRIT-1] Formula Visibilitas Footer & Bottom Nav Rapuh
- **File**: `frontend/mobile/src/App.tsx` (Snapshot Baris 17529–17562)
- **Akar Masalah**:  
  `isBottomNavVisible` diikat langsung ke ekspresi:
  ```typescript
  const isBottomNavVisible = Boolean(
    !error &&
    settings?.dormancy_status !== 'suspended' &&
    !settings?.is_suspended &&
    settings?.dormancy_status !== 'banned' &&
    !showLightbox &&
    !selectedFauna &&
    !isDetailActive &&
    !actionMenuData &&
    !showStoreSwitcherModal &&
    !showCreateStoreModal &&
    !isCreatingTicket &&
    !selectedTicket &&
    view === 'tabs' &&
    (...)
  );
  ```
  1. **Keterikatan `!error` & Pemicu Aktual (Koreksi K1)**:  
     Seluruh 5 pemanggilan `setError(...)` di mobile `App.tsx` (baris 11042, 11210, 11237, 11321, 11323) berasal dari **kegagalan fetch katalog utama atau profil toko** (`fetchFaunas` / `fetchSettings`), seperti 404 katalog tidak ditemukan, slug toko yang kena ban, atau gangguan koneksi saat inisialisasi/reload katalog. Ketika `setError` terisi string pesan error, kondisi `!error` menjadi `false`, dan **seluruh bottom navigation langsung lenyap dari layar**, meskipun pengguna sedang mencoba menavigasi menu.
  2. **Flag Modal Tertinggal (~11 Flag Boolean)**:  
     Visibilitas bottom nav bergantung pada ~11 flag modal/sub-view (`showLightbox`, `selectedFauna`, `isDetailActive`, `actionMenuData`, `showStoreSwitcherModal`, `showCreateStoreModal`, `isCreatingTicket`, `selectedTicket`, dll.). Jika user menutup salah satu modal tetapi terjadi unhandled error sebelum seluruh state terkait di-clear, state tersebut tertinggal bernilai *truthy*, mengakibatkan bottom nav hilang permanen sampai hard-refresh.

#### [CRIT-2] Total Ketiadaan React Error Boundary di Seluruh Aplikasi
- **File**: Seluruh direktori `frontend/mobile/` dan `frontend/desktop/` (0 hasil pencarian `ErrorBoundary`)
- **Akar Masalah**:  
  Tidak ada satu pun komponen pembungkus batas kesalahan (*Error Boundary*), baik di level akar (`main.tsx`), level halaman, maupun level komponen kunci (seperti konten tab atau footer).
- **Dampak Langsung**:  
  Jika salah satu item katalog memiliki field yang `undefined`, format mata uang gagal, atau string JSON di storage korup saat sesi panjang, React 18 langsung meng-unmount seluruh komponen pohon. Pengguna mendapati layar putih atau elemen yang tiba-tiba hilang tanpa fallback pesan error.

#### [CRIT-3] Race Condition 150ms pada `isPopStateRef` & History Stack Trap
- **File**: `frontend/mobile/src/App.tsx` (Baris 10311–10314) & `frontend/desktop/src/App.tsx` (Baris 10243–10245, 11303–11315)
- **Akar Masalah**:  
  ```typescript
  // Saat popstate terpanggil:
  isPopStateRef.current = true;
  setTimeout(() => {
    isPopStateRef.current = false;
  }, 150); // <-- Race condition
  ```
  Pada HP Android atau desktop berbeban tinggi, render ulang komponen monolitik 34k baris memakan waktu **>150ms**. Begitu timer habis, `isPopStateRef.current` sudah kembali bernilai `false`.  
  Ketika `useEffect` sinkronisasi URL dijalankan:
  ```typescript
  if (currentFull !== targetPath) {
    if (isPopStateRef.current) {
      window.history.replaceState(...);
    } else {
      window.history.pushState(...); // <-- MENJEBAK PENGGUNA
    }
  }
  ```
  Karena `isPopStateRef` sudah `false`, sistem mengeksekusi `pushState()` maju kembali.
- **Dampak Langsung**:  
  Pengguna menekan tombol Kembali, tetapi sistem langsung memaksanya maju kembali ke URL semula. Pengguna terjebak (*stuck*) dan tombol kembali terasa macet.

#### [CRIT-4] Ketidakseimbangan Hook Cleanup (`useEffect` Primitive Leaks)
- **Statistik Audit**:
  - `frontend/desktop/src/App.tsx`: **73 `useEffect`**, hanya **34 yang memiliki cleanup (`return () =>`)** (~39 efek tanpa pembersih).
  - `frontend/mobile/src/App.tsx`: **71 `useEffect`**, hanya **30 yang memiliki cleanup** (~41 efek tanpa pembersih).
- **Akar Masalah**:  
  Banyak efek yang mendaftarkan event listener DOM, timer `setTimeout`, interval polling, atau langganan channel tanpa fungsi pembatalan saat unmount/remount.
- **Dampak Langsung**:  
  Akumulasi listener ganda di memory, callback zombie mengeksekusi fungsi di latar belakang dengan data basi (*stale closure*), memori JavaScript terus membengkak seiring bertambahnya durasi sesi.

---

### 🟠 Tingkat Tinggi (High - Operational Instability)

#### [HIGH-1] 6 Bottom Sheet Mobile Belum Dilindungi Modal Back Interceptor
- **File**: `frontend/mobile/src/App.tsx`
- **Konteks & Fakta**:  
  Mekanisme `useModalBackHandler` sebetulnya **sudah ada dan terpasang di 8 call-site** di dalam `mobile/src/App.tsx` (baris 2581, 9596, 9597, 9598, 9599, 9600, 9605, 9617, ditambah pemakaian di komponen anak mandiri). Namun, terdapat **6 bottom sheet spesifik** yang terlewatkan dan belum dipasangi hook ini:
  1. `showCategorySheet` (Baris 6850) – Pemilih kategori katalog.
  2. `showSortSheet` (Baris 6851) – Pemilih urutan harga/abjad.
  3. `showFilterSheet` (Baris 6852) – Filter atribut lengkap.
  4. `showAdminFilterSheet` (Baris 7116) – Filter inventaris merchant.
  5. `showProductTypeSelector` (Baris 6854) – Modal pemilih tipe produk.
  6. `reportModalData` (Baris 6858) – Dialog pelaporan toko/produk.
- **Akar Masalah**:  
  Sheet-sheet di atas tidak menggunakan hook `useModalBackHandler` (melanggar aturan [AGENTS.md](file:///c:/MyProject/DFauna/AGENTS.md) Rule 2).
- **Dampak Langsung**:  
  Saat sheet terbuka dan pengguna menekan tombol Back fisik/gesture di Android, sistem tidak menutup sheet, melainkan melompat keluar dari halaman katalog/toko.

#### [HIGH-2] Kebocoran Cache SWR & Ancaman `QuotaExceededError` di LocalStorage
- **File**: `frontend/mobile/src/utils/apiClient.ts` (Baris 288–322) & `frontend/desktop/src/utils/apiClient.ts`
- **Akar Masalah**:  
  ```typescript
  memoryCache.set(cacheKey, newEntry);
  try {
    localStorage.setItem(`catavor_swr_${cacheKey}`, JSON.stringify(newEntry));
  } catch {}
  ```
  1. `memoryCache` di RAM adalah objek `Map` tanpa batas maksimal entri dan tanpa TTL eviction.
  2. Setiap panggilan GET SWR menulis data mentah ke `localStorage` dengan prefix `catavor_swr_`. Tidak ada pemangkasan berkala.
- **Dampak Langsung**:  
  Pada sesi panjang di mana pengguna membuka puluhan produk dan berpindah toko, total penyimpanan melampaui batas 5 MB browser. Panggilan `localStorage.setItem` selanjutnya melempar exception `QuotaExceededError`, menyebabkan penyimpanan auth token, session redirect, dan store switcher gagal berfungsi.

#### [HIGH-3] Siklus Hidup SSE Stream Terbuka-Tutup per Tab, `onerror` Kosong & Token di URL
- **File**: `frontend/desktop/src/App.tsx` (Baris 5754) & `frontend/mobile/src/App.tsx`
- **Akar Masalah**:  
  1. `EventSource` diikat ke dependensi `[storeSlug, portalTab]`. Setiap pergantian tab/portal, koneksi SSE ditutup lalu dibuat koneksi TCP baru.
  2. Blok `onerror` dibiarkan kosong (`/* SSE will auto-retry */`). Jika koneksi putus permanen akibat token kedaluwarsa atau server restart, tidak ada mekanisme re-otentikasi terkelola.
  3. Token otentikasi dikirim via query string (`?token=`), mengekspos token JWT ke access log proxy/web server.
- **Dampak Langsung**:  
  Badge notifikasi transaksi dan tiket bantuan berhenti memperbarui secara diam-diam tanpa disadari user (**"aksi tidak sinkron"**).

#### [HIGH-4] Komponen Monolitik 34k Baris & Scroll Listener Tanpa Throttling rAF
- **File**: `frontend/mobile/src/App.tsx` (Baris 11645) & `App.css`
- **Akar Masalah**:  
  Fungsi `handleSmartFilterScroll` menggunakan akumulator (`accumulatedDown > 10`, `accumulatedUp > 5`) sehingga tidak memanggil `setState` pada tiap pixel pergerakan. Namun, **event listener scroll itu sendiri tetap dieksekusi secara mentah pada setiap event scroll** (puluhan kali per detik) tanpa perlindungan `requestAnimationFrame` (*rAF*) atau throttling.  
  Pada scrolling cepat, `setIsFilterHidden()` tetap terpanggil beberapa kali per detik, memaksa re-render berulang pada komponen monolitik raksasa yang memiliki **308 `useState` di mobile** dan **282 `useState` di desktop**.
- **Dampak Langsung**:  
  Beban CPU ponsel melonjak, konsumsi baterai boros, dan terjadi *micro-stutters* (lag) saat scroll katalog panjang.

---

### 🟡 Tingkat Sedang & Pemeliharaan (Medium - Maintenance & Edge Cases)

#### [MED-1] Ketiadaan Resync Komprehensif Saat Tab Kembali Aktif dari Idle Panjang
- **Akar Masalah**:  
  Saat admin merchant meninggalkan komputer/HP dalam keadaan idle berjam-jam (tab di background), data inventaris, status pesanan, dan tiket telah berubah di sisi server. Ketika tab dibuka kembali, hanya ping tiket yang berjalan, sementara katalog dan profil toko tetap menampilkan data basi.

#### [MED-2] Struktur Data Set/Map Internal Tumbuh Liar Tanpa Batas
- **File**: `App.tsx` (desktop & mobile)
- **Variabel**: `readTicketIdsRef` (Set), `desktopRecentNotifEventsRef` (Set), `analyticsCacheRef` (Map), `brokenImageUrls` (Set).
- **Akar Masalah**:  
  Entri data terus ditambah seiring navigasi tanpa batas atas (*capacity cap*) atau kadaluarsa berbasis waktu (*TTL*).

#### [MED-3] State Navigasi Bergantung `sessionStorage` Sekali-Pakai
- **File**: `App.tsx` (Baris 6442, 6456)
- **Akar Masalah**:  
  Variabel `view` dan `adminTab` dibaca dari `sessionStorage` lalu langsung dihapus (`removeItem`). Jika navigasi terganggu atau tab dibuka ganda, nilai pemulihan hilang dan user dilempar ke halaman default.

#### [MED-4] Nihilnya Error Monitoring & Observability Klien
- **Akar Masalah**:  
  Tidak ada integrasi Sentry, Datadog, atau error reporter klien. Ketika pengguna di lapangan mengalami gejala footer hilang atau tombol kembali macet, tim developer tidak memiliki log jejak crash (*stack trace*).

---

## 4. Verifikasi Komponen yang Sudah Terbukti Solid (Good Engineering Points)

Audit juga memverifikasi beberapa komponen yang **sudah diimplementasikan dengan sangat baik dan benar-benar aman dari memory leak**:

1. **Backend SSE Hub Sangat Solid (`backend/notification_hub.go`)**:  
   Menggunakan `sync.RWMutex`, buffered channel 64, heartbeat tiap 15 detik, `recover()` pada panic writer, dan fungsi `Unregister` yang menutup channel dengan bersih. Tidak ada goroutine yang bocor di server. ✅
2. **Rate Limiting & Request In-Flight Deduplication (`apiClient.ts`)**:  
   GET request yang identik diduplikasi secara in-flight (`inFlightRequests.set(...)`) dan dibersihkan di `.finally()`. Ini mencegah request beruntun (*thundering herd*). ✅
3. **Pemberhentian Timer Saat Tab Tersembunyi**:  
   Interval ping tiket (60 detik) sudah memeriksa `document.visibilityState === 'hidden'` sehingga tidak membebani browser saat tab diminimalkan. ✅
4. **Pembersihan `IntersectionObserver`**:  
   Sudah memanggil `observer.disconnect()` pada fungsi cleanup-nya. ✅
5. **Keamanan Eksekusi Script**:  
   Bebas dari penggunaan `eval()` dan manipulasi DOM berbahaya tanpa sanitasi. ✅

---

## 5. Matriks Evaluasi Ketahanan Berdasarkan Skenario Penggunaan

| Skenario Penggunaan | Potensi Gejala yang Muncul | Akar Penyebab di Kode | Status Kesiapan |
| :--- | :--- | :--- | :---: |
| **Merchant Login Berhari-hari (Desktop/Mobile)** | Admin ter-logout tiba-tiba saat token kedaluwarsa; badge tiket berhenti update; data menjadi basi. | Endpoint backend refresh (`POST /api/auth/refresh`) tersedia di server, namun frontend belum memanggilnya secara proaktif sebelum token kedaluwarsa (*client-side silent-renew*), memicu 401 dan force logout; SSE putus tanpa auto-reconnect (`CRIT-4`, `HIGH-3`, `MED-1`). | ⚠️ **Rentan** |
| **Pengunjung Jelajah Puluhan Produk di Mobile** | Bottom navigation tiba-tiba lenyap; memori HP penuh; lag saat scroll. | `isBottomNavVisible` mati akibat `!error`; SWR cache memenuhi `localStorage` 5MB; scroll listener tanpa throttle (`CRIT-1`, `HIGH-2`, `HIGH-4`). | ❌ **Gagal** |
| **Navigasi Cepat Masuk-Keluar Halaman / Detail** | Tombol Kembali terkunci di halaman yang sama (*stuck*); back gesture menutup halaman web. | Race condition 150ms di `isPopStateRef`; 6 sheet belum dipasangi back handler (`CRIT-3`, `HIGH-1`). | ❌ **Gagal** |
| **Terjadi Error Data / API Gagal Diam-diam** | Layar putih kosong (*blank*); footer dan konten hilang permanen. | Ketiadaan React Error Boundary di seluruh aplikasi (`CRIT-2`). | ❌ **Gagal** |

---

## 6. Rencana Implementasi Bertahap (Phased Implementation Plan)

Penyempurnaan dibagi menjadi **3 Fase Terukur** dengan prinsip: **Zero Regressions, Maximum Stability, High Impact First**.

```
┌────────────────────────────────────────────────────────────────────────┐
│  FASE 1: Quick Wins & Critical Hotfixes                                │
│  (Fokus: Perisai Error, Penyelamatan Footer & Navigasi Kembali)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────┴────────────────────────────────────┐
│  FASE 2: Memory, Storage, & Realtime Hardening                         │
│  (Fokus: Pembersihan Hook Cleanup, Limitasi Cache 5MB & SSE Resync)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────┴────────────────────────────────────┐
│  FASE 3: Industrial Resilience & Architecture Decoupling               │
│  (Fokus: Tab Inactivity Resync, Telemetri Error & Modularisasi)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Fase 1: Quick Wins & Critical Hotfixes (Target: 1-2 Hari)
*Tujuan: Menghentikan langsung gejala "Footer Hilang", "Layar Blank", dan "Tombol Kembali Macet".*

1. **Pembuatan & Pemasangan Granular React Error Boundary:**
   - Buat komponen `src/components/ErrorBoundary.tsx` lengkap dengan fallback UI modern, tombol "Muat Ulang Bagian Ini", dan logging console.
   - Pasang di:
     - Level Root Aplikasi (`main.tsx`).
     - Level Main Content View (`App.tsx` main container).
     - Level Footer & Bottom Navigation Bar.
2. **Pelepasan Dependensi Rapuh pada `isBottomNavVisible`:**
   - Pisahkan `!error` dari formula visibilitas Bottom Nav. Error API tidak boleh mematikan bilah navigasi.
   - Buat fungsi penutup aman (*safe atomic modal reset*) agar saat modal/sheet tertutup, flag `actionMenuData`, `isDetailActive`, dan `selectedFauna` di-reset serentak.
3. **Penyelesaian Race Condition 150ms pada Tombol Kembali:**
   - Ganti timer sembarang `150ms` di `isPopStateRef` dengan **Synchronous Navigation Lock** (penanda transisi berbasis event tick atau flag rute).
   - Pastikan URL sync effect tidak pernah memanggil `pushState` jika pemicunya adalah event `popstate`.
4. **Pemasangan Interceptor Back pada 6 Bottom Sheet:**
   - Tambahkan `useModalBackHandler` pada:
     - `showCategorySheet`
     - `showSortSheet`
     - `showFilterSheet`
     - `showAdminFilterSheet`
     - `showProductTypeSelector`
     - `reportModalData`

---

### Fase 2: Memory, Storage, & Realtime Hardening (Target: 2-3 Hari)
*Tujuan: Mencegah kebocoran memori, mencegah storage kuota habis, dan menjaga realtime sync.*

1. **Audit & Pemasangan Cleanup pada ~40 `useEffect`:**
   - Lengkapi setiap efek yang memiliki `addEventListener`, `setTimeout`, atau interval dengan fungsi pembersih `return () => { ... }`.
2. **Kapasitas Terbatas & Eviksi LRU di SWR Cache (`apiClient.ts`):**
   - Batasi `memoryCache` maksimal 50 entri paling relevan.
   - Batasi penyimpanan SWR di `localStorage` maksimal 25 item dengan auto-prune entri tertua (LRU).
   - Bungkus seluruh operasi `localStorage.setItem` dalam proteksi kuota: jika melempar `QuotaExceededError`, bersihkan seluruh cache `catavor_swr_*` secara otomatis tanpa mengganggu token login.
3. **Perbaikan SSE Stream & Penanganan Disconnect:**
   - Pasang reconnect berjangka (*exponential backoff*) pada blok `onerror` di SSE stream.
   - Hapus pembukaan ulang koneksi yang tidak perlu saat berganti sub-tab internal.
4. **Pembatasan Frekuensi Scroll Listener:**
   - Bungkus `handleSmartFilterScroll` menggunakan `requestAnimationFrame` untuk mengeliminasi lonjakan re-render saat scrolling cepat di mobile.
5. **Kapasitas Terbatas pada Koleksi Ref:**
   - Batasi ukuran `readTicketIdsRef`, `desktopRecentNotifEventsRef`, dan `brokenImageUrls` maksimal 100 entri menggunakan ring-buffer atau Set berkapasitas tetap.

---

### Fase 3: Industrial Resilience & Architecture Decoupling (Target: Jangka Menengah)
*Tujuan: Menjamin ketahanan jangka panjang dan kemudahan pemeliharaan.*

1. **Koordinator Sinkronisasi Saat Tab Aktif (*Tab Visibility Resync*):**
   - Saat pengguna kembali membuka tab Catavor setelah idle >5 menit, jalankan sinkronisasi data ringan (refresh token validity, periksa perubahan pesanan/tiket, segarkan data katalog aktif).
2. **Client-Side Telemetri & Crash Logging:**
   - Tambahkan error reporter ringan (local ring-buffer atau endpoint `/api/client-logs`) agar jika pengguna mengalami error di lapangan, stack trace dapat dianalisa secara akurat.
3. **Rencana Modularisasi `App.tsx`:**
   - Rencanakan pemisahan sub-modul besar dari `App.tsx`:
     - Modul Auth & Onboarding Portal (`PortalView.tsx`)
     - Modul Helpdesk & Tiket Support (`SupportDeskView.tsx`)
     - Modul Inventaris & Form CRUD (`InventoryAdminView.tsx`)

---

## 7. Actionable Task Checklist (Checklist Eksekusi Bertahap)

Berikut adalah daftar tugas terstruktur yang siap dieksekusi secara berurutan:

### Checklist Fase 1: Hotfix Stabilitas UI & Navigasi
- [x] **Task 1.1**: Buat komponen `frontend/mobile/src/components/ErrorBoundary.tsx` dan `frontend/desktop/src/components/ErrorBoundary.tsx`.
- [x] **Task 1.2**: Pasang `ErrorBoundary` di `main.tsx` dan sekeliling area `bottom-nav` / main view di kedua platform.
- [x] **Task 1.3**: Edit [frontend/mobile/src/App.tsx#L17529](file:///c:/MyProject/DFauna/frontend/mobile/src/App.tsx#L17529) — Hapus `!error` dari penentu `isBottomNavVisible` dan buat fallback error banner terisolasi.
- [x] **Task 1.4**: Buat helper fungsi reset atomik (`closeAllTransientOverlays()`) untuk me-reset menyeluruh seluruh ~11 flag modal/sub-view (`showLightbox`, `selectedFauna`, `isDetailActive`, `actionMenuData`, `showStoreSwitcherModal`, `showCreateStoreModal`, `isCreatingTicket`, `selectedTicket`, `selectedArticle`, `aboutSubView`, dll.) agar tidak ada flag tertinggal yang mematikan `isBottomNavVisible`.
- [x] **Task 1.5**: Perbaiki mekanisme `isPopStateRef` di mobile dan desktop — Hapus `setTimeout 150ms`; terapkan aturan kanonis: pisahkan handler `popstate` dari `useEffect` sinkronisasi URL dan pastikan sistem **TIDAK PERNAH memanggil `window.history.pushState()`** saat merespons event traversal `popstate`.
- [x] **Task 1.6**: Pasang `useModalBackHandler` pada 6 bottom sheet mobile yang belum terlindungi:
  - [x] `showCategorySheet`
  - [x] `showSortSheet`
  - [x] `showFilterSheet`
  - [x] `showAdminFilterSheet`
  - [x] `showProductTypeSelector`
  - [x] `reportModalData`

### Checklist Fase 2: Memory, Storage, & Stream Hardening
- [ ] **Task 2.1**: Audit dan tambahkan fungsi `return () => cleanup` pada ~41 `useEffect` di mobile dan ~39 di desktop.
- [x] **Task 2.2**: Update `apiClient.ts` di mobile dan desktop:
  - [x] Terapkan LRU eviction untuk `memoryCache` (maksimal 50 item).
  - [x] Terapkan limit maksimal 25 entri untuk `localStorage` prefix `catavor_swr_`.
  - [x] Tambahkan handler khusus penangkap `QuotaExceededError` dengan auto-purge cache sampah.
- [x] **Task 2.3**: Update `handleSmartFilterScroll` di mobile dan desktop menggunakan `requestAnimationFrame` throttle.
- [x] **Task 2.4**: Tambahkan exponential backoff reconnect pada listener SSE di `App.tsx` dan tangani error otentikasi.
- [x] **Task 2.5**: Pasang batas maksimal kapasitas (max size 100) pada `readTicketIdsRef`, `desktopRecentNotifEventsRef`, dan `brokenImageUrls`.

### Checklist Fase 3: Resilience & Monitoring
- [ ] **Task 3.1**: Implementasikan hook `useTabActiveResync` untuk menyegarkan data penting setelah tab kembali dari status idle/hidden >5 menit.
- [ ] **Task 3.2**: Buat telemetri penangkap error lokal di Error Boundary untuk mencatat crash log ke console/storage.
- [ ] **Task 3.3**: Rancang blueprint pemecahan modul `App.tsx` menjadi komponen halaman mandiri (*lazy loaded*).

---

## 8. Protokol Pengujian & Validasi Hasil

Setelah perbaikan diimplementasikan, jalankan skenario uji berikut untuk membuktikan ketahanan sistem:

1. **Uji Footer Resilience (Simulasi Error Katalog / Network Drop):**
   - Di tab Chrome/Browser Developer Tools > **Network**, gunakan fitur **Request Blocking** untuk memblokir endpoint katalog (misal `*/api/fauna*` atau `*/api/u/*/fauna`), atau ubah throttling ke **Offline** saat memuat halaman toko.
   - **Kriteria Lolos**: Konten error katalog tampil di area body, tetapi **Bottom Navigation Bar dan Header tetap utuh dan aktif di layar** (tidak lenyap).
2. **Uji Navigasi Bolak-Balik Cepat (PopState Trap Test):**
   - Buka produk $\rightarrow$ buka opsi pembelian $\rightarrow$ tekan tombol Back cepat 5 kali berturut-turut.
   - **Kriteria Lolos**: Pengguna mulus kembali ke katalog tanpa pernah "stuck" atau mental maju kembali ke halaman detail.
3. **Uji Sheet Android Back Interceptor:**
   - Buka sheet kategori $\rightarrow$ tekan tombol Back browser / gesture Android.
   - **Kriteria Lolos**: Sheet kategori menutup dengan halus, posisi halaman katalog tidak berpindah sama sekali.
4. **Uji Storage Quota Exceeded:**
   - Isi `localStorage` tiruan hingga 4.9 MB via script console, lalu lakukan penjelajahan katalog.
   - **Kriteria Lolos**: `apiClient.ts` secara otomatis membersihkan cache SWR lama, tidak melempar `QuotaExceededError`, dan token login tetap aman tersimpan.
5. **Uji Profiler Memori (Heap Snapshot):**
   - Rekam alokasi memori menggunakan Chrome DevTools > Memory Profiler selama 30 menit sesi aktif.
   - **Kriteria Lolos**: Tidak ada kenaikan bertahap yang curam (*staircase memory pattern*); memori kembali stabil setelah Garbage Collection berjalan.
