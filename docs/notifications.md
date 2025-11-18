# Notifications Overview

This document captures the notification flow that currently runs in production code. Use it together with the mermaid diagrams in `docs/diagrams/` when you need a visual reference.

## High-Level Flow

1. **Task Service** generates notification events inside `services/task-service/internal/service/` by calling the shared `NotificationPublisher`. Each event contains the organization id, trigger user id, a list of target user ids, and a payload (see `shared/contracts/notification.go`).
2. **RabbitMQ** routes those events via the `events` exchange and the routing keys named `notification.*` into the durable `notifications` queue (declared in `shared/messaging/rabbitmq.go`).
3. **Notification Service** (`services/notification-service`) consumes the queue:
   - builds a user-specific `Notification` model for every recipient,
   - persists it in PostgreSQL via `internal/service/notification_service.go`, and
   - publishes a lightweight WebSocket distribution message to the `notification-ws-distribution` queue so connected clients can receive real-time updates.
4. **API Gateway** performs two jobs:
   - exposes HTTP endpoints in `internal/handler/http/notification_http_handler.go` that call the gRPC client defined in `internal/service/notification_service.go` (List, unread count, mark read, mark all read, delete),
   - subscribes to the `notification-ws-distribution` queue in `internal/event/notification_consumer.go` and forwards each payload to the correct user session via the shared WebSocket connection manager.
5. **Web Client** listens for the `notification.created` WebSocket message (`web/client/src/components/dashboard/use-dashboard-shell.ts`) and calls the REST API when the user opens the notification drawer or marks items as read.

## Event Contracts

All services rely on the structs declared in `shared/contracts/notification.go`:

- `NotificationEvent` is the envelope placed on RabbitMQ and contains:
  - `OrganizationID`
  - `TriggerUserID`
  - `Recipients` (slice of user ids as strings)
  - `EventType` (`notification.task.created`, `notification.comment.mentioned`, etc.)
  - `Data` (task or comment specific payload)
- `TaskNotificationData` carries the task id, title, status, priority, optional due date, and nested `TaskUser` objects for the trigger / assignee / reporter. When a task is updated the `Changes` field contains the before/after values for title, description, status, priority, assignee, or due date.
- `CommentNotificationData` carries the comment id, task id, task title, content snippet, parent comment id (if reply), author metadata, and the list of usernames mentioned.

Refer to `shared/messaging/notification_publisher.go` for a complete list of helper methods that emit each event type. All of them publish to the `events` exchange using the event type constant as the routing key.

## Persistence and Distribution

- `services/notification-service/internal/models/notification.go` defines the persisted schema (UUIDs for user, organization, trigger user, entity type/id, title, message, url, read state, timestamps).
- `internal/event/notification_consumer.go` consumes the `notifications` queue, calls into the service layer to create each record, and then publishes a JSON payload `{ userId, notification }` to the `notification-ws-distribution` queue for downstream WebSocket delivery.
- The WebSocket distributor inside the API gateway (`services/api-gateway/internal/event/notification_consumer.go`) reads that queue and wraps the payload in `contracts.WSMessage{ Type: "notification.created", Data: notification }` before broadcasting through the connection manager.

## API Surface

HTTP handlers (all under `/api/notifications`) call the gRPC client generated from `proto/notification/v1/notification.proto`:

| Endpoint | Handler | Description |
| -------- | ------- | ----------- |
| `GET /api/notifications?page&limit&is_read` | `NotificationHandler.List` | Returns paginated notifications for the authenticated user (camelCase via `shared/transform/notification`). |
| `GET /api/notifications/unread/count` | `NotificationHandler.GetUnreadCount` | Returns the unread total. |
| `PATCH /api/notifications/:id/read` | `NotificationHandler.MarkAsRead` | Marks a single notification as read. |
| `POST /api/notifications/mark-all-read` | `NotificationHandler.MarkAllAsRead` | Marks every notification for the user as read. |
| `DELETE /api/notifications/:id` | `NotificationHandler.Delete` | Soft deletes a notification. |

The gateway automatically injects the auth headers via `withOutgoingAuth`, so downstream services receive the same request id / user context—check Jaeger traces when debugging.

## Web Client Expectations

- The dashboard shell registers handlers for `notification.created` WebSocket messages, updates the shared notification store, bumps the badge count, and optionally fires a toast.
- The UI uses the REST endpoints for pagination, mark-as-read, and deletion to avoid duplicating business rules in the browser.
- Hash-based URLs (e.g., `/dashboard/tasks/<taskId>#comment-<commentId>`) map back to the `url` that the notification service stores when building a record; make sure backend code continues to set this field so the UI can jump to the right place.

## Where to Look When Debugging

| Concern | Code |
| ------- | ---- |
| Event emission / recipient selection | `services/task-service/internal/service/*.go` (task + comment services) |
| RabbitMQ topology | `shared/messaging/rabbitmq.go` and `shared/messaging/events.go` |
| Notification persistence | `services/notification-service/internal/service/notification_service.go` |
| WebSocket delivery | `services/api-gateway/internal/event/notification_consumer.go` + `shared/messaging/connection_manager.go` |
| HTTP / gRPC wiring | `services/api-gateway/internal/handler/http/notification_http_handler.go` and `shared/proto/notification/v1` |

This reference should stay accurate as long as those packages remain the integration points. Update it whenever the routing keys, queue names, or service responsibilities change.
