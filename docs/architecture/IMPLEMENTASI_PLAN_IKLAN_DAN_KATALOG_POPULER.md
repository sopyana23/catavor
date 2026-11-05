# RENCANA IMPLEMENTASI LENGKAP: FITUR PENEMPATAN IKLAN (SPONSORED PLACEMENTS) & SHOWCASE KATALOG POPULER PADA PLATFORM CATAVOR

**Tipe Dokumen**: Rencana Rekayasa Perangkat Lunak & Cetak Biru Eksekusi (*Implementation Plan*)  
**Platform**: Catavor Enterprise Multi-Tenant SaaS (Go 1.23+ & PostgreSQL 17, React 19 Tri-Frontend)  
**Status**: Siap Eksekusi Bertahap (*Phased Execution Ready*)  

---

## 1. IKHTISAR PROYEK & TUJUAN ARSITEKTUR

### 1.1. Tujuan Utama
Membangun modul **Penempatan Iklan Bersponsor (*Paid Sponsored Placements*)** dan **Showcase Katalog Populer Berbasis Aktivitas Pengunjung (*Organic 7-Day Velocity Trending*)** di halaman depan (*Landing Page / Public Portal*) Catavor, dengan karakteristik:
1. **Fleksibilitas Objek Iklan**: Merchant dapat memilih secara independen untuk mempromosikan **Hanya Profil Toko (Katalog Toko)** atau **Hanya Item Produk Tertentu**.
2. **Rotasi Iklan yang Adil & Dinamis**: Menerapkan algoritma *Weighted Time-Sliced Round-Robin with Session Seed* (anti-monopoli, variatif bagi pengunjung, dan terdistribusi adil sesuai masa sewa).
3. **Penyajian Data Berbasis 7 Sektor Spesialisasi Usaha**: Tampilan etalase ala *online shop / marketplace* modern dengan segmentasi ketat (`food`, `physical`, `fauna`, `plant`, `service`, `digital`, `property`).
4. **Pencegahan Masalah *The Rich Get Richer***: Menggunakan metrik *Rolling 7-Day Window* dari tabel harian eksisting (`product_daily_analytics`) agar produk baru yang sedang viral dapat langsung naik ke jajaran trending.
5. **Pertahanan Keamanan Multi-Layer**: Proteksi terhadap *click fraud*, manipulasi skor tren, *IDOR*, *payment tampering*, dan *ad cloaking (bait-and-switch)*.
6. **Tri-Frontend Parity**: Tersedia mulus di Desktop, Tablet, dan Mobile dengan filosofi ergonomi masing-masing tanpa merusak stabilitas kode yang sudah ada.

---

## 2. RENCANA KERJA BERTAHAP (PHASED WORK BREAKDOWN)

```mermaid
flowchart TD
    subgraph FASE 1: Database & Model
        M1["1.1 Buat Skema SQL Migration (DDL)<br>ad_slots, ad_campaigns, ad_orders, ad_daily_metrics"]
        M2["1.2 Tambah Kolom Materialized<br>products.trending_score_7d & stores.trending_score_7d"]
        M3["1.3 Definisikan Struct GORM Go<br>backend/internal/models/ad_placement.go"]
    end

    subgraph FASE 2: Backend Core Services
        S1["2.1 Ad Rotator Engine (Weighted Time-Slice)"]
        S2["2.2 In-Memory / Redis Telemetry Buffer"]
        S3["2.3 Background Aggregator (7-Day Rolling Velocity)"]
        S4["2.4 Auto-Freeze Hook di Product Update"]
    end

    subgraph FASE 3: REST API & Security Guardrails
        A1["3.1 Public Showcase & Click Redirect APIs"]
        A2["3.2 Merchant Ad Campaign Management APIs"]
        A3["3.3 Admin Moderation & Payment Verification APIs"]
        A4["3.4 HMAC Token & Anti-Click Fraud Middleware"]
    end

    subgraph FASE 4: Tri-Frontend Implementation
        UI1["4.1 Desktop Landing Page Showcase & Merchant Ad Hub"]
        UI2["4.2 Tablet Master-Detail Ad Manager & Touch Showcase"]
        UI3["4.3 Mobile Slide-Up Bottom Sheet & Compact Flow"]
    end

    subgraph FASE 5: QA & Verification
        T1["5.1 Unit Test & Benchmark Go"]
        T2["5.2 Tri-Build Verification (0 Error)"]
        T3["5.3 Penetration Testing (Click Fraud & IDOR)"]
    end

    FASE 1 --> FASE 2 --> FASE 3 --> FASE 4 --> FASE 5
```

