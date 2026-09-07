package models

import (
	"time"
)

// SupportTicket represents a support inquiry or issue thread submitted by a merchant/user.
type SupportTicket struct {
	ID            uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	TicketNumber  string     `gorm:"size:50;uniqueIndex;not null" json:"ticket_number"` // e.g. TCK-20260902-8F2A
	UserID        uint       `gorm:"index;not null" json:"user_id"`
	StoreID       *uint      `gorm:"index" json:"store_id,omitempty"`
	Subject       string     `gorm:"size:255;not null" json:"subject"`
	Category      string     `gorm:"size:100;not null" json:"category"` // billing | technical | catalog_help | account | general
	Priority      string     `gorm:"size:50;default:'medium';index" json:"priority"` // low | medium | high | urgent
	Status        string     `gorm:"size:50;default:'open';index" json:"status"` // open | waiting_agent | waiting_user | resolved | closed
	LastMessageAt time.Time  `gorm:"index" json:"last_message_at"`
	CreatedAt     time.Time  `gorm:"index" json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`

	// Relations
	User     *User            `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Store    *Store           `gorm:"foreignKey:StoreID" json:"store,omitempty"`
	Messages []SupportMessage `gorm:"foreignKey:TicketID" json:"messages,omitempty"`
}

// TableName explicitly maps SupportTicket model to 'support_tickets' table.
func (SupportTicket) TableName() string {
	return "support_tickets"
}

// SupportMessage represents a single two-way chat message in a support ticket thread.
type SupportMessage struct {
	ID             uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	TicketID       uint      `gorm:"index;not null" json:"ticket_id"`
	SenderID       uint      `gorm:"index;not null" json:"sender_id"`
	SenderType     string    `gorm:"size:50;not null" json:"sender_type"` // 'user' | 'agent' | 'system'
	Message        string    `gorm:"type:text;not null" json:"message"`
	IsInternalNote bool      `gorm:"default:false" json:"is_internal_note"`
	ReadAt         *time.Time `json:"read_at,omitempty"`
	CreatedAt      time.Time  `gorm:"index" json:"created_at"`

	// Relations
	Ticket      *SupportTicket      `gorm:"foreignKey:TicketID" json:"ticket,omitempty"`
	Sender      *User               `gorm:"foreignKey:SenderID" json:"sender,omitempty"`
	Attachments []SupportAttachment `gorm:"foreignKey:MessageID" json:"attachments,omitempty"`
}

// TableName explicitly maps SupportMessage model to 'support_messages' table.
func (SupportMessage) TableName() string {
	return "support_messages"
}

// SupportAttachment represents a normalized image screenshot or file attachment attached to a support message.
type SupportAttachment struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	MessageID  uint      `gorm:"index;not null" json:"message_id"`
	FileURL    string    `gorm:"type:text;not null" json:"file_url"`
	StorageKey string    `gorm:"size:500;not null" json:"storage_key"`
	FileName   string    `gorm:"size:255;not null" json:"file_name"`
	FileSize   int       `gorm:"default:0" json:"file_size"`
	FileType   string    `gorm:"size:100;default:'image/jpeg'" json:"file_type"`
	CreatedAt  time.Time `json:"created_at"`

	// Relations
	Message *SupportMessage `gorm:"foreignKey:MessageID" json:"message,omitempty"`
}

// TableName explicitly maps SupportAttachment model to 'support_attachments' table.
func (SupportAttachment) TableName() string {
	return "support_attachments"
}

// HelpArticle represents a self-service knowledge base / FAQ guide article.
type HelpArticle struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Category     string    `gorm:"size:100;index;not null" json:"category"`
	Title        string    `gorm:"size:255;not null" json:"title"`
	Slug         string    `gorm:"size:255;uniqueIndex;not null" json:"slug"`
	Content      string    `gorm:"type:text;not null" json:"content"`
	HelpfulCount int       `gorm:"default:0" json:"helpful_count"`
	SortOrder    int       `gorm:"default:0" json:"sort_order"`
	IsPublished  bool      `gorm:"default:true;index" json:"is_published"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// TableName explicitly maps HelpArticle model to 'help_articles' table.
func (HelpArticle) TableName() string {
	return "help_articles"
}
