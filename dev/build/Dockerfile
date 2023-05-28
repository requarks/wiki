# ====================
# --- Build Assets ---
# ====================
FROM node:18 AS assets

RUN apt-get update && apt-get install build-essential -y

WORKDIR /wiki

COPY ./ux ./ux
COPY ./dev ./dev

RUN cd ux && \
    npm ci --audit=false --fund=false && \
    npm run build

# ===============
# --- Release ---
# ===============
FROM node:18-alpine
LABEL maintainer="requarks.io"

RUN apk add bash curl git openssh gnupg --no-cache && \
    mkdir -p /wiki && \
    mkdir -p /logs && \
    mkdir -p /wiki/data/content && \
    chown -R node:node /wiki /logs

WORKDIR /wiki

COPY --chown=node:node --from=assets /wiki/assets ./assets
COPY --chown=node:node ./server ./server
COPY --chown=node:node ./dev/build/config.yml ./config.yml
COPY --chown=node:node ./LICENSE ./LICENSE

USER node

ENV NODE_ENV=production

RUN cd server && npm ci --omit=dev --audit=false --fund=false

VOLUME ["/wiki/data/content"]

EXPOSE 3000
EXPOSE 3443

CMD ["node", "server"]
