# Notification Service Infrastructure Setup

## ✅ Completed Infrastructure Setup

### 1. **Docker Configuration**

#### Dockerfile (`infra/dev/docker/notification-service.Dockerfile`)
- ✅ Created Alpine-based Dockerfile
- ✅ Follows same pattern as other microservices
- ✅ Includes shared libraries and build artifacts

#### Build Script (`infra/dev/docker/notification-service-build.bat`)
- ✅ Created Windows build script for cross-compilation
- ✅ Builds Linux binary for Docker container

---

### 2. **Kubernetes Secrets** (`infra/dev/k8s/secrets.yaml`)

#### Added `notification-db-secret`:
```yaml
POSTGRES_DB: notification_service
POSTGRES_USER: notification_service
POSTGRES_PASSWORD: notification_service
```

---

### 3. **Database Configuration** (`infra/dev/k8s/notification-db.yaml`)

#### PostgreSQL StatefulSet:
- **Image:** `postgres:15`
- **Port:** `5432`
- **Storage:** 1Gi persistent volume
- **Secret:** Uses `notification-db-secret`

#### Service:
- **Name:** `notification-db`
- **Port:** `5432`
- **Selector:** `app: notification-db`

---

### 4. **Notification Service Deployment** (`infra/dev/k8s/notification-service.yaml`)

#### Deployment Configuration:
- **Image:** `task-flow/notification-service`
- **Replicas:** 1
- **Ports:**
  - gRPC: `50055`
  - Metrics: `9090` (Prometheus)

#### Resource Limits:
- **Requests:** 100m CPU, 128Mi memory
- **Limits:** 500m CPU, 256Mi memory

#### Environment Variables:
```yaml
GRPC_PORT: "50055"
ENVIRONMENT: "development"
JAEGER_ENDPOINT: "http://jaeger:14268/api/traces"
RABBITMQ_URL: <from secret>
NOTIFICATION_DB_HOST: notification-db
NOTIFICATION_DB_PORT: "5432"
NOTIFICATION_DB_USER: <from secret>
NOTIFICATION_DB_PASSWORD: <from secret>
NOTIFICATION_DB_NAME: <from secret>
DATABASE_URL: <constructed from above>
```

#### Health Checks:
- **Readiness Probe:** TCP socket on port 50055, 5s initial delay
- **Liveness Probe:** TCP socket on port 50055, 10s initial delay

#### Service:
- **Name:** `notification-service`
- **Port:** `50055`
- **Protocol:** gRPC

---

### 5. **Tiltfile Updates**

#### Added notification-db resource:
```tiltfile
k8s_yaml('infra/dev/k8s/notification-db.yaml')
k8s_resource('notification-db', labels='databases')
```

#### Added notification-service build and deployment:
```tiltfile
### Notification Service ###
notification_compile_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/notification-service ./services/notification-service'
if os.name == 'nt':
  notification_compile_cmd = './infra/dev/docker/notification-service-build.bat'

local_resource(
  'notification-service-compile',
  notification_compile_cmd,
  deps=['./services/notification-service', './shared'], 
  labels="compiles"
)

docker_build_with_restart(
  'task-flow/notification-service',
  '.',
  entrypoint=['/app/build/notification-service'],
  dockerfile='./infra/dev/docker/notification-service.Dockerfile',
  only=['./build/notification-service', './shared'],
  live_update=[
    sync('./build', '/app/build'),
    sync('./shared', '/app/shared'),
  ],
)

k8s_yaml('./infra/dev/k8s/notification-service.yaml')
k8s_resource(
  'notification-service', 
  resource_deps=['notification-service-compile', 'notification-db', 'rabbitmq'], 
  labels="services"
)
```

#### Updated API Gateway dependencies:
```tiltfile
k8s_resource('api-gateway', port_forwards=8081,
  resource_deps=[
    'api-gateway-compile', 
    'rabbitmq', 
    'auth-service', 
    'user-service', 
    'organization-service', 
    'task-service', 
    'notification-service'  # <- Added
  ], 
  labels="services"
)
```

---

### 6. **API Gateway Configuration** (`infra/dev/k8s/api-gateway-deployment.yaml`)

#### Added environment variable:
```yaml
- name: NOTIFICATION_SERVICE_ADDR
  value: "notification-service:50055"
```

---

## 📊 Service Architecture

### Service Dependencies:

