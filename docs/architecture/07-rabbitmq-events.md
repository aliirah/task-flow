# RabbitMQ Event Architecture

Event-driven messaging architecture for real-time updates.

```mermaid
graph TD
    subgraph Exchange
        EX[events Exchange<br/>Type: topic]
    end

    subgraph Queues
        Q1[task-events Queue]
    end

    subgraph Event Types
        E1[task.event.created]
        E2[task.event.updated]
        E3[task.{organizationId}.*]
    end

    subgraph Publishers
        TS[Task Service]
    end

    subgraph Consumers
        GW[API Gateway<br/>WebSocket Broadcaster]
    end

    TS -->|Publish Events| EX
    EX -->|Routing Key: task.*| Q1
    Q1 -->|Subscribe| GW
    GW -->|Broadcast| WSC[WebSocket Clients]

    E1 -.-> EX
    E2 -.-> EX
    E3 -.-> EX

    style Exchange fill:#ffccbc
    style Publishers fill:#c8e6c9
    style Consumers fill:#fff9c4
    style Event Types fill:#e1f5ff
    style Queues fill:#d1c4e9
```

## Components

### Exchange
- **Name**: `events`
- **Type**: `topic`
- **Durable**: Yes
- **Purpose**: Routes messages based on routing keys

### Queues
- **task-events**: Receives all task-related events
- **Binding**: `task.*` (matches all task events)
- **Consumers**: API Gateway

### Event Types

#### task.event.created
Published when a new task is created.

#### task.event.updated
Published when a task is updated (status, assignee, priority, etc.).

#### Routing Keys
- Pattern: `task.{organizationId}.{eventType}`
- Example: `task.550e8400-e29b-41d4-a716-446655440000.created`

## Event Message Structure

```json
{
  "organization_id": "uuid",
  "user_id": "uuid",
  "event_type": "task.event.created",
  "data": {
    "task_id": "uuid",
    "organization_id": "uuid",
    "title": "Task Title",
    "description": "Task Description",
    "status": "open",
    "priority": "high",
    "assignee_id": "uuid",
    "reporter_id": "uuid",
    "assignee": {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com"
    },
    "reporter": {
      "id": "uuid",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane@example.com"
    },
    "triggered_by": {
      "id": "uuid",
      "first_name": "Admin",
      "last_name": "User",
      "email": "admin@example.com"
    },
    "due_at": "2025-12-31T23:59:59Z",
    "created_at": "2025-11-12T10:00:00Z",
    "updated_at": "2025-11-12T10:00:00Z"
  }
}
```

## Publisher Flow

1. Task service performs operation (create/update)
2. Event data prepared with full context
3. Message published to exchange with routing key
4. RabbitMQ routes message to appropriate queues
5. Consumers receive and process messages

## Consumer Flow

1. API Gateway subscribes to task-events queue
2. Messages consumed from queue
3. Events filtered by organization membership
4. WebSocket broadcasts to relevant clients

## Benefits

- **Decoupling**: Services don't need direct communication
- **Scalability**: Multiple consumers can process events
- **Reliability**: Messages persisted until processed
- **Real-time**: Instant updates to connected clients
