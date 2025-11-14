# Notification System Architecture & Data Flow

## Overview

The notification system follows an **event-driven architecture** with three main components working together to deliver real-time notifications to users.

## Architecture Diagram

```
┌─────────────┐
│ Task-Service│
└──────┬──────┘
       │ Publishes notification events
       │ (task.created, comment.mentioned, etc.)
       ▼
┌────────────────────┐
│   RabbitMQ         │
│  EventExchange     │
│                    │
│  Routing Keys:     │
│  - task.created    │
│  - task.updated    │
│  - task.deleted    │
│  - comment.created │
│  - comment.updated │
│  - comment.deleted │
│  - comment.mentioned│
└────────┬───────────┘
         │ Consumed by
         ▼
┌────────────────────────┐
│ Notification-Service   │
│                        │
│ 1. Consumes events     │
│ 2. Creates DB records  │
│ 3. One per recipient   │
└────────┬───────────────┘
         │ Stores in
         ▼
┌─────────────────┐       ┌───────────────┐
│   PostgreSQL    │◄─────►│  API-Gateway  │
│  (notifications)│       │   (gRPC)      │
└─────────────────┘       └───────┬───────┘
                                  │ WebSocket
                                  │ Push to clients
                                  ▼
                          ┌─────────────┐
                          │  Frontend   │
                          │  (React)    │
                          └─────────────┘
```

## Component Details

### 1. Task-Service (Event Publisher)

**Role:** Publishes notification events when tasks/comments are created/updated/deleted

**Technology:** 
- Uses `messaging.NotificationPublisher`
- Publishes to RabbitMQ `EventExchange`

**Published Events:**
```go
// Example: Task Created
event := contracts.NotificationEvent{
    OrganizationID: "org-uuid",
    TriggerUserID:  "user-who-created-task",
    Recipients:     []string{"assignee-uuid", "reporter-uuid"},
    EventType:      "task.created",
    Data: TaskNotificationData{
        TaskID:    "task-uuid",
        TaskTitle: "Fix bug",
        ...
    },
}

notifPublisher.PublishTaskCreated(ctx, orgID, triggerUserID, recipients, taskData)
```

**When Events Are Published:**
- `CreateTask()` → `task.created`
- `UpdateTask()` → `task.updated` (with change tracking)
- `DeleteTask()` → `task.deleted`
- `CreateComment()` → `comment.created` + `comment.mentioned`
- `UpdateComment()` → `comment.mentioned` (new mentions only)

### 2. RabbitMQ (Message Broker)

**Role:** Routes events from publishers to consumers

**Exchange:** `events` (topic exchange)

**Queue:** `notifications` (durable)

**Routing Keys:**
- `task.created`
- `task.updated`
- `task.deleted`
- `comment.created`
- `comment.updated`
- `comment.deleted`
- `comment.mentioned`

**Queue Bindings:**
The `notifications` queue is bound to ALL 7 routing keys, so it receives all notification events.

### 3. Notification-Service (Event Consumer)

**Role:** 
1. Consumes notification events from RabbitMQ
2. Creates database records (one per recipient)
3. Serves notifications via gRPC

**Technology:**
- Consumer: `event.NotificationConsumer`
- Database: PostgreSQL with GORM
- API: gRPC (NotificationService)

**Consumer Logic:**
```go
func (c *NotificationConsumer) handleMessage(msg amqp.Delivery) {
    var event contracts.NotificationEvent
    json.Unmarshal(msg.Body, &event)
    
    // Create one notification per recipient
    for _, recipientID := range event.Recipients {
        notification := buildNotification(&event, recipientID)
        notification.URL = "/tasks/{taskId}#comment-{commentId}"
        service.CreateNotification(ctx, notification)
    }
    
    msg.Ack(false)
}
```

