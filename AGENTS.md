# Catavor Platform Engineering Standards & Guidelines

This document defines the core architecture, navigation principles, and engineering standards for the Catavor platform (Desktop & Mobile). All agents and developers working on this codebase must adhere strictly to these rules.

---

## 1. Smart Back Navigation & History Stack Standard (MANDATORY)

### Rule: Never Hardcode Back Button Destinations
When implementing or modifying any view, page, sub-menu, or dialog that contains a **"Kembali" / "Back"** button or gesture navigation:
1. **Never hardcode static destinations** (e.g. DO NOT do `onClick={() => setActiveTab('overview')}` or `onClick={() => navigate('/admin')}`). Hardcoding breaks the user's actual navigation journey when coming from search, sub-tabs, or filtered views.
2. **Use the Smart Back Navigation pattern**:
   - Check if there is valid internal history (`window.history.length > 1` within the same origin).
   - If history exists, execute `window.history.back()`.
   - If the user reached the page directly (e.g. direct link, WhatsApp share, page reload), fall back to the **Semantic Parent**:
     - *Product Edit Form* $\rightarrow$ Product Management list (`/admin?tab=products`)
     - *Helpdesk Ticket Detail* $\rightarrow$ Helpdesk Ticket List (`/admin/help`)
     - *Store Settings Sub-tab* $\rightarrow$ Store Dashboard (`/admin`)
     - *Public Product Detail* $\rightarrow$ Storefront Catalog (`/:slug`)

---

## 2. Modal, Drawer, & Sheet Back Interceptor (MANDATORY)

### Rule: Back Action While a Modal is Open MUST Close the Modal
When any Modal, Bottom Sheet, Drawer, or Dialog is open (in Desktop or Mobile):
1. **Intercept Hardware, Browser, & Gesture Back**:
   - The user pressing the browser Back button, Android hardware Back button, or executing a mobile swipe-back gesture **MUST close the topmost open modal/drawer**.
   - It **MUST NOT** navigate away from the page or unmount the parent view.
2. **LIFO (Last-In, First-Out) for Nested Overlays**:
   - If Modal A opens Modal B (e.g., Product Form opens Image Picker):
     - 1st Back: closes Modal B (Image Picker).
     - 2nd Back: closes Modal A (Product Form).
     - 3rd Back: navigates back to previous page/tab.
3. **Clean Up on Direct Close**:
   - When a user closes the modal via the UI (e.g., clicking "✕", "Batal", or backdrop), the dummy history entry must be safely popped (`window.history.back()`) without triggering duplicate close callbacks or breaking the stack.
4. **Standard Utility**:
   - Use `useModalBackHandler` or `setupModalBackInterceptor` located in `src/utils/navigation.ts`.

---

## 3. URL State Synchronization for Tabs & Filters
- Tab switches in Admin Panel and Platform Role Portal should reflect in URL search params (e.g., `?tab=finance&sub=reports`).
- Use `window.history.pushState` on significant sub-view transitions so that native browser back returns to the prior view rather than exiting the admin interface.

---

## 4. Multi-Tenant & Safe Storage Deletion Standards
- Merchant media files are isolated under `public/storage/stores/<storeID>/`.
- Deleting an entity or removing photos must hard-delete physical files from disk (`os.Remove` of file and `.fiber.gz`) if not referenced by other active records.
- `storage_used_bytes` must be recalculated or synchronized immediately upon file addition/deletion.

---

