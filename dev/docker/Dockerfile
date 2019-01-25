# -- DEV DOCKERFILE --
# -- DO NOT USE IN PRODUCTION! --

FROM node:10-alpine
LABEL maintainer "requarks.io"

RUN apk update && \
    apk add bash curl git python make g++ --no-cache && \
    mkdir -p /wiki

WORKDIR /wiki
COPY package.json .
RUN yarn --silent
COPY ./dev/docker/init.sh ./init.sh

ENV dockerdev 1

EXPOSE 3000

CMD ["tail", "-f", "/dev/null"]
