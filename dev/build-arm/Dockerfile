# =========================
# --- BUILD NPM MODULES ---
# =========================
FROM node:14 AS build

WORKDIR /wiki

COPY ./package.json ./package.json

RUN yarn --production --frozen-lockfile --non-interactive --network-timeout 100000

# ===============
# --- Release ---
# ===============
FROM node:14-alpine
LABEL maintainer="requarks.io"

RUN apk add bash curl git openssh gnupg sqlite --no-cache && \
    mkdir -p /wiki && \
    mkdir -p /logs && \
    mkdir -p /wiki/data/content && \
    chown -R node:node /wiki /logs

WORKDIR /wiki

COPY --chown=node:node ./build/assets ./assets
COPY --chown=node:node --from=build /wiki/node_modules ./node_modules
COPY --chown=node:node ./server ./server
COPY --chown=node:node ./build/server/views ./server/views
COPY --chown=node:node ./dev/build/config.yml ./config.yml
COPY --chown=node:node ./build/package.json ./package.json
COPY --chown=node:node ./LICENSE ./LICENSE

USER node

VOLUME ["/wiki/data/content"]

EXPOSE 3000
EXPOSE 3443

CMD ["node", "server"]
