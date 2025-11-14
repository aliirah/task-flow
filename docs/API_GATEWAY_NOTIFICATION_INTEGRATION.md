# API Gateway Notification Integration Plan

## Current State

### Existing Old Logic (To Be Removed/Updated)
**File:** `services/api-gateway/internal/event/task_consumer.go`

Currently consumes:
- `task.created` - Old task created events
- `task.updated` - Old task updated events

This consumer:
1. Listens to RabbitMQ task events
2. Converts them to WebSocket messages
3. Broadcasts to connected clients in the organization

**This needs to be removed or updated** because:
- We now have notification-service handling these events
- Notifications are stored in database first
- We want a different approach for real-time delivery

## New Architecture

### Flow Overview

```
Task-Service
    ↓ Publishes notification events
RabbitMQ (EventExchange → notifications queue)
    ↓ Consumed by
Notification-Service
    ↓ Creates DB records
    ↓ Stores in PostgreSQL
    ↓ Serves via gRPC
API-Gateway
    ↓ Option 1: Poll & Push OR Option 2: Event-Driven
WebSocket
    ↓ Push to clients
Frontend
```

### Option 1: Poll and Push (Recommended for MVP)

**Approach:** API-Gateway actively queries notification-service when users connect

**Pros:**
- Simpler implementation
- No additional RabbitMQ setup
- Easy to debug
- Works well for moderate traffic

**Cons:**
- Slight delay (polling interval)
- More database queries

**Implementation:**

1. **Add gRPC Client in API Gateway**
   ```go
   // In main.go
   notifConn, err := grpc.Dial("notification-service:50055", ...)
   notifClient := notificationpb.NewNotificationServiceClient(notifConn)
   ```

2. **WebSocket Connection Handler**
   ```go
   // When user connects to WebSocket
   func handleWebSocket(w http.ResponseWriter, r *http.Request) {
       conn, _ := upgrader.Upgrade(w, r, nil)
       userID := getUserIDFromContext(r.Context())
       
       // Start polling for notifications
       go pollNotifications(userID, conn)
   }
   
   func pollNotifications(userID string, conn *websocket.Conn) {
       ticker := time.NewTicker(2 * time.Second)
       defer ticker.Stop()
       
       lastCheck := time.Now()
       
       for range ticker.C {
           // Query new notifications since last check
           resp, err := notifClient.ListNotifications(ctx, &notificationpb.ListNotificationsRequest{
               UserId: userID,
               Since: timestamppb.New(lastCheck),
               Limit: 50,
           })
           
           for _, notif := range resp.Items {
               // Send to WebSocket
               conn.WriteJSON(map[string]interface{}{
                   "type": "notification",
                   "data": notif,
               })
           }
           
           lastCheck = time.Now()
       }
   }
   ```

3. **HTTP REST Endpoints**
   ```go
   // GET /api/notifications
   func listNotifications(c *gin.Context) {
       userID := c.GetString("userID")
       page := c.DefaultQuery("page", "1")
       limit := c.DefaultQuery("limit", "20")
       unreadOnly := c.Query("unreadOnly") == "true"
       
       resp, err := notifClient.ListNotifications(ctx, &notificationpb.ListNotificationsRequest{
           UserId: userID,
           Page: parseInt(page),
           Limit: parseInt(limit),
           UnreadOnly: unreadOnly,
       })
       
       c.JSON(200, resp)
   }
   
   // GET /api/notifications/unread/count
   func getUnreadCount(c *gin.Context) {
       userID := c.GetString("userID")
       resp, err := notifClient.GetUnreadCount(ctx, &notificationpb.GetUnreadCountRequest{
           UserId: userID,
       })
       c.JSON(200, gin.H{"count": resp.Count})
   }
   
   // PATCH /api/notifications/:id/read
   func markAsRead(c *gin.Context) {
       notifID := c.Param("id")
       _, err := notifClient.MarkAsRead(ctx, &notificationpb.MarkAsReadRequest{
           Id: notifID,
       })
       c.JSON(200, gin.H{"success": true})
   }
   
   // POST /api/notifications/mark-all-read
   func markAllAsRead(c *gin.Context) {
       userID := c.GetString("userID")
       resp, err := notifClient.MarkAllAsRead(ctx, &notificationpb.MarkAllAsReadRequest{
           UserId: userID,
       })
       c.JSON(200, gin.H{"count": resp.Count})
   }
   
   // DELETE /api/notifications/:id
   func deleteNotification(c *gin.Context) {
       notifID := c.Param("id")
       _, err := notifClient.DeleteNotification(ctx, &notificationpb.DeleteNotificationRequest{
           Id: notifID,
       })
       c.JSON(200, gin.H{"success": true})
   }
   ```

### Option 2: Event-Driven (For Future Optimization)

**Approach:** Notification-service publishes additional events when notifications are created

