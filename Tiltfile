# Load the restart_process extension
load('ext://restart_process', 'docker_build_with_restart')

k8s_yaml('infra/dev/k8s/secrets.yaml')
k8s_yaml('infra/dev/k8s/app-config.yaml')
k8s_yaml('infra/dev/k8s/auth-db.yaml')
k8s_yaml('infra/dev/k8s/user-db.yaml')
k8s_yaml('infra/dev/k8s/org-db.yaml')
k8s_yaml('infra/dev/k8s/task-db.yaml')
k8s_yaml('infra/dev/k8s/notification-db.yaml')
k8s_yaml('infra/dev/k8s/elasticsearch.yaml')

## RabbitMQ ##
k8s_yaml('infra/dev/k8s/rabbitmq-deployment.yaml')
k8s_resource('rabbitmq', port_forwards=['5672', '15672'], labels='tooling')
k8s_resource('auth-db', labels='databases')
k8s_resource('user-db', labels='databases')
k8s_resource('org-db', labels='databases')
k8s_resource('task-db', labels='databases')
k8s_resource('notification-db', labels='databases')
k8s_resource('elasticsearch', port_forwards='9200:9200', labels='databases')
## END RabbitMQ ##

### API Gateway ###
gateway_compile_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/api-gateway ./services/api-gateway'
if os.name == 'nt':
  gateway_compile_cmd = './infra/dev/docker/api-gateway-build.bat'

local_resource(
  'api-gateway-compile',
  gateway_compile_cmd,
  deps=['./services/api-gateway', './shared'], labels="compiles")


docker_build_with_restart(
  'task-flow/api-gateway',
  '.',
  entrypoint=['/app/build/api-gateway'],
  dockerfile='./infra/dev/docker/api-gateway.Dockerfile',
  only=[
    './build/api-gateway',
    './shared',
  ],
  live_update=[
    sync('./build', '/app/build'),
    sync('./shared', '/app/shared'),
  ],
)

k8s_yaml('./infra/dev/k8s/api-gateway-deployment.yaml')
k8s_resource('api-gateway', port_forwards=8081,
             resource_deps=['api-gateway-compile', 'rabbitmq', 'auth-service', 'user-service', 'organization-service', 'task-service', 'notification-service'], labels="services")
### End API Gateway ###

### Auth Service ###
auth_compile_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/auth-service ./services/auth-service'
if os.name == 'nt':
  auth_compile_cmd = './infra/dev/docker/auth-service-build.bat'
local_resource(
  'auth-service-compile',
  auth_compile_cmd,
  deps=['./services/auth-service', './shared'], labels="compiles")

docker_build_with_restart(
  'task-flow/auth-service',
  '.',
  entrypoint=['/app/build/auth-service'],
  dockerfile='./infra/dev/docker/auth-service.Dockerfile',
  only=[
    './build/auth-service',
    './shared',
  ],
  live_update=[
    sync('./build', '/app/build'),
    sync('./shared', '/app/shared'),
  ],
)

k8s_yaml('./infra/dev/k8s/auth-service.yaml')
k8s_resource('auth-service', resource_deps=['auth-service-compile', 'auth-db'], labels="services")

### End Auth Service ###

### User Service ###
user_compile_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/user-service ./services/user-service'
if os.name == 'nt':
  user_compile_cmd = './infra/dev/docker/user-service-build.bat'
local_resource(
  'user-service-compile',
  user_compile_cmd,
  deps=['./services/user-service', './shared'], labels="compiles")

docker_build_with_restart(
  'task-flow/user-service',
  '.',
  entrypoint=['/app/build/user-service'],
  dockerfile='./infra/dev/docker/user-service.Dockerfile',
  only=[
    './build/user-service',
    './shared',
  ],
  live_update=[
    sync('./build', '/app/build'),
    sync('./shared', '/app/shared'),
  ],
)

k8s_yaml('./infra/dev/k8s/user-service.yaml')
k8s_resource('user-service', resource_deps=['user-service-compile', 'user-db'], labels="services")
### End User Service ###

### Organization Service ###

### Organization Service ###
org_compile_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/organization-service ./services/organization-service'
if os.name == 'nt':
  org_compile_cmd = './infra/dev/docker/organization-service-build.bat'
local_resource(
  'organization-service-compile',
  org_compile_cmd,
  deps=['./services/organization-service', './shared'], labels="compiles")

docker_build_with_restart(
  'task-flow/organization-service',
  '.',
  entrypoint=['/app/build/organization-service'],
  dockerfile='./infra/dev/docker/organization-service.Dockerfile',
  only=[
    './build/organization-service',
    './shared',
  ],
  live_update=[
    sync('./build', '/app/build'),
    sync('./shared', '/app/shared'),
  ],
)

k8s_yaml('./infra/dev/k8s/organization-service.yaml')
k8s_resource('organization-service', resource_deps=['organization-service-compile', 'org-db'], labels="services")
### End Organization Service ###

### Task Service ###
task_compile_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/task-service ./services/task-service'
if os.name == 'nt':
  task_compile_cmd = './infra/dev/docker/task-service-build.bat'
local_resource(
  'task-service-compile',
  task_compile_cmd,
  deps=['./services/task-service', './shared'], labels="compiles")

docker_build_with_restart(
  'task-flow/task-service',
  '.',
  entrypoint=['/app/build/task-service'],
  dockerfile='./infra/dev/docker/task-service.Dockerfile',
  only=[
    './build/task-service',
    './shared',
  ],
  live_update=[
    sync('./build', '/app/build'),
    sync('./shared', '/app/shared'),
  ],
)