**Database Schema:**
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    trigger_user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    url VARCHAR(500),  -- Navigation URL for frontend
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_user_created (user_id, created_at DESC),
    INDEX idx_organization (organization_id),
    INDEX idx_type (type)
);
```

**gRPC Methods:**
- `ListNotifications(page, limit, unreadOnly)` → Returns paginated notifications
- `GetUnreadCount()` → Returns count of unread notifications
- `MarkAsRead(id)` → Marks single notification as read
- `MarkAllAsRead()` → Marks all user's notifications as read
- `DeleteNotification(id)` → Soft deletes notification

### 4. API-Gateway (gRPC Client + WebSocket Server)

**Role:**
1. Provide HTTP REST endpoints for notifications
2. Proxy requests to notification-service via gRPC
3. Push real-time notifications via WebSocket

**HTTP Endpoints (to be implemented):**
```
GET    /api/notifications              → ListNotifications
GET    /api/notifications/unread/count → GetUnreadCount
PATCH  /api/notifications/:id/read     → MarkAsRead
POST   /api/notifications/mark-all-read → MarkAllAsRead
DELETE /api/notifications/:id          → DeleteNotification
```

**WebSocket Flow (to be implemented):**

**Option A: Poll and Push (Simpler)**
```
1. User connects to WebSocket at /ws
2. API-Gateway periodically calls notification-service.ListNotifications(unreadOnly=true)
3. When new notifications found, push to connected client
4. Client receives: { type: "notification", data: { ...notification } }
```

**Option B: Event-Driven (More efficient)**
```
1. User connects to WebSocket at /ws
2. Notification-service publishes "notification.created" events to another queue
3. API-Gateway consumes from this queue
4. Routes notifications to connected users based on user_id
```

**Recommended:** Start with Option A (simpler), upgrade to Option B if needed.

### 5. Frontend (React/Next.js)

**Role:** Display notifications and handle user interactions

**Components to Build:**
1. **Notification Bell Icon** - Shows unread count badge
2. **Notification Dropdown** - List of recent notifications
3. **Notification Item** - Single notification with click handler
4. **WebSocket Listener** - Receives real-time updates

**WebSocket Integration:**
```typescript
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8080/ws');
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'notification') {
      // Add to notification list
      setNotifications(prev => [message.data, ...prev]);
      // Update unread count
      setUnreadCount(prev => prev + 1);
      // Show toast notification
      toast.info(message.data.message);
    }
  };
  
  return () => ws.close();
}, []);
```

**Notification Click Handler:**
```typescript
function handleNotificationClick(notification: Notification) {
  // Mark as read
  await api.patch(`/api/notifications/${notification.id}/read`);
  
  // Navigate using the URL from notification
  router.push(notification.url);
  // e.g., /tasks/550e8400-e29b-41d4-a716-446655440000#comment-660e8400
  
  // Browser auto-scrolls to #comment-{id} anchor
}
```

## Data Flow Example

### Scenario: User creates a comment mentioning another user

1. **Frontend** sends POST request to API-Gateway:
   ```json
   POST /api/tasks/{taskId}/comments
   {
     "content": "Hey @john, can you review this?",
     "mentionedUsers": ["john"]
   }
   ```

2. **API-Gateway** forwards to Task-Service via gRPC

3. **Task-Service** creates comment in database, then publishes TWO events:

   **Event 1: Comment Created**
   ```json
   {
     "organizationId": "org-123",
     "triggerUserId": "user-456",
     "recipients": ["assignee-uuid", "reporter-uuid"],
     "eventType": "comment.created",
     "data": {
       "commentId": "comment-789",
       "taskId": "task-111",
       "taskTitle": "Fix authentication bug",
       "authorName": "Jane Doe"
     }
   }
   ```

   **Event 2: Comment Mentioned**
   ```json
   {
     "organizationId": "org-123",
     "triggerUserId": "user-456",
     "recipients": ["john-uuid"],
     "eventType": "comment.mentioned",
     "data": {
       "commentId": "comment-789",
       "taskId": "task-111",
       "taskTitle": "Fix authentication bug",
       "authorName": "Jane Doe",
       "mentionedUsers": ["john"]
     }
   }
   ```

4. **RabbitMQ** routes both events to `notifications` queue

5. **Notification-Service** consumes both events:
   - Creates 2 notifications for assignee and reporter (comment.created)
   - Creates 1 notification for John (comment.mentioned)
   - Each notification gets URL: `/tasks/task-111#comment-comment-789`

6. **API-Gateway** WebSocket:
   - Queries notification-service for new notifications
   - Pushes to connected clients (assignee, reporter, John)

7. **Frontend** receives WebSocket message:
   - Shows notification toast
   - Updates notification bell badge
   - When clicked, navigates to `/tasks/task-111#comment-comment-789`

## Configuration

### Task-Service

```env
RABBITMQ_URI=amqp://guest:guest@rabbitmq:5672/
```

### Notification-Service

```env
DATABASE_URL=postgres://user:pass@notification-db:5432/notifications?sslmode=disable
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
GRPC_PORT=50055
```

### API-Gateway

```env
NOTIFICATION_SERVICE_ADDR=notification-service:50055
RABBITMQ_URI=amqp://guest:guest@rabbitmq:5672/ # Only if using Option B
```

## Advantages of This Architecture

✅ **Decoupled:** Task-service doesn't need to know about notification-service
✅ **Scalable:** Can run multiple notification-service instances
✅ **Reliable:** RabbitMQ ensures messages aren't lost
✅ **Flexible:** Easy to add new notification types
✅ **Efficient:** Database stores notifications for history/pagination
✅ **Real-time:** WebSocket delivers instant updates to users

## Next Steps

1. ✅ Task-service publishes events
2. ✅ Notification-service consumes events and stores in DB
3. ✅ gRPC API for querying notifications
4. ⏳ API-Gateway HTTP endpoints (REST)
5. ⏳ API-Gateway WebSocket integration
6. ⏳ Frontend notification UI
7. ⏳ Remove old task event logic
