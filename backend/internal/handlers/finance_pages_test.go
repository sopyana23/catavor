//go:build automationqa

package handlers

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"
	"time"

	"catavor-backend/internal/models"
	"catavor-backend/internal/services"
	"github.com/gofiber/fiber/v2"
)

func TestFinancePagesPostgres(t *testing.T) {
	must := func(t *testing.T, err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	db := automationTestDB(t)
	user := models.User{Name: "Kasir Uji", Email: "finance@example.invalid"}
	must(t, db.Create(&user).Error)
	store := models.Store{UserID: user.ID, Slug: "fixture-paging", StoreTitle: "Toko 100%"}
	must(t, db.Create(&store).Error)
	var coupons []services.MasterCoupon
	for i := 1; i <= 37; i++ {
		method, mode, status := "bank", "manual_qris", "pending"
		if i > 30 {
			method, mode, status = "qris", "gateway_aulaa", "paid"
		}
		order := models.SubscriptionOrder{StoreID: store.ID, UserID: user.ID, OrderNumber: fmt.Sprintf("PAGE-%03d", i), PaymentMethod: method, PaymentMode: mode, PaymentStatus: status, FinalAmount: 500}
		must(t, db.Create(&order).Error)
		coupons = append(coupons, services.MasterCoupon{Code: order.OrderNumber, Label: "Kupon", Type: "discount", IsActive: i > 30})
	}
	must(t, services.SaveMasterCoupons(db, coupons))
	h := SubscriptionHandler{db: db}
	app := fiber.New()
	app.Get("/orders", h.AdminListOrders)
	app.Get("/coupons", h.AdminListCoupons)
	type result struct {
		Data        []json.RawMessage
		Total, Page int
		Facets      map[string]map[string]int
		Summary     map[string]float64
	}
	read := func(path string) result {
		t.Helper()
		r, err := app.Test(httptest.NewRequest("GET", path, nil))
		must(t, err)
		defer r.Body.Close()
		if r.StatusCode != 200 {
			t.Fatalf("%s: HTTP %d", path, r.StatusCode)
		}
		var page result
		must(t, json.NewDecoder(r.Body).Decode(&page))
		return page
	}
	for _, path := range []string{"/orders", "/coupons"} {
		first := read(path + "?page=1&limit=10")
		last := read(path + "?page=200&limit=10")
		if first.Total != 37 || len(first.Data) != 10 || last.Page != 4 || len(last.Data) != 7 {
			t.Fatalf("page bounds: %s", path)
		}
		if read(path+"?q=PAGE-033").Total != 1 {
			t.Fatalf("global search: %s", path)
		}
	}
	orders := read("/orders?status=paid&channel=gateway_aulaa&q=Kasir")
	if orders.Total != 7 || orders.Facets["status"]["paid"] != 7 || orders.Summary["revenue"] != 3500 {
		t.Fatalf("order facets: %+v", orders)
	}
	var invoice struct {
		Store, User map[string]any
	}
	must(t, json.Unmarshal(orders.Data[0], &invoice))
	if len(invoice.Store) != 5 || invoice.Store["store_title"] != store.StoreTitle || len(invoice.User) != 3 || invoice.User["email"] != user.Email {
		t.Fatal("unexpected invoice contacts", invoice)
	}
	if read("/orders?q=%25").Total != 37 || read("/coupons?q=%25").Total != 0 {
		t.Fatal("literal wildcard search")
	}
	if c := read("/coupons?status=active&type=discount"); c.Total != 7 || c.Facets["status"]["inactive"] != 30 {
		t.Fatalf("coupon facets: %+v", c)
	}
	if s := read("/orders?summary=1"); len(s.Data) != 0 || s.Summary["total"] != 37 {
		t.Fatal("summary loaded records")
	}
	for _, path := range []string{"/orders?limit=101", "/coupons?page=0"} {
		res, err := app.Test(httptest.NewRequest("GET", path, nil))
		must(t, err)
		res.Body.Close()
		if res.StatusCode != 400 {
			t.Fatalf("%s: HTTP %d", path, res.StatusCode)
		}
	}
	t.Run("volume", func(t *testing.T) {
		must(t, db.Exec(`INSERT INTO subscription_orders
			(store_id,user_id,order_number,type,plan_code,original_amount,final_amount,payment_status,created_at)
			SELECT ?, ?, 'VOL-' || i,'renewal','pro_starter',12000.15,12000.15,'paid',now()
			FROM generate_series(1,10000) i`, store.ID, user.ID).Error)
		must(t, db.Exec(`UPDATE settings SET value = (SELECT jsonb_agg(jsonb_build_object(
			'code','VOL-' || i, 'type','discount', 'is_active', true) ORDER BY i)::text
			FROM generate_series(1,10000) i) WHERE key='master_coupons'`).Error)
		for _, tc := range []struct {
			path        string
			total, rows int
		}{
			{"/orders?page=500&limit=10", 10037, 10},
			{"/coupons?page=500&limit=10", 10000, 10},
			{"/orders?q=VOL-9999&channel=manual_bank", 1, 1},
			{"/coupons?q=VOL-9999&type=discount", 1, 1},
		} {
			start := time.Now()
			p := read(tc.path)
			if p.Total != tc.total || len(p.Data) != tc.rows {
				t.Fatalf("%s: total=%d rows=%d", tc.path, p.Total, len(p.Data))
			}
			t.Logf("%s: total=%d rows=%d elapsed=%s", tc.path, p.Total, len(p.Data), time.Since(start).Round(time.Millisecond))
		}
	})
}
