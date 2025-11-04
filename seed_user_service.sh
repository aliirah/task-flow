#!/usr/bin/env bash
set -euo pipefail

export USER_DATABASE_URL=${USER_DATABASE_URL:-postgres://user_service:user_service@localhost:5432/user_service?sslmode=disable}

go run ./services/user-service/cmd/seeder
