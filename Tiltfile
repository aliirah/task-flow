# Load the restart_process extension
load('ext://restart_process', 'docker_build_with_restart')

k8s_yaml('infra/dev/k8s/secrets.yaml')
k8s_yaml('infra/dev/k8s/app-config.yaml')
k8s_yaml('infra/dev/k8s/auth-db.yaml')
k8s_yaml('infra/dev/k8s/user-db.yaml')
k8s_yaml('infra/dev/k8s/org-db.yaml')

## RabbitMQ ##
k8s_yaml('infra/dev/k8s/rabbitmq-deployment.yaml')
k8s_resource('rabbitmq', port_forwards=['5672', '15672'], labels='tooling')
k8s_resource('auth-db', labels='databases')
k8s_resource('user-db', labels='databases')
k8s_resource('org-db', labels='databases')
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
             resource_deps=['api-gateway-compile', 'rabbitmq', 'auth-service', 'user-service', 'organization-service'], labels="services")
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

## Seeders ##
local_resource(
  'auth-service-seed',
  './tools/go-seed auth',
  deps=['./tools/go-seed', './services/auth-service/internal/models', './services/auth-service/cmd/seeder', './shared'],
  labels="seeders", trigger_mode=TRIGGER_MODE_MANUAL, auto_init=False)

local_resource(
  'user-service-seed',
  './tools/go-seed user',
  deps=['./tools/go-seed', './services/user-service/internal/models', './services/user-service/cmd/seeder', './shared'],
  labels="seeders", trigger_mode=TRIGGER_MODE_MANUAL, auto_init=False)

local_resource(
  'organization-service-seed',
  './tools/go-seed org',
  deps=['./tools/go-seed', './services/organization-service/internal/models', './services/organization-service/cmd/seeder', './shared'],
  labels="seeders", trigger_mode=TRIGGER_MODE_MANUAL, auto_init=False)
## End Seeders ##

### Jaeger ###
k8s_yaml('./infra/dev/k8s/jaeger.yaml')
k8s_resource('jaeger', port_forwards=['16686:16686', '14268:14268'], labels="tooling")
### End of Jaeger ###