---

## 3. DETAIL FASE 1: DATABASE ARCHITECTURE & GORM MODELS

### 3.1. Berkas Migrasi SQL Non-Destruktif
Ditempatkan pada `backend/internal/database/migrations/20261105_n58_create_advertising_and_trending_tables.sql`:

```sql
-- 1. Master Penempatan Slot Iklan
CREATE TABLE IF NOT EXISTS ad_slots (
    id BIGSERIAL PRIMARY KEY,
    slot_code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_entity VARCHAR(50) NOT NULL DEFAULT 'store', -- 'store' | 'product' | 'mixed'
    allowed_product_types VARCHAR(255) NOT NULL DEFAULT 'all',
    max_items_displayed INT NOT NULL DEFAULT 4,
    pricing_model VARCHAR(50) NOT NULL DEFAULT 'flat_daily', -- 'flat_daily' | 'cpm' | 'cpc'
    default_rate_per_day DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    min_duration_days INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Kampanye Iklan Merchant (Dengan Enforced Dual Foreign Keys)
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id BIGSERIAL PRIMARY KEY,
    campaign_code VARCHAR(100) NOT NULL UNIQUE,
    store_id BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    ad_slot_id BIGINT NOT NULL REFERENCES ad_slots(id) ON DELETE RESTRICT,
    target_type VARCHAR(50) NOT NULL DEFAULT 'store', -- 'store' | 'product'
    target_store_id BIGINT REFERENCES stores(id) ON DELETE CASCADE,
    target_product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
    target_id BIGINT NOT NULL,
    campaign_name VARCHAR(255) NOT NULL,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending_payment',
    pricing_model VARCHAR(50) NOT NULL DEFAULT 'flat_daily',
    budget_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    spent_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    priority_weight INT NOT NULL DEFAULT 10,
    daily_impression_cap INT NOT NULL DEFAULT 0,
    target_product_type VARCHAR(50) NOT NULL DEFAULT 'all',
    target_city VARCHAR(100) DEFAULT NULL,
    custom_badge_text VARCHAR(50) DEFAULT 'Disponsori',
    rejection_reason TEXT DEFAULT NULL,
    approved_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    CONSTRAINT chk_ad_campaigns_dates CHECK (end_at > start_at),
    CONSTRAINT chk_ad_campaigns_target_integrity CHECK (
        (target_type = 'store' AND target_store_id IS NOT NULL AND target_product_id IS NULL) OR
        (target_type = 'product' AND target_product_id IS NOT NULL)
    )
);

-- Indeks komposit vital untuk performa rotasi iklan (SARGable query)
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_active_rotation 
ON ad_campaigns (ad_slot_id, status, start_at, end_at, priority_weight) 
WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_store ON ad_campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_target_store ON ad_campaigns(target_store_id) WHERE target_store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_target_prod ON ad_campaigns(target_product_id) WHERE target_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_prod_type ON ad_campaigns(target_product_type);

-- 3. Transaksi Faktur Pembayaran Sewa Iklan (Controlled Denormalization)
CREATE TABLE IF NOT EXISTS ad_orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(100) NOT NULL UNIQUE,
    campaign_id BIGINT NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    store_id BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    slot_name_snapshot VARCHAR(255) NOT NULL,
    pricing_model_snapshot VARCHAR(50) NOT NULL,
    duration_days INT NOT NULL DEFAULT 1,
    original_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    final_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    coupon_code VARCHAR(100) DEFAULT NULL,
    unique_code INT NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    sender_account_name VARCHAR(150) DEFAULT NULL,
    sender_bank_name VARCHAR(100) DEFAULT NULL,
    payment_proof_url TEXT DEFAULT NULL,
    gateway_provider VARCHAR(50) DEFAULT NULL,
    gateway_reference VARCHAR(150) DEFAULT NULL,
    gateway_payment_link TEXT DEFAULT NULL,
    gateway_raw_response JSONB DEFAULT NULL,
    rejection_reason TEXT DEFAULT NULL,
    approved_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ad_orders_campaign ON ad_orders(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_orders_store ON ad_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_ad_orders_status ON ad_orders(payment_status);

-- 4. Agregasi Harian Metrik Iklan
CREATE TABLE IF NOT EXISTS ad_daily_metrics (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    ad_slot_id BIGINT NOT NULL REFERENCES ad_slots(id) ON DELETE CASCADE,
    store_id BIGINT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    date VARCHAR(10) NOT NULL,
    impressions_count BIGINT NOT NULL DEFAULT 0,
    clicks_count BIGINT NOT NULL DEFAULT 0,
    wa_clicks_count BIGINT NOT NULL DEFAULT 0,
    cost_incurred DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    ctr_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ad_daily_metrics_camp_date UNIQUE (campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ad_daily_metrics_store_date ON ad_daily_metrics(store_id, date);

-- 5. Penambahan Kolom Rolling 7-Day Velocity pada Tabel Master
ALTER TABLE products ADD COLUMN IF NOT EXISTS trending_score_7d BIGINT DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_products_trending_7d ON products(trending_score_7d DESC) WHERE is_active = true;

ALTER TABLE stores ADD COLUMN IF NOT EXISTS trending_score_7d BIGINT DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_stores_trending_7d ON stores(trending_score_7d DESC) WHERE is_blacklisted = false;
```

