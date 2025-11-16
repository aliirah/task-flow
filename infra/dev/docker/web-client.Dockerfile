FROM node:20-alpine AS builder

WORKDIR /app

COPY web/client/package*.json ./
COPY web/client/yarn.lock ./

RUN yarn install --frozen-lockfile

COPY web/client ./

RUN yarn build

FROM nginx:1.27-alpine

COPY infra/dev/docker/web-client-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out /usr/share/nginx/html

EXPOSE 3005

CMD ["nginx", "-g", "daemon off;"]
