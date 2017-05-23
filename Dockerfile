FROM node:6-alpine

RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh

ENV WIKI_JS_DOCKER 1

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
RUN npm install wiki.js@latest

EXPOSE 3000
CMD [ "node", "server" ]