### 3.2. Go Struct Models
Ditempatkan pada `backend/internal/models/ad_placement.go` dengan pemetaan field GORM yang presisi, tag JSON semantik, dan method pembantu (*helper methods*).

---

## 4. DETAIL FASE 2 & 3: BACKEND SERVICES, APIs & SECURITY GUARDRAILS

### 4.1. Modul Service Backend Baru
1. **`internal/services/ad_rotator_service.go`**:
   - Menjalankan algoritma *Weighted Time-Sliced Shuffling*.
   - Menerima parameter `(slotCode, productType, limit, sessionID)`.
   - Melakukan de-duplikasi toko agar 1 toko tidak muncul dobel di satu tampilan layar.
2. **`internal/services/ad_telemetry_service.go`**:
   - Menerapkan in-memory ring-buffer / Redis counter untuk impresi iklan.
   - Background goroutine berjalan setiap 60 detik untuk melakukan *batch upsert* ke `ad_daily_metrics`.
3. **`internal/services/trending_calculator_service.go`**:
   - Background worker berjalan setiap 2 jam.
   - Menghitung formula skor 7 hari ke belakang dari `product_daily_analytics` dan `store_daily_analytics`:
     $$\text{TrendingScore}_{7D} = \sum (\text{Views} \times 1 + \text{WaClicks} \times 5 + \text{RekberClicks} \times 10)$$
   - Memperbarui kolom `products.trending_score_7d` dan `stores.trending_score_7d`.
4. **Hook Keamanan di `ProductHandler.Update`**:
   - Jika `product.id` sedang berstatus aktif di `ad_campaigns` dan ada modifikasi pada `name`, `image_url`, atau `price`:
     - Otomatis ubah status kampanye menjadi `in_review`.
     - Iklan langsung diturunkan dari beranda untuk mencegah modus *Bait-and-Switch*.

### 4.2. Spesifikasi Endpoint RESTful Baru

