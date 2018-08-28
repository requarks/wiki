# -- DEV DOCKERFILE --
# -- DO NOT USE IN PRODUCTION! --

FROM node:8-alpine
LABEL maintainer "requarks.io"

RUN apk update && \
    apk add bash curl git python make g++ --no-cache && \
    mkdir -p /var/wiki

WORKDIR /var/wiki
COPY package.json .
RUN yarn --silent

ENV dockerdev 1

EXPOSE 3000

CMD ["tail", "-f", "/dev/null"]
