FROM node:8-alpine

RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh

ENV WIKI_JS_DOCKER 1

WORKDIR /usr/src/app
COPY assets assets/
COPY server server/
COPY npm/configs/config.passive.yml config.yml
COPY package.json package.json
COPY LICENSE LICENSE
RUN npm install --only=production --no-optional

EXPOSE 3000
ENTRYPOINT [ "node", "server" ]
