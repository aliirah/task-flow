package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Organization struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey"`
	Name        string    `gorm:"not null"`
	Description string
	OwnerID     uuid.UUID            `gorm:"type:uuid;index"`
	Members     []OrganizationMember `gorm:"constraint:OnDelete:CASCADE"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (o *Organization) BeforeCreate(tx *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	return nil
}

type OrganizationMember struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey"`
	OrganizationID uuid.UUID `gorm:"type:uuid;index:idx_org_membership,unique"`
	UserID         uuid.UUID `gorm:"type:uuid;index:idx_org_membership,unique"`
	Role           string    `gorm:"not null;default:member"`
	Status         string    `gorm:"not null;default:active"`
	CreatedAt      time.Time
}

func (m *OrganizationMember) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.CreatedAt.IsZero() {
		m.CreatedAt = time.Now().UTC()
	}
	if m.Status == "" {
		m.Status = "active"
	}
	if m.Role == "" {
		m.Role = "member"
	}
	return nil
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(&Organization{}, &OrganizationMember{})
}
