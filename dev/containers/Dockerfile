# -- DEV DOCKERFILE --
# -- DO NOT USE IN PRODUCTION! --

FROM node:14
LABEL maintainer "requarks.io"

RUN apt-get update && \
    apt-get install -y bash curl git python make g++ nano openssh-server gnupg && \
    mkdir -p /wiki

ENV dockerdev 1
ENV DEVDB postgres

WORKDIR /wiki
COPY . .

RUN yarn install

EXPOSE 3000

CMD ["yarn", "watch"]
