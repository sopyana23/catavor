package models

// ProductAttributeSchema adalah KONTRAK TUNGGAL (single source of truth) untuk
// atribut dinamis per tipe item. Frontend mobile & desktop wajib mengikuti peta
// ini; backend memakainya untuk memvalidasi dan menyaring payload.
//
// Aturan: allow-list eksplisit, TIDAK permissive. Key di luar daftar dibuang,
// sehingga dua klien tidak bisa lagi menyimpan medan yang hanya dikenal salah
// satu sisi (akar masalah data hilang saat edit lintas perangkat).
//
// Bila menambah medan: tambahkan di sini, lalu tambahkan di KEDUA frontend.
var ProductAttributeSchema = map[string][]string{
	"physical": {"brand", "material", "condition", "weight", "min_order", "max_order", "variant"},
	"food":     {"halal_status", "expired_info", "storage_temp", "variant", "min_order", "max_order", "portion_size", "prep_time", "delivery_condition"},
	"service":  {"duration", "service_area", "service_location", "min_order", "max_order"},
	"digital":  {"file_format", "file_size", "license_type", "min_order", "max_order", "delivery_condition"},
	"fauna":    {"habitat", "diet", "min_order", "max_order", "lifespan", "native_region", "delivery_condition"},
	"plant":    {"habitat", "diet", "sunlight", "watering", "light_requirement", "growing_media", "watering_frequency", "plant_legality", "plant_size", "planting_medium", "water_source", "protection_status", "delivery_condition", "min_order", "max_order"},
	"property": {"property_type", "transaction_type", "land_area", "building_area", "bedrooms", "bathrooms",
		"carport", "floors", "facing", "certificate", "furnishing", "electricity", "facilities",
		"property_location", "min_order", "max_order"},
}

// ValidProductType melaporkan apakah tipe item dikenal skema.
func ValidProductType(t string) bool {
	_, ok := ProductAttributeSchema[t]
	return ok
}

// FilterProductAttributes menyaring attributes agar hanya berisi key yang
// diizinkan untuk tipe tersebut. Tipe tak dikenal -> hasil kosong (fail closed).
// Mengembalikan peta baru; input tidak dimutasi.
func FilterProductAttributes(t string, in map[string]interface{}) map[string]interface{} {
	allowed, ok := ProductAttributeSchema[t]
	if !ok {
		return map[string]interface{}{}
	}
	out := make(map[string]interface{}, len(in))
	for _, k := range allowed {
		if v, exists := in[k]; exists {
			out[k] = v
		}
	}
	return out
}
