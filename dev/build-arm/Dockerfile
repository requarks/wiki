# =========================
# --- BUILD NPM MODULES ---
# =========================
FROM node:12.13-alpine AS build

RUN apk add yarn g++ make python --no-cache

WORKDIR /wiki

COPY ./package.json ./package.json

RUN yarn --production --frozen-lockfile --non-interactive --network-timeout 100000

# ===============
# --- Release ---
# ===============
FROM node:12.13-alpine
LABEL maintainer="requarks.io"

RUN apk add bash curl git openssh gnupg sqlite --no-cache && \
    mkdir -p /wiki && \
    mkdir -p /logs && \
    chown -R node:node /wiki /logs

WORKDIR /wiki

COPY --chown=node:node ./build/assets ./assets
COPY --chown=node:node --from=build /wiki/node_modules ./node_modules
COPY --chown=node:node ./server ./server
COPY --chown=node:node ./build/server/views ./server/views
COPY --chown=node:node ./dev/build/config.yml ./config.yml
COPY --chown=node:node ./dev/docker-common/wait.sh ./wait.sh
COPY --chown=node:node ./package.json ./package.json
COPY --chown=node:node ./LICENSE ./LICENSE

USER node

EXPOSE 3000

CMD ["node", "server"]