k8s_yaml('./infra/dev/k8s/task-service.yaml')
k8s_resource('task-service', resource_deps=['task-service-compile', 'task-db', 'rabbitmq'], labels="services")
### End Task Service ###

### Notification Service ###
notification_compile_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/notification-service ./services/notification-service'
if os.name == 'nt':
  notification_compile_cmd = './infra/dev/docker/notification-service-build.bat'
local_resource(
  'notification-service-compile',
  notification_compile_cmd,
  deps=['./services/notification-service', './shared'], labels="compiles")

docker_build_with_restart(
  'task-flow/notification-service',
  '.',
  entrypoint=['/app/build/notification-service'],
  dockerfile='./infra/dev/docker/notification-service.Dockerfile',
  only=[
    './build/notification-service',
    './shared',
  ],
  live_update=[
    sync('./build', '/app/build'),
    sync('./shared', '/app/shared'),
  ],
)

k8s_yaml('./infra/dev/k8s/notification-service.yaml')
k8s_resource('notification-service', resource_deps=['notification-service-compile', 'notification-db', 'rabbitmq'], labels="services")
### End Notification Service ###

### Search Service ###
search_compile_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/search-service ./services/search-service'
if os.name == 'nt':
  search_compile_cmd = './infra/dev/docker/search-service-build.bat'
local_resource(
  'search-service-compile',
  search_compile_cmd,
  deps=['./services/search-service', './shared'], labels="compiles")

docker_build_with_restart(
  'task-flow/search-service',
  '.',
  entrypoint=['/app/build/search-service'],
  dockerfile='./infra/dev/docker/search-service.Dockerfile',
  only=[
    './build/search-service',
    './shared',
  ],
  live_update=[
    sync('./build', '/app/build'),
    sync('./shared', '/app/shared'),
  ],
)

k8s_yaml('./infra/dev/k8s/search-service.yaml')
k8s_resource('search-service', resource_deps=['search-service-compile', 'rabbitmq', 'task-service', 'user-service', 'elasticsearch'], labels="services")
### End Search Service ###

## Seeders ##
local_resource(
  'user-service-seed',
  './tools/go-seed user',
  deps=['./tools/go-seed', './services/user-service/internal/models', './services/user-service/cmd/seeder', './shared'],
  labels="seeders", trigger_mode=TRIGGER_MODE_MANUAL, auto_init=False)

local_resource(
  'auth-service-seed',
  './tools/go-seed auth',
  deps=['./tools/go-seed', './services/auth-service/internal/models', './services/auth-service/cmd/seeder', './shared'],
  labels="seeders", trigger_mode=TRIGGER_MODE_MANUAL, auto_init=False)

local_resource(
  'organization-service-seed',
  './tools/go-seed org',
  deps=['./tools/go-seed', './services/organization-service/internal/models', './services/organization-service/cmd/seeder', './shared'],
  labels="seeders", trigger_mode=TRIGGER_MODE_MANUAL, auto_init=False)

local_resource(
  'task-service-seed',
  './tools/go-seed task',
  deps=['./tools/go-seed', './services/task-service/internal/models', './services/task-service/cmd/seeder', './shared'],
  labels="seeders", trigger_mode=TRIGGER_MODE_MANUAL, auto_init=False)
## End Seeders ##

## K6 Load Tests ##
local_resource(
  'k6-http',
  './run.sh http-scenarios.js',
  dir='loadtests/k6',
  deps=[
    './loadtests/k6/http-scenarios.js',
    './loadtests/k6/lib/helpers.js',
    './loadtests/k6/run.sh',
  ],
  labels="loadtests",
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  resource_deps=['api-gateway'])

local_resource(
  'k6-search',
  './run.sh search-only.js',
  dir='loadtests/k6',
  deps=[
    './loadtests/k6/search-only.js',
    './loadtests/k6/lib/helpers.js',
    './loadtests/k6/run.sh',
  ],
  labels="loadtests",
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  resource_deps=['api-gateway'])

local_resource(
  'k6-ws',
  './run.sh ws-notifications.js',
  dir='loadtests/k6',
  deps=[
    './loadtests/k6/ws-notifications.js',
    './loadtests/k6/lib/helpers.js',
    './loadtests/k6/run.sh',
  ],
  labels="loadtests",
  trigger_mode=TRIGGER_MODE_MANUAL,
  auto_init=False,
  resource_deps=['api-gateway'])
## End K6 Load Tests ##

### Web Client Frontend ###
docker_build(
  'task-flow/web-client',
  '.',
  dockerfile='./infra/dev/docker/web-client.Dockerfile',
)

k8s_yaml('./infra/dev/k8s/web-client-deployment.yaml')
k8s_resource('web-client', port_forwards=3005, labels="frontend")
### End of Web Frontend ###

### Jaeger ###
k8s_yaml('./infra/dev/k8s/jaeger.yaml')
k8s_resource('jaeger', port_forwards=['16686:16686', '14268:14268'], labels="tooling")
### End of Jaeger ###

### Monitoring Stack ###
k8s_yaml('./infra/dev/k8s/prometheus.yaml')
k8s_resource('prometheus', port_forwards='9090:9090', labels="tooling")

k8s_yaml('./infra/dev/k8s/grafana-deployment.yaml')
k8s_resource('grafana', port_forwards='7001:7001', labels="tooling")
### End of Monitoring Stack ###
