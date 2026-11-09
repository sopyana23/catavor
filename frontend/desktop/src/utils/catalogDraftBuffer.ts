/**
 * Scoped Multi-Type Draft Buffer
 * Standar Arsitektur Retensi Draf Multi-Format Katalog (Desktop, Tablet, Mobile)
 * 
 * Menjamin:
 * 1. Data kanonikal (nama, harga, deskripsi, foto, link) tetap utuh saat ganti tipe.
 * 2. Atribut dan sub-kategori spesifik masing-masing dari 7 tipe katalog terisolasi di memori.
 * 3. Restorasi sempurna saat bolak-balik tipe katalog (A -> B -> A).
 */

export type ItemCategoryType = 'physical' | 'digital' | 'fauna' | 'service' | 'food' | 'property' | 'plant';

export interface TypeSpecificDraft {
  class: string;
  shipping_coverage: string;
  conservation_status: string;
  customClass?: string;
  attributes: Record<string, any>;
}

export type MultiTypeDraftBuffer = Record<ItemCategoryType, TypeSpecificDraft>;

export const DEFAULT_TYPE_CATEGORIES: Record<ItemCategoryType, string> = {
  physical: 'Pakaian & Fashion',
  food: 'Makanan Utama (Main Course)',
  service: 'Perawatan & Grooming',
  digital: 'E-Book & PDF',
  fauna: 'Ikan Hias',
  plant: 'Tanaman Hias Daun',
  property: 'Rumah Tinggal (Landed House)'
};

export const DEFAULT_TYPE_SHIPPING: Record<ItemCategoryType, string> = {
  physical: 'Bisa Kirim se-Indonesia',
  food: 'Bisa Kirim se-Indonesia',
  digital: 'Kirim Otomatis via Email / Link Download',
  service: 'Datang ke Lokasi Klien / Toko',
  plant: 'Kirim Bersama Pot & Media Tanam',
  fauna: 'Ambil Sendiri di Toko (No Shipping)',
  property: 'Survei Lokasi Langsung (On-Site)'
};

export const DEFAULT_TYPE_STATUS: Record<ItemCategoryType, string> = {
  physical: 'Tersedia',
  food: 'Tersedia',
  digital: 'Tersedia',
  service: 'Tersedia',
  plant: 'Tersedia',
  fauna: 'Tersedia',
  property: 'Tersedia'
};

export function getDefaultAttributesForType(type: ItemCategoryType): Record<string, any> {
  switch (type) {
    case 'physical':
      return {
        condition: 'Baru',
        weight: 100,
        brand: '',
        variant: ''
      };
    case 'food':
      return {
        halal_status: 'Bersertifikat Halal Resmi (BPJPH / MUI)',
        portion_size: '',
        prep_time: '',
        storage_temp: 'Suhu Ruang',
        expired_info: ''
      };
    case 'digital':
      return {
        file_format: 'PDF',
        file_size: '10 MB',
        license_type: 'Lisensi Personal'
      };
    case 'service':
      return {
        duration: '1 Sesi / 1 Jam',
        service_location: 'Datang ke Toko',
        service_area: ''
      };
    case 'plant':
      return {
        sunlight: 'Partial Sun (Teduh Terang)',
        watering: 'Sedang (2-3 Hari Sekali)',
        planting_medium: 'Tanah Subur & Kompos',
        plant_size: 'Tinggi 25-35 cm',
        protection_status: 'Non-Dilindungi (Aman Diperjualbelikan)',
        delivery_condition: 'Kirim Bersama Pot & Media Tanam'
      };
    case 'fauna':
      return {
        habitat: 'General',
        diet: '',
        native_region: '',
        lifespan: '',
        weight: ''
      };
    case 'property':
      return {
        transaction_type: 'Dijual',
        certificate: 'SHM (Sertifikat Hak Milik)',
        land_area: '120',
        building_area: '90',
        bedrooms: 3,
        bathrooms: 2,
        floors: '2 Lantai',
        electricity: '2200 VA',
        water_source: 'PDAM & Sumur Bor',
        furnishing: 'Semi-Furnished',
        carport: '1 Mobil',
        facing: 'Timur',
        property_location: 'BSD City, Tangerang Selatan',
        facilities: 'One Gate System, Keamanan 24 Jam, Taman Bermain, Akses Jalan 2 Mobil'
      };
    default:
      return {};
  }
}

