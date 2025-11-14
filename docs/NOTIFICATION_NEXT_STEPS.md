# Next Steps for Notification System

## Status: Notification Service ✅ COMPLETED

The notification service is now fully implemented with:
- ✅ Protobuf definitions (`proto/notification/v1/notification.proto`)
- ✅ Database model (`services/notification-service/internal/models/notification.go`)
- ✅ Repository layer (`services/notification-service/internal/repository/`)
- ✅ Service layer (`services/notification-service/internal/service/`)
- ✅ gRPC handler (`services/notification-service/internal/handler/`)
- ✅ RabbitMQ consumer (`services/notification-service/internal/event/`)
- ✅ Main service file (`services/notification-service/main.go`)
- ✅ Shared contracts (`shared/contracts/notification.go`)
- ✅ Shared publisher (`shared/messaging/notification_publisher.go`)

## Immediate Next Steps

### 1. Generate Protobuf Code
```bash
make generate-proto
```

This will generate the Go code from `proto/notification/v1/notification.proto`.

### 2. Add Dockerfile for Notification Service

Create `infra/dev/docker/notification-service.Dockerfile`:
```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o notification-service ./services/notification-service

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/notification-service .
EXPOSE 50055
CMD ["./notification-service"]
```

### 3. Update Kubernetes/Tilt Configuration

Add notification-service to your deployment configuration.

### 4. Integrate Publishers in Task Service

You need to add notification publishers to:

#### A. Task Operations (`services/task-service/internal/service/task_service.go`)

**CreateTask** - Notify assignee and reporter:
```go
// After successful task creation
recipients := []string{}
if task.AssigneeID != nil && *task.AssigneeID != triggeredBy.UserID {
    recipients = append(recipients, task.AssigneeID.String())
}
if task.ReporterID != triggeredBy.UserID && (task.AssigneeID == nil || *task.AssigneeID != task.ReporterID) {
    recipients = append(recipients, task.ReporterID.String())
}

if len(recipients) > 0 {
    notifData := &contracts.TaskNotificationData{
        TaskID: task.ID.String(),
        Title: task.Title,
        Status: string(task.Status),
        Priority: string(task.Priority),
        TriggerUser: triggeredBy,
    }
    s.notifPublisher.PublishTaskCreated(ctx, task.OrganizationID.String(), triggeredBy.UserID, recipients, notifData)
}
```

**UpdateTask** - Similar logic with change tracking

**DeleteTask** - Notify stakeholders

#### B. Comment Operations (`services/task-service/internal/service/comment_service.go`)

**CreateComment**:
- Notify mentioned users
- Notify parent comment author (if reply)
- Notify task assignee/reporter (if not trigger user)

**UpdateComment**:
- Notify newly mentioned users (if mentions changed)

### 5. Initialize Notification Publisher in Task Service

In `services/task-service/main.go` or service initialization:
```go
notifPublisher := messaging.NewNotificationPublisher(rabbitMQConn)
```

Pass it to the task service.

### 6. Add API Gateway HTTP Endpoints

Create `services/api-gateway/internal/handler/http/notification_http_handler.go`:

```go
func (h *NotificationHandler) ListNotifications(c *gin.Context) {
    // GET /api/notifications
}

func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
    // GET /api/notifications/unread-count
}

func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
    // PATCH /api/notifications/:id/read
}

func (h *NotificationHandler) MarkAllAsRead(c *gin.Context) {
    // POST /api/notifications/read-all
}

func (h *NotificationHandler) DeleteNotification(c *gin.Context) {
    // DELETE /api/notifications/:id
}
```

### 7. Update WebSocket to Send Notifications

In `services/api-gateway/internal/handler/ws/websocket_handler.go`:

1. Create a notification consumer
2. When notification is created for a user, check if they're connected
3. Send notification via WebSocket

### 8. Frontend Implementation

#### A. Create API Client (`web/client/src/lib/api/notification.ts`)
```typescript
export const notificationApi = {
  list: (params) => apiClient(`/api/notifications?...`),
  markAsRead: (id) => apiClient(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllAsRead: () => apiClient(`/api/notifications/read-all`, { method: 'POST' }),
  delete: (id) => apiClient(`/api/notifications/${id}`, { method: 'DELETE' }),
  getUnreadCount: () => apiClient(`/api/notifications/unread-count`),
}
```

#### B. Create Components
- `notification-bell.tsx` - Bell icon in header with unread badge
- `notification-dropdown.tsx` - Dropdown list of notifications
- `notification-item.tsx` - Individual notification card

#### C. WebSocket Integration
Update WebSocket hook to listen for "notification" events and update state.

### 9. Database Migration

Run this SQL to create the notifications table:
```sql
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    trigger_user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_organization ON notifications(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_type ON notifications(type) WHERE deleted_at IS NULL;
```

### 10. Clean Up Old Logic (AFTER new system is verified)

Remove:
- `services/task-service/internal/event/task_publisher.go`
- `services/api-gateway/internal/event/task_consumer.go`
- Old task event handling in WebSocket
- TaskCreated/TaskUpdated from `shared/contracts/amqp.go`
- Old task event types from frontend

## Testing Checklist

- [ ] Notification service starts and connects to DB/RabbitMQ
- [ ] Task created → notification created for assignee
- [ ] Comment with mention → notification created for mentioned user
- [ ] WebSocket delivers notification in real-time
- [ ] Mark as read works
- [ ] Unread count updates correctly
- [ ] Clicking notification navigates to task
- [ ] Frontend UI displays notifications properly

## Environment Variables

**notification-service:**
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/taskflow
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
GRPC_PORT=50055
```

**api-gateway:**
```env
NOTIFICATION_SERVICE_URL=localhost:50055
```

## What's Left

1. **Generate protobuf** - Run `make generate-proto`
2. **Add to deployment** - Docker + K8s config
3. **Add publishers in task-service** - Integrate notification events
4. **API Gateway endpoints** - HTTP + WebSocket
5. **Frontend UI** - Components + WebSocket
6. **Test** - Verify end-to-end
7. **Clean up** - Remove old task events

The foundation is solid. Now it's implementation and integration!
