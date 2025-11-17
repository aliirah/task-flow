# K6 Load Tests

These scripts exercise the task-flow stack end-to-end (auth → API gateway → downstream services)
and can be executed as Kubernetes jobs, via `tilt`/`minikube`, or from your workstation.

## Prerequisites

* [k6](https://k6.io/docs/get-started/installation/) v0.46+.
* A running stack (Tilt + Minikube or remote cluster) reachable from where k6 runs.
* Test credentials with access to the organization you want to stress.

Recommended environment variables (override as needed):

```bash
export BASE_URL=http://localhost:8081
export WS_URL=ws://localhost:8081/api/ws
export USER_EMAIL=stress@example.com
export USER_PASSWORD=super-secret
export USER_ID=00000000-0000-0000-0000-000000000000
export ORG_ID=11111111-1111-1111-1111-111111111111
export ASSIGNEE_ID=00000000-0000-0000-0000-000000000000 # optional
export SEARCH_TYPES=task,comment,user
export WS_DWELL_SECONDS=20 # optional, controls how long ws clients stay connected
export K6_AUTO_SIGNUP=true   # auto-create missing user if login fails
export K6_AUTO_CREATE_ORG=true # auto-create org when ORG_ID absent
export K6_SIGNUP_RETRIES=3    # retry count for auto sign-up (helps when services are starting)
export K6_SIGNUP_RETRY_DELAY=1 # seconds between signup retries
# When running via Docker (automatically used if local k6 binary missing) the runner defaults to
# BASE_URL=http://host.docker.internal:8081 and WS_URL=ws://host.docker.internal:8081/api/ws so the
# container can reach services exposed on the host. Override these if your stack is reachable elsewhere.
```

By default the scripts **automatically register a throwaway user and create an organization**
when `USER_EMAIL`, `USER_PASSWORD`, or `ORG_ID` are not provided. Override the auto behavior
via `K6_AUTO_SIGNUP=false` or `K6_AUTO_CREATE_ORG=false` if you prefer to target an existing identity.
The HTTP scenarios expect `/api/auth/login` to issue JWTs and `/api/tasks`, `/api/search`, `/api/notifications`
to behave as implemented in this repo.

## Available Scripts

| Script | Description |
| --- | --- |
| `http-scenarios.js` | Multi-scenario script (smoke + stress) that logs in, creates tasks, adds comments, lists notifications, and performs search calls. |
| `search-only.js` | Focused search/suggest load (high query rate) to validate Elasticsearch + API-gateway behavior. |
| `ws-notifications.js` | Opens WebSocket connections, authenticates, and listens for task/comment/notification events while optionally creating background updates. |

## Running

### HTTP Scenarios

```bash
cd loadtests/k6
./run.sh http-scenarios.js \
  -e BASE_URL=$BASE_URL \
  -e USER_EMAIL=$USER_EMAIL \
  -e USER_PASSWORD=$USER_PASSWORD \
  -e USER_ID=$USER_ID \
  -e ORG_ID=$ORG_ID \
  -e ASSIGNEE_ID=$ASSIGNEE_ID
```

### Search Focused Test

```bash
./run.sh search-only.js \
  -e BASE_URL=$BASE_URL \
  -e USER_EMAIL=$USER_EMAIL \
  -e USER_PASSWORD=$USER_PASSWORD \
  -e USER_ID=$USER_ID \
  -e ORG_ID=$ORG_ID \
  -e SEARCH_TYPES=task,comment
```

### WebSocket / Notifications

```bash
./run.sh ws-notifications.js \
  -e BASE_URL=$BASE_URL \
  -e WS_URL=$WS_URL \
  -e USER_EMAIL=$USER_EMAIL \
  -e USER_PASSWORD=$USER_PASSWORD \
  -e USER_ID=$USER_ID \
  -e ORG_ID=$ORG_ID \
  -e WS_DWELL_SECONDS=30
```

The helper `run.sh` first tries the local `k6` binary and automatically falls back to the official
`grafana/k6` Docker image if the CLI is missing. The WebSocket script automatically opens background
HTTP activity (task updates/comments) to trigger events.

### Running via Tilt

The Tiltfile defines three manual `local_resource`s named `k6-http`, `k6-search`, and `k6-ws`.
From the Tilt UI (or `tilt trigger <name>`), you can run the scripts against the stack started by Tilt/Minikube:

```
tilt trigger k6-http   # runs http-scenarios.js
tilt trigger k6-search # runs search-only.js
tilt trigger k6-ws     # runs ws-notifications.js
```

Ensure any desired environment variables are exported in the shell before launching `tilt up`
so the `local_resource` commands inherit them.

## Notes

* These scripts intentionally create and delete data; run against staging or disposable environments.
* Use `k6 cloud` if you want to run from the k6 cloud service; the scripts are compatible.
* Adjust `options` inside each script (stages, VUs) to match the workload you want to simulate.