/**
 * Membuat buffer draf awal untuk ke-7 tipe katalog.
 * Jika initialType disediakan bersama data awal (misal saat mode Edit),
 * slot untuk initialType tersebut akan diisi dengan data awal yang ada.
 */
export function createInitialTypeDrafts(
  initialType: ItemCategoryType = 'physical',
  initialClass?: string,
  initialAttrs?: Record<string, any>,
  initialShippingCoverage?: string,
  initialConservationStatus?: string,
  initialCustomClass?: string
): MultiTypeDraftBuffer {
  const allTypes: ItemCategoryType[] = ['physical', 'food', 'digital', 'service', 'plant', 'fauna', 'property'];
  const buffer: Partial<MultiTypeDraftBuffer> = {};

  for (const t of allTypes) {
    const isInitial = t === initialType;
    const defaultAttrs = getDefaultAttributesForType(t);

    buffer[t] = {
      class: (isInitial && initialClass) ? initialClass : DEFAULT_TYPE_CATEGORIES[t],
      shipping_coverage: (isInitial && initialShippingCoverage) ? initialShippingCoverage : DEFAULT_TYPE_SHIPPING[t],
      conservation_status: (isInitial && initialConservationStatus) ? initialConservationStatus : DEFAULT_TYPE_STATUS[t],
      customClass: isInitial ? (initialCustomClass || '') : '',
      attributes: isInitial && initialAttrs ? { ...defaultAttrs, ...initialAttrs } : { ...defaultAttrs }
    };
  }

  return buffer as MultiTypeDraftBuffer;
}

/**
 * Menyimpan snapshot data form spesifik tipe saat ini ke dalam buffer.
 */
export function snapshotTypeDraft(
  currentType: ItemCategoryType,
  currentClass: string,
  currentCoverage: string,
  currentStatus: string,
  currentAttributes: Record<string, any>,
  currentCustomClass: string = '',
  existingBuffer?: MultiTypeDraftBuffer
): MultiTypeDraftBuffer {
  const baseBuffer = existingBuffer ? { ...existingBuffer } : createInitialTypeDrafts(currentType);

  baseBuffer[currentType] = {
    class: currentClass || DEFAULT_TYPE_CATEGORIES[currentType],
    shipping_coverage: currentCoverage || DEFAULT_TYPE_SHIPPING[currentType],
    conservation_status: currentStatus || DEFAULT_TYPE_STATUS[currentType],
    customClass: currentCustomClass,
    attributes: { ...(currentAttributes || {}) }
  };

  return baseBuffer;
}

/**
 * Mengambil draf tipe tujuan dari buffer.
 */
export function restoreTypeDraft(
  targetType: ItemCategoryType,
  buffer: MultiTypeDraftBuffer
): TypeSpecificDraft {
  if (buffer && buffer[targetType]) {
    return {
      class: buffer[targetType].class,
      shipping_coverage: buffer[targetType].shipping_coverage,
      conservation_status: buffer[targetType].conservation_status,
      customClass: buffer[targetType].customClass || '',
      attributes: { ...buffer[targetType].attributes }
    };
  }

  return {
    class: DEFAULT_TYPE_CATEGORIES[targetType],
    shipping_coverage: DEFAULT_TYPE_SHIPPING[targetType],
    conservation_status: DEFAULT_TYPE_STATUS[targetType],
    customClass: '',
    attributes: getDefaultAttributesForType(targetType)
  };
}

