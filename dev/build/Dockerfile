# ====================
# --- Build Assets ---
# ====================
FROM node:10-alpine AS assets

RUN apk update && \
    apk add yarn g++ make python --no-cache && \
    rm -rf /var/cache/apk/* && \
    mkdir -p /var/wiki

WORKDIR /var/wiki

COPY ./client ./client
COPY ./dev ./dev
COPY ./package.json ./package.json
COPY ./.babelrc ./.babelrc
COPY ./.eslintignore ./.eslintignore
COPY ./.eslintrc.yml ./.eslintrc.yml

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
    mkdir -p /var/wiki && \
    mkdir -p /logs

WORKDIR /var/wiki

COPY ./dev/build/supervisord.conf /etc/supervisord.conf
COPY --from=assets /var/wiki/assets ./assets
COPY --from=assets /var/wiki/node_modules ./node_modules
COPY --from=assets /var/wiki/server ./server
COPY ./server ./server
COPY ./dev/build/config.yml ./config.yml
COPY ./package.json ./package.json
COPY ./LICENSE ./LICENSE

EXPOSE 3000

CMD ["supervisord", "--nodaemon", "-c", "/etc/supervisord.conf"]