## 5. Database Architecture, Normalization & Clean Code Standards (MANDATORY)
Detail lengkap diatur pada [.agents/rules/02_database_architecture.md](file:///c:/MyProject/DFauna/.agents/rules/02_database_architecture.md) dan [.agents/rules/03_clean_code_and_architecture.md](file:///c:/MyProject/DFauna/.agents/rules/03_clean_code_and_architecture.md):
1. **Audit Normalisasi (1NF, 2NF, 3NF)**:
   - Nilai atomik (1NF), eliminasi dependensi parsial (2NF) dan dependensi transitif (3NF).
   - **Controlled Denormalization**: Pada entitas transaksi (orders, invoices, ledger), simpan snapshot harga & nama item saat transaksi agar tidak terpengaruh perubahan master data.
2. **Integritas Relasional & Constraints**:
   - Foreign Keys wajib terindeks, NOT NULL dengan default terukur, Unique Constraint di level database (bukan sekadar `if exists` di aplikasi).
   - Tipe data uang/finansial dilarang `FLOAT`/`DOUBLE` (wajib integer terkecil atau decimal presisi), timestamp wajib format UTC di database.
3. **Clean Code & Modularitas**:
   - Terapkan *Single Responsibility Principle* (fungsi ringkas & terisolasi).
   - Penamaan semantik yang mencerminkan domain bisnis.
   - Bersihkan *dead code* (dilarang meninggalkan baris kode usang di-comment out).

---

## 6. Premium UI, Anti-AI Aesthetics & Iconography Standards (MANDATORY)
Detail lengkap diatur pada [.agents/rules/04_ui_ux_and_device_standards.md](file:///c:/MyProject/DFauna/.agents/rules/04_ui_ux_and_device_standards.md):
1. **HARAM Menggunakan Emoji di Antarmuka Bisnis**:
   - Dilarang keras memakai karakter emoji (🚀, 🔥, ✨, 💡, 📦, dll.) di judul card, tombol aksi, atau status badge.
   - Wajib gunakan **Icon Library Vektor Profesional** (Lucide React / Heroicons / clean SVG) dengan stroke konsisten (1.5–1.75px) dan palet monokrom / neutral-muted.
2. **Anti-AI Slop & Gradien Murahan**:
   - Dilarang memakai gradien ungu-neon/cyan/magenta khas template AI generik, card glow berlebihan, atau sudut membulat ekstrem (*anti-bubble*).
3. **Standar Desain Enterprise & Elegan**:
   - Gunakan palet terkalibrasi (Slate, Zinc, Neutral gray, aksen brand tenang dan solid).
   - Tipografi terstruktur, spacing bernapas (*breathing room*), status badge bernuansa pastel halus, micro-interactions 150–200ms taktis, dan skeleton loading elegan.


---

## 7. Tri-Frontend Architecture & Form-Factor Native Parity (MANDATORY)
Platform Catavor dibangun dengan arsitektur **Tiga Frontend Mandiri** yang masing-masing memiliki direktori terisolasi di bawah `frontend/`:
1. [frontend/desktop](file:///c:/MyProject/DFauna/frontend/desktop) $\rightarrow$ Antarmuka **Desktop Native** (Breakpoint $\ge$ 1024px, output `public/desktop`).
2. [frontend/tablet](file:///c:/MyProject/DFauna/frontend/tablet) $\rightarrow$ Antarmuka **Tablet Native** (Breakpoint 768px – 1023px, output `public/tablet`).
3. [frontend/mobile](file:///c:/MyProject/DFauna/frontend/mobile) $\rightarrow$ Antarmuka **Mobile Native** (Breakpoint < 768px, output `public/mobile`).

### A. Prinsip Identitas Visual & Ergonomi Khas Masing-Masing Form-Factor
Masing-masing codebase wajib memiliki filosofi tampilan dan ergonomi yang mewakili karakternya sendiri, **bukan sekadar styling responsif hasil ciutan layar**:
1. **Desktop Native (Breakpoint $\ge$ 1024px)**:
   - **Haram Stretched Mobile**: Dilarang melebarkan form/tombol 1 kolom ke layar lebar (>600px).
   - Manfaatkan multi-kolom grid, Executive Sidebar (260-280px) + Top Command Bar, dan **Comprehensive Data Table** (sorting kolom, bulk batch actions, filter inline).
   - Dialog overlay berupa **Centered Modal Box** proporsional dengan tombol aksi di kanan bawah.
2. **Tablet Native (Breakpoint 768px – 1023px)**:
   - Didesain khusus untuk interaksi sentuh + stylus / keyboard folio (rasio 4:3 / 16:10).
   - Navigasi menggunakan **Adaptive Icon-Rail (70–80px)** atau collapsible drawer ramah jangkauan jempol di tepi layar (*Thumb Resting Zone*).
   - Mengutamakan pola **Master-Detail Split View** (daftar ringkas di kiri 35–40%, panel inspeksi detail di kanan 60–65%) agar pengelola tidak bolak-balik modal/halaman.
   - Dialog overlay menggunakan **Side Sheet** yang meluncur dari kanan atau Centered Medium Panel.
3. **Mobile Native (Breakpoint < 768px)**:
   - Ergonomi sentuh satu tangan (single-hand portrait, touch target minimal 44x44px).
   - Layout **Single-Column Vertical Flow**, data kompleks disajikan dalam format **Card List** rapi.
   - Dialog overlay wajib menggunakan **Bottom Sheet** yang meluncur dari dasar layar, aksi utama diakses via *Sticky Bottom Action Bar*.

### B. Single Source of Truth & Database Consistency (MANDATORY)
- **Tabel & API yang Sama**: Seluruh transaksi, operasi data, pembacaan, dan penulisan dari ketiga device **wajib menggunakan endpoint API Go yang sama dan tersimpan ke tabel PostgreSQL yang sama**. Tidak boleh ada skema database terpisah antar-device.
- **Mobile sebagai Acuan Mutlak (*Golden Reference*)**: Fitur-fitur, alur logika, permission, dan validasi yang ada di versi mobile menjadi acuan mutlak.
- **Larangan Menyenggol Kode Mobile (*Mobile Codebase Freeze*)**: Saat mengembangkan atau memutakhirkan tampilan desktop atau tablet, agen **DILARANG KERAS MENGUBAH ATAU MENYENGGOL CODEBASE `frontend/mobile`** yang sudah stabil dan sesuai, kecuali jika pengguna secara eksplisit meminta perbaikan khusus mobile.

### C. Server-Side Data Presentation & Form-Factor Specific Pagination Standard
Seluruh penampilan data daftar (katalog, transaksi, tiket, audit log, pengguna) wajib menggunakan mekanisme **Server-Side Data Fetching** yang efisien, dengan gaya paginasi khas yang disesuaikan dengan ergonomi masing-masing device:
1. **Desktop Native Pagination**:
   - **Enterprise Comprehensive Data Table Pagination Bar**:
     - Dropdown baris per halaman: `10`, `25`, `50`, `100` entri.
     - Ringkasan data aktual: *"Menampilkan X – Y dari Z data"*.
     - Tombol navigasi nomor halaman bernomor (`[1] [2] [3] ... [N]`), tombol `Awal`, `Sebelumnya`, `Selanjutnya`, `Akhir`.
     - Input langsung lompat ke halaman (*Quick Jump to Page*).
2. **Tablet Native Pagination**:
   - **Touch-Segmented Page Bar & Master-Detail Floating Pager**:
     - Menggunakan tombol segmented pill yang ramah sentuhan (touch target $\ge$ 44px) di bagian bawah panel Master List (`< Hal 1/8 >` atau touch-friendly pager pills).
     - Saat berada di mode Master-Detail Split View, navigasi paginasi hanya memperbarui panel daftar item di kiri tanpa melakukan reload total pada panel detail di kanan (*isolated pane pagination*).
     - Quick page jumper drawer untuk berpindah halaman secara cepat.
3. **Mobile Native Pagination**:
   - **Vertical Flow Paging (Infinite Scroll / Load More / Compact Bar)**:
     - Menggunakan "Muat Lebih Banyak" (*Load More Button*) dengan progress counter, atau infinite scroll dengan skeleton loader halus, atau Compact 1-Line Prev-Next Bar di area bawah layar untuk menghemat ruang vertikal layar sempit.

### D. Mandat Verifikasi Tiga Kompilasi (*Tri-Build Verification*)
Agen **DILARANG MENGKLAIM SELESAI** jika fitur baru tidak diverifikasi di ketiga codebase. Sebelum menyatakan tugas tuntas, jalankan pengujian build:
- `npm run build` pada [frontend/desktop](file:///c:/MyProject/DFauna/frontend/desktop) $\rightarrow$ Wajib 0 error.
- `npm run build` pada [frontend/tablet](file:///c:/MyProject/DFauna/frontend/tablet) $\rightarrow$ Wajib 0 error.
- `npm run build` pada [frontend/mobile](file:///c:/MyProject/DFauna/frontend/mobile) $\rightarrow$ Wajib 0 error.

---

## 8. Anti-Looping & 2-Strike Circuit-Breaker Standard (MANDATORY)
Detail lengkap diatur pada [.agents/rules/01_agent_operational_guardrails.md](file:///c:/MyProject/DFauna/.agents/rules/01_agent_operational_guardrails.md):
1. **Pemutus Arus Maksimal 2x Percobaan**:
   - Jika perbaikan terhadap suatu bug/fitur gagal 2 kali berturut-turut: **HARD STOP**. Agen dilarang menulis percobaan ke-3 secara membabi-buta.
2. **Larangan Ping-Pong Debugging**:
   - Dilarang keras mengulang atau menyajikan kembali pendekatan yang pernah gagal/ditolak (A $\rightarrow$ B $\rightarrow$ A).
3. **Kejujuran Intelektual & Diagnosis Faktual**:
   - Agen wajib jujur mengakui titik buntu atau keterbatasan bukti, memaparkan fakta log riil, dan meminta konfirmasi via `ask_question` sebelum melanjutkan alih-alih menebak kode.

---

## 9. Senior Engineer Critical Mindset & Zero-Sycophancy Standard (MANDATORY)
Detail lengkap diatur pada [.agents/rules/01_agent_operational_guardrails.md](file:///c:/MyProject/DFauna/.agents/rules/01_agent_operational_guardrails.md):
1. **Zero-Sycophancy (Haram Menjilat / Asal Setuju)**:
   - Agen dilarang keras bersikap "Yes-Man" atau memuji ide/kode yang keliru hanya untuk menyenangkan pengguna. Jika suatu usulan memiliki risiko arsitektur, celah keamanan, atau *technical debt*, agen **wajib tegas dan lugas** menyatakan kekeliruan tersebut beserta argumen teknis faktual.
2. **Pra-Eksekusi Kritis (*Architectural Scrutiny*)**:
   - Dilarang reaktif langsung menulis kode. Berpikir terlebih dahulu layaknya *Senior/Staff Software Engineer* (telaah *blast radius*, skalabilitas data, maintainability, dan skenario *edge-cases*).
3. **Konsultatif Multi-Opsi & Trade-offs**:
   - Sajikan perbandingan opsi profesional (*Opsi Asli vs Rekomendasi Senior vs Jalan Tengah*) jika ada pendekatan standar industri yang lebih baik sebelum eksekusi.
4. **Disagree and Commit yang Sehat**:
   - Jika pengguna tetap memilih pendekatannya setelah dipaparkan risikonya, agen mematuhi keputusan tersebut (*commit*) sambil memasang jaring pengaman defensif (*defensive coding*) terbaik.

---

## 10. Defensive Engineering, Resilience & Fault Tolerance Standards (MANDATORY)
Detail lengkap diatur pada [.agents/rules/03_clean_code_and_architecture.md](file:///c:/MyProject/DFauna/.agents/rules/03_clean_code_and_architecture.md):
1. **Multi-Layer Rollback**:
   - Database: Seluruh operasi multi-tabel wajib dalam transaksi atomik dengan defer rollback.
   - Storage Fisik: Kegagalan simpan database setelah upload file wajib otomatis menghapus berkas fisik di disk (`os.Remove`).
   - Frontend: Optimistic UI update wajib memiliki mekanisme rollback state otomatis jika request API gagal.
2. **Graceful Degradation (Anti White Screen of Death)**:
   - Frontend wajib membungkus modul/tab dengan `ErrorBoundary` agar kegagalan sub-komponen tidak membuat seluruh halaman menjadi layar putih kosong.
   - Backend wajib membungkus background task/goroutine dengan `defer recover()` agar tidak mematikan server secara fatal.
3. **Structured Observability**:
   - Dilarang keras meninggalkan `fmt.Println` di Go atau `console.log` acak di frontend produksi.
   - Wajib gunakan structured logger dengan level semantik (`INFO`, `WARN`, `ERROR`) dan context terukur (`store_id`, `user_id`, `action`, `error`).
4. **Idempotensi & Concurrency Safety**:
   - Tombol submit/bayar wajib otomatis disable saat loading (`isSubmitting`), debounced, dan dikunci secara unik di backend untuk mencegah transaksi/pesanan duplikat.





