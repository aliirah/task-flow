# Task Flow

A microservices-based task management system built with Go backend services and a Next.js frontend. The system uses gRPC for inter-service communication, RabbitMQ for event-driven messaging, and WebSockets for real-time updates.

## 🏗️ Architecture

- **API Gateway**: REST API and WebSocket gateway (Port 8081)
- **Auth Service**: Authentication and authorization
- **User Service**: User management
- **Organization Service**: Organization and membership management
- **Task Service**: Task CRUD and assignment
- **Web Client**: Next.js React frontend (Port 3000)

### Technology Stack

- **Backend**: Go, gRPC, PostgreSQL
- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Messaging**: RabbitMQ
- **Observability**: Jaeger (tracing), Prometheus (metrics), Grafana (visualization)
- **Development**: Docker, Kubernetes (Minikube), Tilt

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required Tools

1. **Docker Desktop**
   - Download: [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
   - Version: 20.10 or higher
   - Verify installation: `docker --version`

2. **Minikube**
   - Download: [https://minikube.sigs.k8s.io/docs/start/](https://minikube.sigs.k8s.io/docs/start/)
   - Version: 1.30 or higher
   - Verify installation: `minikube version`

3. **Kubectl** (usually installed with Docker Desktop or Minikube)
   - Download: [https://kubernetes.io/docs/tasks/tools/](https://kubernetes.io/docs/tasks/tools/)
   - Verify installation: `kubectl version --client`

4. **Tilt**
   - Download: [https://docs.tilt.dev/install.html](https://docs.tilt.dev/install.html)
   - Version: 0.33 or higher
   - Verify installation: `tilt version`

5. **Go** (for local development)
   - Download: [https://go.dev/dl/](https://go.dev/dl/)
   - Version: 1.21 or higher
   - Verify installation: `go version`

6. **Node.js and Yarn** (for frontend development)
   - Node.js: [https://nodejs.org/](https://nodejs.org/) (v20 or higher)
   - Yarn: [https://yarnpkg.com/getting-started/install](https://yarnpkg.com/getting-started/install)
   - Verify: `node --version && yarn --version`

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/aliirah/task-flow.git
cd task-flow
```

### 2. Configure Secrets

Create your secrets configuration file:

```bash
cp infra/dev/k8s/secrets_example.yaml infra/dev/k8s/secrets.yaml
```

Edit `infra/dev/k8s/secrets.yaml` and update the credentials as needed. For development, you can use the default values.

⚠️ **Important**: Never commit `secrets.yaml` to version control. It's already in `.gitignore`.

### 3. Start Minikube

Start your local Kubernetes cluster:

```bash
# Start Minikube with recommended resources
minikube start --cpus=4 --memory=8192 --driver=docker

# Verify Minikube is running
minikube status
```

### 4. Launch with Tilt

Start all services using Tilt:

```bash
# From the project root directory
tilt up
```

Tilt will:
- Build all Docker images
- Deploy services to Kubernetes
- Set up port forwarding
- Enable hot-reloading for rapid development

Press **space** to open the Tilt UI in your browser, or visit [http://localhost:10350](http://localhost:10350)

### 5. Access the Application

Once all services are running (green in Tilt UI):

- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **API Gateway**: [http://localhost:8081](http://localhost:8081)
- **RabbitMQ Management**: [http://localhost:15672](http://localhost:15672) (guest/guest)
- **Tilt Dashboard**: [http://localhost:10350](http://localhost:10350)

## 🔧 Development Workflow

### Hot Reloading

Tilt automatically detects changes and updates services:

- **Go Services**: Recompiles and restarts on code changes
- **Web Client**: Hot-reloads on source file changes
- **Config Changes**: Automatically rebuilds when necessary

### Running Seeders

To populate databases with test data, use the manual triggers in Tilt UI:

```bash
# Or run manually from command line
./tools/go-seed user
./tools/go-seed auth
./tools/go-seed org
./tools/go-seed task
```

### Viewing Logs

In Tilt UI, click on any service to view its logs in real-time.

Or use kubectl:

```bash
kubectl logs -f deployment/api-gateway
kubectl logs -f deployment/web-client
```

### Building for Production

#### Backend Services

```bash
# Build all services
make build

# Build specific service
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/auth-service ./services/auth-service
```

#### Frontend

```bash
cd web/client
yarn build
yarn start
```

## 📁 Project Structure

```
task-flow/
├── services/              # Microservices
│   ├── api-gateway/      # REST API & WebSocket gateway
│   ├── auth-service/     # Authentication service
│   ├── user-service/     # User management
│   ├── organization-service/
│   └── task-service/
├── web/
│   └── client/           # Next.js frontend
├── shared/               # Shared Go packages
│   ├── proto/           # Generated gRPC code
│   ├── messaging/       # RabbitMQ utilities
│   ├── tracing/         # Distributed tracing
│   └── metrics/         # Prometheus metrics
├── proto/               # Protocol Buffer definitions
├── infra/
│   └── dev/
│       ├── docker/      # Dockerfiles
│       └── k8s/         # Kubernetes manifests
├── tools/               # Development tools
└── Tiltfile            # Tilt configuration
```

## 🧪 Testing

```bash
# Run all tests
go test ./...

# Run tests for specific service
go test ./services/auth-service/...

# Run with coverage
go test -cover ./...

# Frontend tests
cd web/client
yarn test
```

## 🔍 Observability

### Distributed Tracing (Jaeger)

```bash
kubectl port-forward service/jaeger 16686:16686
```

Visit [http://localhost:16686](http://localhost:16686)

### Metrics (Prometheus)

```bash
kubectl port-forward service/prometheus 9090:9090
```

Visit [http://localhost:9090](http://localhost:9090)

### Dashboards (Grafana)

```bash
kubectl port-forward service/grafana 3001:3000
```

Visit [http://localhost:3001](http://localhost:3001)

## 🐛 Troubleshooting

### Minikube Issues

```bash
# Restart Minikube
minikube stop
minikube start --cpus=4 --memory=8192

# Delete and recreate cluster
minikube delete
minikube start --cpus=4 --memory=8192
```

### Service Not Starting

```bash
# Check pod status
kubectl get pods

# Describe pod for details
kubectl describe pod <pod-name>

# Check events
kubectl get events --sort-by='.lastTimestamp'
```

### Port Already in Use

```bash
# Find and kill process using port
lsof -ti:3000 | xargs kill -9  # For port 3000
lsof -ti:8081 | xargs kill -9  # For port 8081
```

### Clear Docker Cache

```bash
# Remove all stopped containers and unused images
docker system prune -a

# Restart Docker Desktop
```

### Tilt Not Updating

```bash
# In Tilt UI, click on service and select "Force Update"
# Or restart Tilt
tilt down
tilt up
```

## 📚 API Documentation

After starting the services, API documentation is available:

- Swagger/OpenAPI docs (if implemented)
- gRPC reflection enabled on all services

### Example API Calls

```bash
# Health check
curl http://localhost:8081/health

# Create organization (requires auth)
curl -X POST http://localhost:8081/api/v1/organizations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Organization"}'
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Environment Variables

Key environment variables are configured in:
- `infra/dev/k8s/app-config.yaml` - Application configuration
- `infra/dev/k8s/secrets.yaml` - Sensitive credentials (not in git)

## 🔐 Security Notes

- Default credentials are for **development only**
- Change all passwords in production
- Use proper secret management (e.g., Vault, AWS Secrets Manager)
- Enable TLS for all services in production
- Review and update RBAC policies

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
- GitHub Issues: [https://github.com/aliirah/task-flow/issues](https://github.com/aliirah/task-flow/issues)
- Documentation: Check service-specific READMEs in each service directory

## 🎯 Roadmap

- [ ] Add comprehensive API documentation (Swagger)
- [ ] Implement end-to-end tests
- [ ] Add CI/CD pipeline
- [ ] Production-ready Helm charts
- [ ] Mobile app support
- [ ] Advanced task filtering and search
- [ ] Email notifications
- [ ] File attachments for tasks

---

Built with ❤️ using Go and Next.js
