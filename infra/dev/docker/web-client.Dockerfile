FROM node:20-alpine AS builder

WORKDIR /app

COPY web/client/package*.json ./
COPY web/client/yarn.lock ./

RUN yarn install --frozen-lockfile

COPY web/client .

RUN yarn build

FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app .

EXPOSE 3005

CMD ["yarn", "start", "--hostname", "0.0.0.0", "--port", "3005"]