```
+----------------------------------------------------+--------+------------------------------------------+
| ENDPOINT                                           | METHOD | OTORISASI & FUNGSI                       |
+----------------------------------------------------+--------+------------------------------------------+
| /api/public/showcase/featured                      | GET    | Publik: Mengambil kombinasi profil toko  |
|                                                    |        | bersponsor & toko trending 7 hari.       |
+----------------------------------------------------+--------+------------------------------------------+
| /api/public/showcase/by-sector/:product_type       | GET    | Publik: Mengambil produk bersponsor &    |
|                                                    |        | terpopuler untuk sektor spesifik (1-7).  |
+----------------------------------------------------+--------+------------------------------------------+
| /api/public/ads/click                              | GET    | Publik: Redirect aman via token HMAC 60s |
|                                                    |        | dengan validasi anti-click-fraud.        |
+----------------------------------------------------+--------+------------------------------------------+
| /api/merchant/ads/slots                            | GET    | Merchant: Melihat daftar slot & tarif.   |
+----------------------------------------------------+--------+------------------------------------------+
| /api/merchant/ads/campaigns                        | GET    | Merchant: Riwayat kampanye iklan toko.   |
+----------------------------------------------------+--------+------------------------------------------+
| /api/merchant/ads/campaigns                        | POST   | Merchant: Membuat pengajuan sewa iklan   |
|                                                    |        | (pilih hanya item ATAU hanya profil).    |
+----------------------------------------------------+--------+------------------------------------------+
| /api/merchant/ads/orders/:order_id/proof           | POST   | Merchant: Unggah bukti transfer sewa.    |
+----------------------------------------------------+--------+------------------------------------------+
| /api/ops/ads/campaigns/pending                     | GET    | Admin Platform: Daftar antrean approval. |
+----------------------------------------------------+--------+------------------------------------------+
| /api/ops/ads/orders/:order_id/verify               | POST   | Admin Platform: Verifikasi bukti bayar   |
|                                                    |        | (Row Lock SELECT FOR UPDATE) & aktifkan. |
+----------------------------------------------------+--------+------------------------------------------+
```

---

## 5. DETAIL FASE 4: TRI-FRONTEND PARITY IMPLEMENTATION

