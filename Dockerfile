FROM node:8-alpine

RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh

ENV WIKI_JS_DOCKER 1

WORKDIR /usr/src/app
RUN npm install wiki.js@latest

EXPOSE 3000
ENTRYPOINT [ "node", "server" ]
