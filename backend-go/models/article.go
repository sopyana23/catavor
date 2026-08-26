package models

import (
	"time"
)

type Article struct {
	ID                       uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	StoreID                  uint      `gorm:"index;default:1" json:"store_id"`
	Title                    string    `gorm:"size:255;not null" json:"title"`
	Slug                     string    `gorm:"size:255;uniqueIndex;not null" json:"slug"`
	Content                  string    `gorm:"type:text;not null" json:"content"`
	ImageURL                 string    `gorm:"type:text" json:"image_url"`
	Author                   string    `gorm:"size:100;default:'Admin Catavor'" json:"author"`
	ReadTime                 string    `gorm:"size:50;default:'5 mnt baca'" json:"read_time"`
	MetaDescription          string    `gorm:"type:text" json:"meta_description"`
	IsCommentsEnabled        bool      `gorm:"default:true" json:"is_comments_enabled"`
	RequireCommentApproval   bool      `gorm:"default:false" json:"require_comment_approval"`
	RequireCommentEmail      bool      `gorm:"default:false" json:"require_comment_email"`
	VerifyCommentEmailDomain bool      `gorm:"default:false" json:"verify_comment_email_domain"`
	CreatedAt                time.Time `json:"created_at"`
	UpdatedAt                time.Time `json:"updated_at"`

	// Relations
	Comments []Comment `gorm:"foreignKey:ArticleID" json:"comments,omitempty"`
}

type Comment struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ArticleID   uint      `gorm:"index;not null" json:"article_id"`
	ParentID    *uint     `gorm:"index" json:"parent_id"`
	AuthorName  string    `gorm:"size:255;not null" json:"author_name"`
	AuthorEmail string    `gorm:"size:255" json:"author_email"`
	Content     string    `gorm:"type:text;not null" json:"content"`
	IsApproved  bool      `gorm:"default:true" json:"is_approved"`
	ReplyToName string    `gorm:"size:255" json:"reply_to_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Relations
	Replies []Comment `gorm:"foreignKey:ParentID" json:"replies,omitempty"`
}
