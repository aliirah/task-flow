# Load the restart_process extension
load('ext://restart_process', 'docker_build_with_restart')

k8s_yaml('infra/dev/k8s/secrets.yaml')
k8s_yaml('infra/dev/k8s/app-config.yaml')
k8s_yaml('infra/dev/k8s/rabbitmq-config.yaml')

## RabbitMQ ##
k8s_yaml('infra/dev/k8s/rabbitmq-deployment.yaml')
k8s_resource('rabbitmq', port_forwards=['5672', '15672'], labels='tooling')
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
             resource_deps=['api-gateway-compile', 'rabbitmq', 'auth-service', 'user-service'], labels="services")
### End API Gateway ###

### Auth Service ###
auth_compile_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/auth-service ./services/auth-service'
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
k8s_resource('auth-service', resource_deps=['auth-service-compile'], labels="services")
### End Auth Service ###

### User Service ###
user_compile_cmd = 'CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/user-service ./services/user-service'
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
k8s_resource('user-service', resource_deps=['user-service-compile'], labels="services")
### End User Service ###

### Jaeger ###
k8s_yaml('./infra/dev/k8s/jaeger.yaml')
k8s_resource('jaeger', port_forwards=['16686:16686', '14268:14268'], labels="tooling")
### End of Jaeger ###
