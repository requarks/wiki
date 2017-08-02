FROM node:8-alpine

RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh

ENV WIKI_JS_DOCKER 1

WORKDIR /usr/src/app
COPY repo .
COPY npm/configs/config.passive.yml config.yml
COPY git.pem /etc/wiki/keys/git.pem
RUN npm install
RUN npm run-script build
EXPOSE 3000
ENTRYPOINT [ "node", "server" ]
