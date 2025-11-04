package main

import (
	"log"

	"github.com/aliirah/task-flow/services/user-service/internal/seed"
)

func main() {
	if err := seed.Run(); err != nil {
		log.Fatalf("user service seeder failed: %v", err)
	}
}
