package models

import "testing"

// TestProductAttributeSchemaCoverage memastikan setiap key yang dikirim frontend
// untuk sebuah tipe diizinkan skema. Bila frontend menambah medan baru tanpa
// memperbarui kontrak, key itu akan diam-diam dibuang di sini -> test gagal.
func TestProductAttributeSchemaCoverage(t *testing.T) {
	// Key yang benar-benar dipakai frontend mobile (acuan) per tipe.
	frontend := map[string][]string{
		"physical": {"brand", "material", "condition", "weight", "min_order", "max_order", "variant"},
		"food":     {"halal_status", "expired_info", "storage_temp", "variant", "min_order", "max_order", "portion_size", "prep_time", "delivery_condition"},
		"service":  {"duration", "service_area", "service_location", "min_order", "max_order"},
		"digital":  {"file_format", "file_size", "license_type", "min_order", "max_order", "delivery_condition"},
		"fauna":    {"habitat", "diet", "min_order", "max_order", "lifespan", "native_region", "delivery_condition"},
		"plant": {"habitat", "diet", "sunlight", "watering", "light_requirement", "growing_media",
			"watering_frequency", "plant_legality", "plant_size", "planting_medium", "water_source",
			"protection_status", "delivery_condition", "min_order", "max_order"},
		"property": {"property_type", "transaction_type", "land_area", "building_area", "bedrooms",
			"bathrooms", "carport", "floors", "facing", "certificate", "furnishing", "electricity",
			"facilities", "property_location", "min_order", "max_order"},
	}

	for pType, keys := range frontend {
		allowed, ok := ProductAttributeSchema[pType]
		if !ok {
			t.Fatalf("tipe %q tidak ada di ProductAttributeSchema", pType)
		}
		set := make(map[string]bool, len(allowed))
		for _, k := range allowed {
			set[k] = true
		}
		for _, k := range keys {
			if !set[k] {
				t.Errorf("tipe %q: frontend mengirim %q tapi skema tidak mengizinkannya", pType, k)
			}
		}
	}
}

// TestFilterProductAttributes — allow-list menegakkan kontrak.
func TestFilterProductAttributes(t *testing.T) {
	t.Run("key sah dipertahankan (kontrol positif)", func(t *testing.T) {
		in := map[string]interface{}{"brand": "Acme", "weight": "500", "material": "kayu"}
		out := FilterProductAttributes("physical", in)
		if len(out) != 3 || out["brand"] != "Acme" || out["weight"] != "500" {
			t.Fatalf("atribut sah hilang: %#v", out)
		}
	})

	t.Run("key milik tipe lain dibuang", func(t *testing.T) {
		// portion_size/prep_time hanya milik food -> wajib hilang di physical.
		in := map[string]interface{}{"brand": "Acme", "portion_size": "1 porsi", "prep_time": "15 menit"}
		out := FilterProductAttributes("physical", in)
		if _, bad := out["portion_size"]; bad {
			t.Error("portion_size (milik food) lolos ke physical")
		}
		if _, bad := out["prep_time"]; bad {
			t.Error("prep_time (milik food) lolos ke physical")
		}
		if out["brand"] != "Acme" {
			t.Error("key sah ikut terbuang")
		}
	})

	t.Run("key hanya-mobile dibuang untuk desktop-parity", func(t *testing.T) {
		in := map[string]interface{}{"growing_media": "tanah", "plant_legality": "legal"}
		out := FilterProductAttributes("physical", in)
		if len(out) != 0 {
			t.Errorf("key khusus plant lolos ke physical: %#v", out)
		}
	})

	t.Run("tipe tak dikenal fail closed", func(t *testing.T) {
		in := map[string]interface{}{"brand": "Acme"}
		if out := FilterProductAttributes("superadminx", in); len(out) != 0 {
			t.Errorf("tipe tak dikenal harus menghasilkan kosong, dapat %#v", out)
		}
		if out := FilterProductAttributes("", in); len(out) != 0 {
			t.Errorf("tipe kosong harus menghasilkan kosong, dapat %#v", out)
		}
	})

	t.Run("input tidak dimutasi", func(t *testing.T) {
		in := map[string]interface{}{"brand": "Acme", "portion_size": "1 porsi"}
		_ = FilterProductAttributes("physical", in)
		if len(in) != 2 {
			t.Errorf("input termutasi: %#v", in)
		}
	})

	t.Run("input nil aman", func(t *testing.T) {
		if out := FilterProductAttributes("physical", nil); len(out) != 0 {
			t.Errorf("nil harus jadi kosong, dapat %#v", out)
		}
	})
}

// TestValidProductType — tipe resmi ada, sampah tidak.
func TestValidProductType(t *testing.T) {
	for _, p := range []string{"physical", "food", "service", "digital", "fauna", "plant", "property"} {
		if !ValidProductType(p) {
			t.Errorf("%q seharusnya valid", p)
		}
	}
	for _, p := range []string{"", "FISIK", "superadminx", "physical "} {
		if ValidProductType(p) {
			t.Errorf("%q seharusnya tidak valid", p)
		}
	}
}