**Flow:**
1. Notification-service creates notification in DB
2. Publishes `notification.created` event to RabbitMQ
3. API-Gateway consumes this event
4. Routes to appropriate WebSocket connections by user_id

**Pros:**
- Real-time (no polling delay)
- More efficient
- Scales better

**Cons:**
- More complex
- Requires additional RabbitMQ setup
- Need to handle WebSocket connection tracking

**Implementation (Future):**

1. **Notification-Service Publishes After Creating:**
   ```go
   // In notification-service consumer
   func (c *NotificationConsumer) handleMessage(msg amqp.Delivery) {
       // ... create notification in DB ...
       
       // Publish notification.created event
       event := NotificationCreatedEvent{
           NotificationID: notification.ID,
           UserID: notification.UserID,
           OrganizationID: notification.OrganizationID,
           // ... all notification fields
       }
       publisher.Publish("notification.created", event)
   }
   ```

2. **API-Gateway Consumes:**
   ```go
   // New consumer in api-gateway
   type NotificationConsumer struct {
       rmq     *RabbitMQ
       connMgr *ConnectionManager
   }
   
   func (c *NotificationConsumer) Listen() {
       // Consume from notification.created queue
       // Route to WebSocket connections by user_id
   }
   ```

## What to Do Now

### Step 1: Remove/Update Old Task Consumer

**Option A: Remove completely** (if only used for task events)
```bash
rm services/api-gateway/internal/event/task_consumer.go
```

Update `main.go`:
```go
// Remove these lines:
taskEventConsumer := gatewayevent.NewTaskEventConsumer(rabbitmq, connMgr)
go func() {
    if err := taskEventConsumer.Listen(); err != nil {
        log.Error(fmt.Errorf("failed to start task event consumer: %w", err))
    }
}()
```

**Option B: Keep for other events** (if used for non-notification events)
- Update to ignore notification events
- Keep for any other task-related WebSocket broadcasts

### Step 2: Add Notification gRPC Client

**File:** `services/api-gateway/main.go`

```go
import (
    notificationpb "github.com/aliirah/task-flow/shared/proto/notification/v1"
)

// Add to main()
notifAddr := env.GetString("NOTIFICATION_SERVICE_ADDR", "notification-service:50055")
notifConn, err := grpc.Dial(notifAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
if err != nil {
    log.Fatal(fmt.Errorf("failed to connect to notification service: %w", err))
}
defer notifConn.Close()

notifClient := notificationpb.NewNotificationServiceClient(notifConn)
```

### Step 3: Create HTTP Endpoints

**File:** `services/api-gateway/routes/notification.go` (new file)

```go
package routes

import (
    "github.com/gin-gonic/gin"
    notificationpb "github.com/aliirah/task-flow/shared/proto/notification/v1"
)

func RegisterNotificationRoutes(r *gin.RouterGroup, client notificationpb.NotificationServiceClient) {
    notif := r.Group("/notifications")
    {
        notif.GET("", listNotifications(client))
        notif.GET("/unread/count", getUnreadCount(client))
        notif.PATCH("/:id/read", markAsRead(client))
        notif.POST("/mark-all-read", markAllAsRead(client))
        notif.DELETE("/:id", deleteNotification(client))
    }
}

func listNotifications(client notificationpb.NotificationServiceClient) gin.HandlerFunc {
    return func(c *gin.Context) {
        // Implementation from Option 1 above
    }
}

// ... other handlers
```

Register in main.go:
```go
api := r.Group("/api")
routes.RegisterNotificationRoutes(api, notifClient)
```

### Step 4: Update WebSocket (Optional for MVP)

For now, you can:
1. Keep WebSocket as-is for other real-time features
2. Frontend polls `/api/notifications` periodically
3. Later, add WebSocket push using Option 1 polling approach

### Step 5: Environment Variables

Add to `infra/dev/docker-compose.yml`:
```yaml
api-gateway:
  environment:
    - NOTIFICATION_SERVICE_ADDR=notification-service:50055
```

## Summary

**Immediate Actions:**
1. ✅ Remove or update old task event consumer
2. ✅ Add notification-service gRPC client to API Gateway
3. ✅ Create HTTP REST endpoints for notification operations
4. ✅ Update frontend to call `/api/notifications` endpoints
5. ⏳ (Optional) Add WebSocket push for real-time delivery

**For Real-Time Notifications:**
- Start with Option 1 (Poll & Push) - simpler, works well
- Upgrade to Option 2 (Event-Driven) later if needed

**Old vs New:**
- **Old:** Task-Service → RabbitMQ → API-Gateway → WebSocket → Frontend
- **New:** Task-Service → RabbitMQ → Notification-Service (DB) → API-Gateway (gRPC) → HTTP/WebSocket → Frontend

The key difference: Notifications are now **persistent in database** and served via gRPC, not ephemeral RabbitMQ events.