Mengikuti mandat [.agents/rules/05_device_form_factor_standards.md](file:///c:/MyProject/DFauna/.agents/rules/05_device_form_factor_standards.md) dan estetika anti-AI [.agents/rules/04_ui_ux_and_anti_ai_standards.md](file:///c:/MyProject/DFauna/.agents/rules/04_ui_ux_and_anti_ai_standards.md):

### 5.1. Desktop Native (`frontend/desktop`) - Layar Lebar >= 1024px
1. **Showcase Beranda (Public Portal)**:
   - Kontainer lapang (`max-w-7xl` auto-margin, anti-runaway).
   - **Section 1 (Profil Toko)**: 4 kartu profil toko berdampingan (*Store Cards* bernuansa slate/kaca elegan) dengan badge vektor `Sparkles` "Pilihan Sponsor" dan "Populer Minggu Ini".
   - **Section 2 (Flash Spotlight Item)**: 4-kolom kartu produk terlaris dengan foto 1:1 tajam, harga Rupiah terformat rapi, dan tombol CTA WhatsApp.
   - **Section 3 (Etalase 7 Sektor Spesifik)**: Interactive Horizontal Tab Pills untuk berganti antara Kuliner, Barang Fisik, Fauna, Flora, Jasa, Digital, dan Properti tanpa reload total.
2. **Dashboard Merchant**:
   - Sub-tab baru pada menu Pemasaran: *"Promosi & Iklan Beranda"*.
   - Formulir terstruktur dengan radio toggle tegas:  
     `[ ○ Promosikan Profil Toko ]   [ ● Promosikan 1 Item Produk Spesifik ]`
   - Ringkasan tarif harian otomatis, pemilih durasi (1–30 hari), dan kalkulator total biaya.

### 5.2. Tablet Native (`frontend/tablet`) - Layar 768px – 1023px
1. **Showcase Beranda**:
   - Tablet Mini (768px–879px): Segmented Switcher ramah jempol untuk berpindah sektor tanpa scroll horizontal meluber.
   - Tablet Lebar (880px–1023px): Grid 2–3 kolom proporsional.
2. **Dashboard Merchant**:
   - Pola *Master-Detail Split View* (Daftar kampanye aktif di kiri 35%, panel statistik performa impresi/klik di kanan 65%). Touch target minimal 44x44px.

### 5.3. Mobile Native (`frontend/mobile`) - Layar Sempit < 768px
1. **Showcase Beranda**:
   - Single-Column / Compact 2-Column Vertical Card List.
   - Horizontal scrollable pills untuk 7 sektor usaha dengan snap gesture alami.
   - Tombol CTA pesan WhatsApp pada kartu berukuran ramah jempol.
2. **Dashboard Merchant & Pengajuan Iklan**:
   - Formulir pengajuan iklan menggunakan **Slide-Up Bottom Sheet** khas Catavor:
     * Fisika drag Apple-style (`transition: none` saat dragging aktif, `0.28s cubic-bezier(0.16, 1, 0.3, 1)` saat dilepas).
     * Bersih tanpa tombol 'X' di header (penutupan via drag-down atau backdrop tap).
     * Touch targets >= 44px, pilihan opsi disajikan dalam touch pills dengan centang `Check`.

---

## 6. DETAIL FASE 5: QA, PENTESTING & VERIFIKASI TRIPLE BUILD

Sebelum menyatakan pekerjaan tuntas:
1. **Pengujian Unit & Concurrency di Go**:
   - Uji algoritma rotasi: Menjalankan 1.000 iterasi rotasi dengan 5 kampanye aktif untuk membuktikan distribusi kemunculan merata (varians < 10%).
   - Uji race-condition pembayaran: Simulasi 10 request verifikasi serentak (`goroutine`) pada invoice yang sama, memastikan hanya 1 yang berhasil dieksekusi (*zero double-credit*).
2. **Pengujian Celah Keamanan (Pentesting Check)**:
   - *IDOR Check*: Mengirim request pembuatan iklan dengan `target_product_id` milik toko lain; sistem wajib mengembalikan status `403 Forbidden`.
   - *Click Fraud Check*: Mengirim 50 klik dalam 10 detik dari IP yang sama; hanya 1 klik yang dicatat sebagai biaya.
   - *Bait-and-Switch Check*: Mengedit produk yang sedang aktif beriklan; sistem wajib otomatis menurunkan iklan dari beranda.
3. **Mandat Verifikasi Tiga Kompilasi (Tri-Build Verification)**:
   - `npm run build` pada `frontend/desktop` $\rightarrow$ Wajib 0 error.
   - `npm run build` pada `frontend/tablet` $\rightarrow$ Wajib 0 error.
   - `npm run build` pada `frontend/mobile` $\rightarrow$ Wajib 0 error.
   - `go build` pada `backend` $\rightarrow$ Wajib 0 error.

---

## 7. RENCANA ROLLBACK & MANAJEMEN RISIKO (DEFENSIVE RESILIENCE)

1. **Feature Flagging**:
   - Backend dilengkapi environment flag: `FEATURE_AD_SYSTEM=false`.
   - Jika flag bernilai `false`, endpoint beranda otomatis beralih 100% ke mode katalog organik murni yang sudah ada tanpa memicu eror.
2. **Database Backward-Compatibility**:
   - Seluruh tabel baru terisolasi mandiri.
   - Penambahan kolom `trending_score_7d` bersifat *nullable/default 0*, sehingga tidak memengaruhi query database yang sudah berjalan.
3. **Script Rollback Darurat**:
   File `backend/internal/database/migrations/20261105_rollback_advertising_tables.sql` disiapkan untuk mencopot skema jika diperlukan pembatalan total.

---

## JADWAL & ESTIMASI MILESTONE

| Tahap | Aktivitas Utama | Output Konkret |
| :--- | :--- | :--- |
| **Milestone 1** | Migrasi Skema DDL & Go Struct Models | File migration `.sql` & model `ad_placement.go` |
| **Milestone 2** | Service Rotator, Ingest Telemetri & Rolling Worker | Engine rotasi berbobot & background flusher |
| **Milestone 3** | REST APIs (Public Showcase, Merchant & Ops) | 9 endpoint API lengkap dengan otorisasi JWT & IDOR guard |
| **Milestone 4** | Implementasi Frontend Desktop, Tablet & Mobile | UI Beranda etalase online shop + Merchant Ad Hub |
| **Milestone 5** | QA, Pentesting, Tri-Build Verification & Deploy | 3 build sukses, 0 error, verifikasi HTTP 200 OK |

