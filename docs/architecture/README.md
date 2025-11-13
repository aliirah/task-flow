# Task Flow - System Overview

This is a microservices-based task management system built with Go backend services and a Next.js frontend.

## Architecture Documentation

- [High-Level Architecture](./01-high-level-architecture.md) - Complete system overview
- [User Registration Flow](./02-user-registration-flow.md) - New user signup process
- [User Login Flow](./03-user-login-flow.md) - Authentication flow
- [Task Creation Flow](./04-task-creation-flow.md) - Creating tasks with real-time updates
- [Task Update Flow](./05-task-update-flow.md) - Updating tasks with events
- [Organization Flow](./06-organization-flow.md) - Organization and member management
- [RabbitMQ Events](./07-rabbitmq-events.md) - Event-driven architecture
- [WebSocket Communication](./08-websocket-communication.md) - Real-time updates
- [Database Schemas](./09-database-schemas.md) - All database structures
- [Technology Stack](./10-technology-stack.md) - Technologies and tools used

## Quick Links

- **API Gateway**: Port 8081 (HTTP/WebSocket)
- **Auth Service**: Port 50051 (gRPC)
- **User Service**: Port 50052 (gRPC)
- **Organization Service**: Port 50053 (gRPC)
- **Task Service**: Port 50054 (gRPC)
- **Web Client**: Port 3000 (HTTP)
