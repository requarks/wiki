FROM node:8-alpine
LABEL maintainer="requarks.io"

RUN apk update && \
    apk add bash curl git openssh supervisor --no-cache && \
    mkdir -p /var/wiki

WORKDIR /var/wiki

COPY supervisord.conf /etc/supervisord.conf
COPY . /var/wiki

EXPOSE 3000

CMD ["supervisord", "--nodaemon", "-c", "/etc/supervisord.conf"]
