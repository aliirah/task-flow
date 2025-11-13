# High-Level Architecture

Complete system architecture showing all services, databases, and infrastructure components.

```mermaid
graph TB
    subgraph Client Layer
        WEB[Web Client<br/>Next.js]
    end

    subgraph API Layer
        GW[API Gateway<br/>:8081]
    end

    subgraph Microservices
        AUTH[Auth Service<br/>:50051]
        USER[User Service<br/>:50052]
        ORG[Organization Service<br/>:50053]
        TASK[Task Service<br/>:50054]
    end

    subgraph Message Broker
        RMQ[RabbitMQ<br/>AMQP :5672]
    end

    subgraph Databases
        AUTHDB[(Auth DB<br/>PostgreSQL)]
        USERDB[(User DB<br/>PostgreSQL)]
        ORGDB[(Org DB<br/>PostgreSQL)]
        TASKDB[(Task DB<br/>PostgreSQL)]
    end

    subgraph Observability
        JAEGER[Jaeger<br/>Tracing]
        PROM[Prometheus<br/>Metrics]
        GRAF[Grafana<br/>Dashboards]
    end

    WEB -->|HTTP/WebSocket| GW
    GW -->|gRPC| AUTH
    GW -->|gRPC| USER
    GW -->|gRPC| ORG
    GW -->|gRPC| TASK

    AUTH -->|gRPC| USER
    TASK -->|gRPC| USER
    TASK -->|gRPC| ORG

    GW <-->|Subscribe/Publish| RMQ
    TASK -->|Publish Events| RMQ

    AUTH --> AUTHDB
    USER --> USERDB
    ORG --> ORGDB
    TASK --> TASKDB

    GW -.->|Traces| JAEGER
    AUTH -.->|Traces| JAEGER
    USER -.->|Traces| JAEGER
    ORG -.->|Traces| JAEGER
    TASK -.->|Traces| JAEGER

    GW -.->|Metrics| PROM
    AUTH -.->|Metrics| PROM
    USER -.->|Metrics| PROM
    ORG -.->|Metrics| PROM
    TASK -.->|Metrics| PROM

    PROM -.-> GRAF

    style Client Layer fill:#e1f5ff
    style API Layer fill:#fff9c4
    style Microservices fill:#c8e6c9
    style Message Broker fill:#ffccbc
    style Databases fill:#d1c4e9
    style Observability fill:#f8bbd0
```

## Components

### Client Layer
- **Web Client**: Next.js React application served on port 3000

### API Layer
- **API Gateway**: Single entry point for all client requests (port 8081)
  - REST API endpoints
  - WebSocket server for real-time updates
  - JWT validation
  - Request routing

### Microservices
- **Auth Service** (port 50051): Authentication and authorization
- **User Service** (port 50052): User profile and role management
- **Organization Service** (port 50053): Organization and membership management
- **Task Service** (port 50054): Task CRUD and event publishing

### Message Broker
- **RabbitMQ**: Event-driven messaging for real-time updates

### Databases
- Each service has its own PostgreSQL database
- Independent data stores for service isolation

### Observability
- **Jaeger**: Distributed tracing across all services
- **Prometheus**: Metrics collection
- **Grafana**: Visualization and dashboards
