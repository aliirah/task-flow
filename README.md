# Task Flow

Task Flow is a Go-based microservice suite (API gateway, auth, org, user, task, search, notification) with a Next.js frontend. Services talk via gRPC and RabbitMQ, and the gateway exposes REST + WebSockets for the UI.

## Architecture & Diagrams

- Mermaid diagrams live in `docs/diagrams/`:
  - [`architecture.mmd`](docs/diagrams/architecture.mmd): service + infrastructure map
  - [`task-events.mmd`](docs/diagrams/task-events.mmd): task creation + notification flow
- [`notifications.md`](docs/notifications.md) describes how events move from task-service → RabbitMQ → notification-service → API gateway/WebSocket.
- Core stack: Go 1.21+, PostgreSQL, RabbitMQ, gRPC, Jaeger, Prometheus, Grafana, Next.js 16, Tailwind.

## Prerequisites

| Tool | Notes |
| ---- | ----- |
| [Docker Desktop 20.10+](https://www.docker.com/products/docker-desktop) | container builds |
| [Minikube 1.30+](https://minikube.sigs.k8s.io/docs/start/) + [kubectl](https://kubernetes.io/docs/tasks/tools/) | local Kubernetes cluster |
| [Tilt 0.33+](https://docs.tilt.dev/install.html) | dev orchestrator |

## Quick Start

```bash
git clone https://github.com/aliirah/task-flow.git
cd task-flow

# Configure secrets (defaults are fine for dev)
cp infra/dev/k8s/secrets_example.yaml infra/dev/k8s/secrets.yaml

minikube start --cpus=4 --memory=8192 --driver=docker
tilt up
```

Tilt builds every service, deploys to Minikube, and streams logs at [http://localhost:10350](http://localhost:10350).

| Component | URL |
| --------- | --- |
| Web client | http://localhost:3005 |
| API gateway | http://localhost:8081 |
| RabbitMQ UI | http://localhost:15672 (guest/guest) |

## Development Workflow

- **Hot reload:** Tilt watches Go services, manifests, and the Next.js app, reloading on file changes.
- **Seed data:** Trigger `*-service-seed` resources in Tilt or run `./tools/go-seed <auth|user|org|task>` manually.
- **Logs:** Inspect each resource in the Tilt UI or run `kubectl logs -f deployment/<name>`.
- **Load tests:** Trigger the k6 scenarios described below when you need validation under load.

## Repository Layout

```
services/        Go microservices (api-gateway, auth, user, org, task, search, notification)
web/client/      Next.js frontend
shared/          Cross-service Go libs (messaging, tracing, logging, proto, etc.)
infra/dev/       Dockerfiles + K8s manifests used by Tilt
docs/            Architecture diagrams & design notes
proto/           Source protobuf definitions
tools/           Seeder + helper binaries
Tiltfile         Tilt entrypoint
```

## Load Testing

The repo uses k6 scenarios wired into Tilt as manual resources:

| Scenario | Tilt resource |
| -------- | ------------- |
| HTTP user journeys + notifications | `k6-http` |
| Search/suggest stress | `k6-search` |
| WebSocket notification flood | `k6-ws` |

From the Tilt UI trigger the desired resource, or run `tilt trigger k6-http` (etc.) after the stack is healthy. Each script bootstraps its own users/orgs and reports metrics in the Tilt log pane.
