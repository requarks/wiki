# -- DEV DOCKERFILE --
# -- DO NOT USE IN PRODUCTION! --

FROM node:20
LABEL maintainer="requarks.io"

RUN apt-get update && \
    apt-get install -y --no-install-recommends bash curl git python3 make g++ nano openssh-server gnupg && \
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /wiki

WORKDIR /wiki

ENV dockerdev=1
ENV DEVDB=postgres

EXPOSE 3000

CMD ["tail", "-f", "/dev/null"]
