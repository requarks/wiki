# ====================
# --- Build Assets ---
# ====================
FROM node:14-alpine AS assets

RUN apk add yarn g++ make python --no-cache

WORKDIR /wiki

COPY ./wiki/client ./client
COPY ./wiki/dev ./dev
COPY ./wiki/package.json ./package.json
COPY ./wiki/.babelrc ./.babelrc
COPY ./wiki/.eslintignore ./.eslintignore
COPY ./wiki/.eslintrc.yml ./.eslintrc.yml

RUN mkdir -p /wiki-ckeditor5
COPY ./wiki-ckeditor5 /wiki-ckeditor5

RUN yarn cache clean
RUN yarn --frozen-lockfile --non-interactive
RUN yarn build
RUN rm -rf /wiki/node_modules
RUN yarn --production --frozen-lockfile --non-interactive

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

COPY --chown=node:node --from=assets /wiki/assets ./assets
COPY --chown=node:node --from=assets /wiki/node_modules ./node_modules
COPY --chown=node:node ./wiki/server ./server
COPY --chown=node:node --from=assets /wiki/server/views ./server/views
COPY --chown=node:node ./wiki/dev/build/config.yml ./config.yml
COPY --chown=node:node ./wiki/package.json ./package.json
COPY --chown=node:node ./wiki/LICENSE ./LICENSE

USER node

VOLUME ["/wiki/data/content"]

EXPOSE 3000
EXPOSE 3443

# HEALTHCHECK --interval=30s --timeout=30s --start-period=30s --retries=3 CMD curl -f http://localhost:3000/healthz

CMD ["node", "server"]
