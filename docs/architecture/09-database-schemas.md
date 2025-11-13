# Database Schemas

Entity-relationship diagrams for all service databases.

## Auth Service Database

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        string email UK
        string password_hash
        string status
        string user_type
        timestamp created_at
        timestamp updated_at
    }
    
    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        string token_hash UK
        timestamp expires_at
        boolean revoked
        timestamp created_at
    }
    
    AUTH_USERS ||--o{ REFRESH_TOKENS : "has"
```

### Auth Users Table
- Stores authentication credentials
- Email is unique constraint
- Password stored as bcrypt hash
- Status: active, disabled, pending
- User type: admin, user

### Refresh Tokens Table
- Stores refresh token hashes
- One user can have multiple tokens (different devices)
- Tokens can be revoked
- Automatic cleanup of expired tokens

---

## User Service Database

```mermaid
erDiagram
    USERS {
        uuid id PK
        string email UK
        string first_name
        string last_name
        string status
        string user_type
        timestamp created_at
        timestamp updated_at
    }
    
    ROLES {
        uuid id PK
        string name UK
        string description
        timestamp created_at
    }
    
    USER_ROLES {
        uuid user_id FK
        uuid role_id FK
    }
    
    USERS ||--o{ USER_ROLES : "has"
    ROLES ||--o{ USER_ROLES : "assigned_to"
```

### Users Table
- User profile information
- Email matches auth service
- First and last name for display
- Status and type for permissions

### Roles Table
- Predefined roles: admin, user, guest
- Auto-created if missing during user creation
- Extensible for custom roles

### User Roles Table
- Many-to-many relationship
- Users can have multiple roles
- Roles can be assigned to multiple users

---

## Organization Service Database

```mermaid
erDiagram
    ORGANIZATIONS {
        uuid id PK
        string name
        string description
        timestamp created_at
        timestamp updated_at
    }
    
    ORGANIZATION_MEMBERS {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        string role
        timestamp joined_at
        timestamp created_at
        timestamp updated_at
    }
    
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : "has"
```

### Organizations Table
- Organization metadata
- Name and description
- Created by field (not shown) tracks creator

### Organization Members Table
- Links users to organizations
- Role: admin, member, viewer
- Joined timestamp for analytics
- Composite unique constraint on (organization_id, user_id)

---

## Task Service Database

```mermaid
erDiagram
    TASKS {
        uuid id PK
        uuid organization_id FK
        string title
        string description
        string status
        string priority
        uuid assignee_id FK
        uuid reporter_id FK
        timestamp due_at
        timestamp created_at
        timestamp updated_at
    }
```

### Tasks Table
- Task information and metadata
- Organization ID for access control
- Status: open, in_progress, completed, blocked, cancelled
- Priority: low, medium, high, urgent
- Assignee and reporter reference users (not foreign keys to avoid cross-db dependencies)
- Due date optional
- Indexed on organization_id and status for efficient queries

---

## Database Isolation

Each service has its own database to:
- **Independence**: Services can be deployed separately
- **Scalability**: Databases can scale independently
- **Resilience**: Failure in one database doesn't affect others
- **Technology Choice**: Each service can use optimal database technology

## Data Consistency

- **User IDs** are shared across services but not enforced by foreign keys
- **Eventual Consistency** through event-driven updates
- **Idempotency** in event handlers to handle duplicate messages
- **Compensation** mechanisms for failed operations

## Migrations

- Each service manages its own migrations
- **GORM AutoMigrate** used for development
- Production should use versioned migration tools (e.g., golang-migrate)
- Backward-compatible schema changes

## Backup Strategy

- Regular automated backups per database
- Point-in-time recovery enabled
- Backup retention policy (30 days)
- Regular restore testing
