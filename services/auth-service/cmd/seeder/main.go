package main

import (
	"log"

	"github.com/aliirah/task-flow/services/auth-service/internal/seed"
)

func main() {
	if err := seed.Run(); err != nil {
		log.Fatalf("auth service seeder failed: %v", err)
	}
}
