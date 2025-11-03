package services

import (
	"context"
	"time"
)

type HealthStatus struct {
	Status    string    `json:"status"`
	CheckedAt time.Time `json:"checkedAt"`
}

type HealthService interface {
	Status(ctx context.Context) (HealthStatus, error)
}

func NewHealthService() HealthService {
	return &healthService{}
}

type healthService struct{}

func (s *healthService) Status(ctx context.Context) (HealthStatus, error) {
	return HealthStatus{
		Status:    "ok",
		CheckedAt: time.Now().UTC(),
	}, nil
}
