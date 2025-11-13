# Task Creation Flow

Complete flow for creating a new task with real-time notifications.

```mermaid
sequenceDiagram
    participant User
    participant WebClient
    participant APIGateway
    participant TaskService
    participant UserService
    participant OrgService
    participant RabbitMQ
    participant TaskDB

    User->>WebClient: Create New Task
    WebClient->>APIGateway: POST /api/tasks
    Note over APIGateway: Extract JWT & User Context
    
    APIGateway->>TaskService: gRPC: CreateTask
    
    TaskService->>UserService: gRPC: GetUser (Reporter)
    UserService-->>TaskService: Reporter Details
    
    alt Assignee Specified
        TaskService->>UserService: gRPC: GetUser (Assignee)
        UserService-->>TaskService: Assignee Details
    end
    
    TaskService->>TaskDB: Insert Task
    TaskDB-->>TaskService: Task Created
    
    TaskService->>RabbitMQ: Publish task.event.created
    Note right of TaskService: Event: New task created with details
    
    TaskService-->>APIGateway: Task Response
    APIGateway-->>WebClient: Task Created
    
    RabbitMQ-->>APIGateway: task.event.created
    Note right of APIGateway: Consume event from queue
    
    APIGateway->>WebClient: WebSocket: task.event.created
    Note right of APIGateway: Real-time notification
    
    WebClient-->>User: Show Task Created Notification
```

## Process Steps

1. **Task Input**: User fills task form (title, description, assignee, priority, due date)
2. **Authentication**: API Gateway extracts user context from JWT
3. **User Details**: Task service fetches reporter and assignee details
4. **Database Insert**: Task saved to task database
5. **Event Publishing**: Task creation event published to RabbitMQ
6. **HTTP Response**: Immediate response to web client
7. **Real-time Update**: Event consumed and broadcast via WebSocket to all organization members

## Event Payload

```json
{
  "event_type": "task.event.created",
  "organization_id": "uuid",
  "data": {
    "task_id": "uuid",
    "title": "Task Title",
    "description": "Description",
    "status": "open",
    "priority": "high",
    "assignee": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
    "reporter": { "id": "uuid", "first_name": "Jane", "last_name": "Smith" },
    "due_at": "2025-12-31T23:59:59Z"
  }
}
```

## Real-Time Features

- All organization members receive instant notification
- WebSocket connection maintains live updates
- No polling required for task list refresh