```
┌─────────────────┐
│   API Gateway   │
│   (port 8081)   │
└────────┬────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌─────────────────────┐           ┌──────────────────────┐
│ Notification Service│◄──────────│     RabbitMQ         │
│    (port 50055)     │           │  (notifications      │
└──────────┬──────────┘           │      queue)          │
           │                      └──────────────────────┘
           │                               ▲
           ▼                               │
┌─────────────────────┐                   │
│  Notification DB    │                   │
│  (PostgreSQL 15)    │      ┌────────────┴────────────┐
└─────────────────────┘      │    Task Service         │
                             │ (publishes task events) │
                             └─────────────────────────┘
```

### Event Flow:

1. **Task Service** → Publishes notification events to RabbitMQ
2. **RabbitMQ** → Routes events to notifications queue
3. **Notification Service** → Consumes events, stores in DB
4. **API Gateway** → Queries notification-service via gRPC
5. **API Gateway** → Pushes notifications to frontend via WebSocket

---

## 🚀 Deployment Commands

### Build and Deploy:
```bash
# Build all services (includes notification-service)
make build

# Start all services with Tilt
tilt up

# Watch logs
tilt logs notification-service
tilt logs notification-db
```

### Verify Deployment:
```bash
# Check if notification-service is running
kubectl get pods | grep notification

# Check service endpoints
kubectl get svc notification-service

# Check database
kubectl get statefulset notification-db

# Test gRPC connectivity from another pod
kubectl exec -it deployment/api-gateway -- sh -c 'nc -zv notification-service 50055'
```

### Check Logs:
```bash
# Notification service logs
kubectl logs -f deployment/notification-service

# Database logs
kubectl logs -f statefulset/notification-db

# API Gateway logs (to see notification integration)
kubectl logs -f deployment/api-gateway
```

---

## 🧪 Testing Checklist

### Infrastructure Tests:

- [ ] **Database:** notification-db pod is running
- [ ] **Database:** Persistent volume created (1Gi)
- [ ] **Service:** notification-service pod is running
- [ ] **Service:** gRPC port 50055 is accessible
- [ ] **Service:** Metrics port 9090 is accessible
- [ ] **Secrets:** notification-db-secret exists
- [ ] **Environment:** DATABASE_URL is correctly constructed
- [ ] **RabbitMQ:** Connection established
- [ ] **Migrations:** Notifications table auto-created

### Service Tests:

#### From API Gateway:
```bash
# Test gRPC connection
kubectl exec deployment/api-gateway -- sh -c 'nc -zv notification-service 50055'
```

#### From Notification Service Logs:
```bash
kubectl logs deployment/notification-service
# Should see:
# - "Database connected and migrated"
# - "RabbitMQ connected"
# - "gRPC server listening on :50055"
```

#### Database Test:
```bash
# Connect to notification DB
kubectl exec -it statefulset/notification-db -- psql -U notification_service -d notification_service

# Check tables
\dt

# Should see 'notifications' table
```

---

## 📁 Files Created/Modified

### New Files:
1. `infra/dev/docker/notification-service.Dockerfile`
2. `infra/dev/docker/notification-service-build.bat`
3. `infra/dev/k8s/notification-db.yaml`
4. `infra/dev/k8s/notification-service.yaml`

### Modified Files:
1. `infra/dev/k8s/secrets.yaml` - Added notification-db-secret
2. `infra/dev/k8s/api-gateway-deployment.yaml` - Added NOTIFICATION_SERVICE_ADDR
3. `Tiltfile` - Added notification-service build, docker, k8s resources

---

## 🔧 Configuration Summary

### Ports:
- **Notification Service gRPC:** `50055`
- **Notification DB:** `5432`
- **Metrics:** `9090`

### Database:
- **Name:** `notification_service`
- **User:** `notification_service`
- **Host:** `notification-db`
- **Storage:** 1Gi persistent volume

### Dependencies:
- **notification-service** depends on:
  - notification-db (database)
  - rabbitmq (messaging)
  - notification-service-compile (build)

- **api-gateway** depends on:
  - notification-service (gRPC calls)

### Labels:
- **notification-db:** `databases`
- **notification-service:** `services`
- **notification-service-compile:** `compiles`

---

## 🎯 Next Steps

1. **Build Services:**
   ```bash
   make build
   ```

2. **Deploy with Tilt:**
   ```bash
   tilt up
   ```

3. **Monitor Startup:**
   - Watch Tilt UI at http://localhost:10350
   - Check "services" group for notification-service
   - Check "databases" group for notification-db

4. **Test End-to-End:**
   - Create a task in frontend
   - Check notification-service logs for event consumption
   - Check notification-db for stored notifications
   - Check API Gateway logs for gRPC calls
   - Verify frontend receives notification via WebSocket

---

**Status:** ✅ **All infrastructure setup complete and ready for deployment!**
