# Technology Stack

Comprehensive list of technologies, frameworks, and tools used in the system.

## Backend Services

### Language & Runtime
- **Go**: 1.21+
- **Build Tool**: Go modules
- **Package Manager**: Go modules

### API Protocols
- **gRPC**: Inter-service communication
- **Protocol Buffers**: Service definitions and serialization
- **REST**: Client-facing HTTP API
- **WebSocket**: Real-time bidirectional communication

### Databases
- **PostgreSQL**: 15+
- **ORM**: GORM (Go)
- **Migration**: GORM AutoMigrate (dev), golang-migrate (prod)

### Message Queue
- **RabbitMQ**: 3.12+
- **Protocol**: AMQP 0-9-1
- **Client**: amqp091-go

### Authentication & Security
- **JWT**: JSON Web Tokens
- **Token Library**: golang-jwt/jwt
- **Password Hashing**: bcrypt
- **Token Types**: Access (1h) + Refresh (30 days)

### Observability

#### Distributed Tracing
- **Jaeger**: 1.50+
- **OpenTelemetry**: Go SDK
- **Instrumentation**: HTTP, gRPC, Database

#### Metrics
- **Prometheus**: 2.47+
- **Client**: prometheus/client_golang
- **Metrics Types**: Counter, Gauge, Histogram

#### Visualization
- **Grafana**: 10.0+
- **Dashboards**: Service metrics, traces

#### Logging
- **Zap**: Structured logging
- **Format**: JSON
- **Levels**: debug, info, warn, error

---

## Frontend

### Framework & Language
- **Next.js**: 16.0 (Turbopack)
- **React**: 18+
- **TypeScript**: 5+
- **Node.js**: 20+

### Styling
- **Tailwind CSS**: 3+
- **CSS Modules**: Component-scoped styles
- **PostCSS**: CSS processing

### State Management
- **Zustand**: Lightweight state management
- **React Context**: Auth state
- **SWR/React Query**: Server state (optional)

### HTTP & Real-Time
- **Fetch API**: HTTP requests
- **WebSocket**: Native browser WebSocket
- **Axios**: Alternative HTTP client (if needed)

### UI Components
- **shadcn/ui**: Component library
- **Radix UI**: Headless UI primitives
- **Lucide Icons**: Icon library

### Development Tools
- **ESLint**: Code linting
- **Prettier**: Code formatting (optional)
- **TypeScript**: Type checking

---

## Infrastructure

### Container Runtime
- **Docker**: 24+
- **Docker Compose**: For local multi-container setup

### Orchestration
- **Kubernetes**: 1.28+
- **Minikube**: Local Kubernetes cluster
- **kubectl**: Kubernetes CLI

### Development Tools
- **Tilt**: Local Kubernetes development
- **Hot Reload**: Automatic service updates
- **Port Forwarding**: Access services locally

### CI/CD (Future)
- **GitHub Actions**: Automated workflows
- **Docker Registry**: Container image storage
- **Helm**: Kubernetes package manager

---

## Development Tools

### Version Control
- **Git**: Source control
- **GitHub**: Repository hosting

### IDEs & Editors
- **VS Code**: Recommended editor
- **GoLand**: Go IDE alternative
- **Cursor**: AI-powered editor

### API Testing
- **Postman**: API testing
- **cURL**: Command-line HTTP client
- **grpcurl**: gRPC command-line client

### Database Tools
- **psql**: PostgreSQL CLI
- **pgAdmin**: PostgreSQL GUI
- **DBeaver**: Universal database tool

---

## Deployment

### Container Registry
- **Docker Hub**: Public images
- **Private Registry**: Production images

### Cloud Providers (Future)
- **AWS**: EKS, RDS, ElastiCache
- **GCP**: GKE, Cloud SQL
- **Azure**: AKS, Azure Database

### Secrets Management
- **Kubernetes Secrets**: Dev environment
- **HashiCorp Vault**: Production secrets
- **AWS Secrets Manager**: AWS deployments

### Load Balancing
- **Kubernetes Ingress**: Internal routing
- **NGINX**: Ingress controller
- **Cloud Load Balancer**: Production

---

## Monitoring & Operations

### APM (Future)
- **Datadog**: Full-stack monitoring
- **New Relic**: Application performance
- **Sentry**: Error tracking

### Log Aggregation (Future)
- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **Loki**: Log aggregation
- **Fluentd**: Log forwarding

### Alerting (Future)
- **Prometheus Alertmanager**: Metric-based alerts
- **PagerDuty**: On-call management
- **Slack**: Notification integration

---

## Service Versions

| Service | Port | Protocol | Version |
|---------|------|----------|---------|
| API Gateway | 8081 | HTTP/WS | v1 |
| Auth Service | 50051 | gRPC | v1 |
| User Service | 50052 | gRPC | v1 |
| Organization Service | 50053 | gRPC | v1 |
| Task Service | 50054 | gRPC | v1 |
| Web Client | 3000 | HTTP | v1 |
| RabbitMQ | 5672, 15672 | AMQP, HTTP | 3.12 |
| PostgreSQL | 5432 | TCP | 15 |
| Jaeger | 16686, 14268 | HTTP | 1.50 |
| Prometheus | 9090 | HTTP | 2.47 |
| Grafana | 3001 | HTTP | 10.0 |

---

## Development Requirements

### Minimum System Requirements
- **OS**: macOS, Linux, Windows (WSL2)
- **CPU**: 4 cores
- **RAM**: 8GB (16GB recommended)
- **Disk**: 20GB free space

### Required Software
- Docker Desktop
- Minikube
- kubectl
- Tilt
- Go (for local development)
- Node.js & Yarn (for frontend)

### Optional Software
- Go IDE (GoLand, VS Code with Go extension)
- Database client (pgAdmin, DBeaver)
- API testing tool (Postman, Insomnia)
- Git client
