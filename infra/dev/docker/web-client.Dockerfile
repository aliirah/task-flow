FROM node:20-alpine

WORKDIR /app

COPY web/client/package*.json ./
COPY web/client/yarn.lock ./

RUN yarn install --frozen-lockfile

COPY web/client ./

EXPOSE 3000

CMD ["yarn", "dev", "--hostname", "0.0.0.0"]