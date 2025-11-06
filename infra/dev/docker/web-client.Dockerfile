FROM node:20-alpine

WORKDIR /app

COPY web/client/package*.json ./
COPY web/client/yarn.lock ./

RUN yarn install

COPY web/client ./

RUN yarn build

EXPOSE 3000

CMD ["yarn", "dev"]