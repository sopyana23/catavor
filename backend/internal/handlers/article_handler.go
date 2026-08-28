package handlers

import (
	"time"

	"catavor-backend/internal/database"
	"catavor-backend/internal/models"
	"catavor-backend/internal/security"

	"github.com/gofiber/fiber/v2"
)

type ArticleHandler struct{}

func NewArticleHandler() *ArticleHandler {
	return &ArticleHandler{}
}

func (h *ArticleHandler) Index(c *fiber.Ctx) error {
	var articles []models.Article
	if err := database.DB.Preload("Comments").Order("id desc").Find(&articles).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memuat artikel.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    articles,
	})
}

func (h *ArticleHandler) Show(c *fiber.Ctx) error {
	param := c.Params("id")
	var article models.Article

	err := database.DB.Preload("Comments.Replies").Where("id = ? OR slug = ?", param, param).First(&article).Error
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Artikel tidak ditemukan.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    article,
	})
}

func (h *ArticleHandler) Store(c *fiber.Ctx) error {
	var payload models.Article
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	payload.Title = security.SanitizePlainText(payload.Title, 255)
	payload.Content = security.SanitizeRichText(payload.Content, 100000)
	payload.ImageURL = security.SanitizeURL(payload.ImageURL)
	payload.Author = security.SanitizePlainText(payload.Author, 100)
	payload.ReadTime = security.SanitizePlainText(payload.ReadTime, 50)
	payload.MetaDescription = security.SanitizePlainText(payload.MetaDescription, 500)

	if payload.Title == "" || payload.Content == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Judul dan konten artikel wajib diisi.",
		})
	}

	if payload.Slug == "" {
		payload.Slug = security.SanitizeSlug(payload.Title)
	} else {
		payload.Slug = security.SanitizeSlug(payload.Slug)
	}

	if err := database.DB.Create(&payload).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal membuat artikel.",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Artikel berhasil diterbitkan.",
		"data":    payload,
	})
}

func (h *ArticleHandler) Update(c *fiber.Ctx) error {
	id := c.Params("id")
	var article models.Article
	if err := database.DB.First(&article, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Artikel tidak ditemukan.",
		})
	}

	var payload models.Article
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data tidak valid.",
		})
	}

	if payload.Title != "" {
		article.Title = security.SanitizePlainText(payload.Title, 255)
	}
	if payload.Content != "" {
		article.Content = security.SanitizeRichText(payload.Content, 100000)
	}
	if payload.Slug != "" {
		article.Slug = security.SanitizeSlug(payload.Slug)
	}
	if payload.ImageURL != "" {
		article.ImageURL = security.SanitizeURL(payload.ImageURL)
	}
	if payload.Author != "" {
		article.Author = security.SanitizePlainText(payload.Author, 100)
	}
	if payload.ReadTime != "" {
		article.ReadTime = security.SanitizePlainText(payload.ReadTime, 50)
	}
	if payload.MetaDescription != "" {
		article.MetaDescription = security.SanitizePlainText(payload.MetaDescription, 500)
	}
	article.IsCommentsEnabled = payload.IsCommentsEnabled
	article.RequireCommentApproval = payload.RequireCommentApproval
	article.RequireCommentEmail = payload.RequireCommentEmail
	article.VerifyCommentEmailDomain = payload.VerifyCommentEmailDomain

	if err := database.DB.Save(&article).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal memperbarui artikel.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Artikel berhasil diperbarui.",
		"data":    article,
	})
}

func (h *ArticleHandler) Destroy(c *fiber.Ctx) error {
	id := c.Params("id")
	database.DB.Delete(&models.Article{}, id)
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Artikel berhasil dihapus.",
	})
}

func (h *ArticleHandler) GetArticleComments(c *fiber.Ctx) error {
	id := c.Params("id")
	var comments []models.Comment
	database.DB.Where("article_id = ? AND parent_id IS NULL AND is_approved = true", id).
		Preload("Replies", "is_approved = true").
		Order("created_at desc").
		Find(&comments)

	return c.JSON(fiber.Map{
		"success": true,
		"data":    comments,
	})
}

func (h *ArticleHandler) StoreComment(c *fiber.Ctx) error {
	articleID := c.Params("id")
	var article models.Article
	if err := database.DB.First(&article, articleID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Artikel tidak ditemukan.",
		})
	}

	var req struct {
		AuthorName  string `json:"author_name"`
		AuthorEmail string `json:"author_email"`
		Content     string `json:"content"`
		ParentID    *uint  `json:"parent_id"`
		ReplyToName string `json:"reply_to_name"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Format data komentar tidak valid.",
		})
	}

	authorName := security.SanitizePlainText(req.AuthorName, 100)
	authorEmail := security.SanitizePlainText(req.AuthorEmail, 254)
	content := security.SanitizePlainText(req.Content, 2000)
	replyToName := security.SanitizePlainText(req.ReplyToName, 100)

	if authorName == "" || content == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Nama dan isi komentar wajib diisi.",
		})
	}

	if article.RequireCommentEmail && !security.ValidateEmail(authorEmail) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Email yang valid wajib diisi untuk berkomentar pada artikel ini.",
		})
	}

	isApproved := true
	if article.RequireCommentApproval {
		isApproved = false
	}

	comment := models.Comment{
		ArticleID:   article.ID,
		ParentID:    req.ParentID,
		AuthorName:  authorName,
		AuthorEmail: authorEmail,
		Content:     content,
		IsApproved:  isApproved,
		ReplyToName: replyToName,
		CreatedAt:   time.Now(),
	}

	if err := database.DB.Create(&comment).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Gagal menyimpan komentar.",
		})
	}

	msg := "Komentar berhasil dikirim."
	if !isApproved {
		msg = "Komentar berhasil dikirim dan menunggu persetujuan moderator."
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": msg,
		"data":    comment,
	})
}

func (h *ArticleHandler) GetAdminComments(c *fiber.Ctx) error {
	var comments []models.Comment
	database.DB.Order("created_at desc").Find(&comments)

	return c.JSON(fiber.Map{
		"success": true,
		"data":    comments,
	})
}

func (h *ArticleHandler) ApproveComment(c *fiber.Ctx) error {
	id := c.Params("id")
	database.DB.Model(&models.Comment{}).Where("id = ?", id).Update("is_approved", true)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Komentar berhasil disetujui.",
	})
}

func (h *ArticleHandler) DeleteComment(c *fiber.Ctx) error {
	id := c.Params("id")
	database.DB.Delete(&models.Comment{}, id)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Komentar berhasil dihapus.",
	})
}
