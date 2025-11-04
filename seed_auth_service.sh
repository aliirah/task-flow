#!/usr/bin/env bash
set -euo pipefail

export AUTH_DATABASE_URL=${AUTH_DATABASE_URL:-postgres://auth_service:auth_service@localhost:5432/auth_service?sslmode=disable}

go run ./services/auth-service/cmd/seeder
