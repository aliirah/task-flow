package service

import "context"

type HealthStatus struct {
	Status string `json:"status"`
}

type HealthService interface {
	Status(ctx context.Context) (HealthStatus, error)
}

type healthService struct{}

func NewHealthService() HealthService {
	return &healthService{}
}

func (s *healthService) Status(ctx context.Context) (HealthStatus, error) {
	return HealthStatus{Status: "ok"}, nil
}
