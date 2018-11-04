# ====================
# --- Build Assets ---
# ====================
FROM node:10-alpine AS assets

RUN apk update && \
    apk add yarn g++ make python --no-cache && \
    rm -rf /var/cache/apk/* && \
    mkdir -p /var/wiki

WORKDIR /var/wiki

COPY ./package.json /var/wiki/package.json
COPY ./client /var/wiki/client

RUN yarn
RUN yarn build
RUN rm -rf /var/wiki/node_modules
RUN yarn --production

# ===============
# --- Release ---
# ===============
FROM node:10-alpine
LABEL maintainer="requarks.io"

RUN apk update && \
    apk add bash curl git openssh supervisor --no-cache && \
    rm -rf /var/cache/apk/* && \
    mkdir -p /var/wiki

WORKDIR /var/wiki

COPY ./dev/build/supervisord.conf /etc/supervisord.conf
COPY --from=assets /var/wiki/assets ./assets
COPY --from=assets /var/wiki/node_modules ./node_modules
COPY ./server /var/wiki/server
COPY ./config.sample.yml /var/wiki/config.yml
COPY ./package.json /var/wiki/package.json
COPY ./LICENSE /var/wiki/LICENSE

EXPOSE 3000

CMD ["supervisord", "--nodaemon", "-c", "/etc/supervisord.conf"]
