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
Detail lengkap diatur pada [.agents/rules/database_and_clean_code_standards.md](file:///c:/MyProject/DFauna/.agents/rules/database_and_clean_code_standards.md):
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
Detail lengkap diatur pada [.agents/rules/premium_ui_and_anti_ai_standards.md](file:///c:/MyProject/DFauna/.agents/rules/premium_ui_and_anti_ai_standards.md):
1. **HARAM Menggunakan Emoji di Antarmuka Bisnis**:
   - Dilarang keras memakai karakter emoji (🚀, 🔥, ✨, 💡, 📦, dll.) di judul card, tombol aksi, atau status badge.
   - Wajib gunakan **Icon Library Vektor Profesional** (Lucide React / Heroicons / clean SVG) dengan stroke konsisten (1.5–1.75px) dan palet monokrom / neutral-muted.
2. **Anti-AI Slop & Gradien Murahan**:
   - Dilarang memakai gradien ungu-neon/cyan/magenta khas template AI generik, card glow berlebihan, atau sudut membulat ekstrem (*anti-bubble*).
3. **Standar Desain Enterprise & Elegan**:
   - Gunakan palet terkalibrasi (Slate, Zinc, Neutral gray, aksen brand tenang dan solid).
   - Tipografi terstruktur, spacing bernapas (*breathing room*), status badge bernuansa pastel halus, micro-interactions 150–200ms taktis, dan skeleton loading elegan.

