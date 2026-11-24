package main

import "github.com/gofiber/fiber/v2"

// scopedRouter membungkus fiber.Router dengan memasang middleware ke setiap rute
// yang didaftarkan secara eksplisit alih-alih api.Group("", mw...), karena Fiber v2
// mendaftarkan grup prefix kosong sebagai middleware prefix global (`USE /api`)
// yang bocor ke grup rute berikutnya (termasuk /api/admin/*).
type scopedRouter struct {
	parent      fiber.Router
	middlewares []fiber.Handler
}

func newScopedGroup(parent fiber.Router, middlewares ...fiber.Handler) *scopedRouter {
	mwCopy := make([]fiber.Handler, len(middlewares))
	copy(mwCopy, middlewares)
	return &scopedRouter{
		parent:      parent,
		middlewares: mwCopy,
	}
}

func (r *scopedRouter) chain(handlers []fiber.Handler) []fiber.Handler {
	combined := make([]fiber.Handler, 0, len(r.middlewares)+len(handlers))
	combined = append(combined, r.middlewares...)
	combined = append(combined, handlers...)
	return combined
}

func (r *scopedRouter) Get(path string, handlers ...fiber.Handler) fiber.Router {
	return r.parent.Get(path, r.chain(handlers)...)
}

func (r *scopedRouter) Post(path string, handlers ...fiber.Handler) fiber.Router {
	return r.parent.Post(path, r.chain(handlers)...)
}

func (r *scopedRouter) Put(path string, handlers ...fiber.Handler) fiber.Router {
	return r.parent.Put(path, r.chain(handlers)...)
}

func (r *scopedRouter) Delete(path string, handlers ...fiber.Handler) fiber.Router {
	return r.parent.Delete(path, r.chain(handlers)...)
}

func (r *scopedRouter) Patch(path string, handlers ...fiber.Handler) fiber.Router {
	return r.parent.Patch(path, r.chain(handlers)...)
}
