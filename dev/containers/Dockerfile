FROM node:18
LABEL maintainer "requarks.io"

USER root

RUN apt-get update && \
    apt-get install -y bash curl git python3 make g++ nano openssh-server gnupg && \
    mkdir -p /wiki && \
     chown -R node:node /wiki 

USER node

WORKDIR /wiki

ENV dockerdev 1
ENV DEVDB postgres

EXPOSE 3000

CMD ["tail", "-f", "/dev/null"]