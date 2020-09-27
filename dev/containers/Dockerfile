# -- DEV DOCKERFILE --
# -- DO NOT USE IN PRODUCTION! --

FROM node:14
LABEL maintainer "requarks.io"

RUN apt-get update && \
    apt-get install -y bash curl git python make g++ nano openssh-server gnupg && \
    mkdir -p /wiki

WORKDIR /wiki

ENV dockerdev 1
ENV DEVDB postgres

EXPOSE 3000

CMD ["tail", "-f", "/dev/null"]
