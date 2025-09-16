# ====================
# --- Build Assets ---
# ====================
ARG NODE_IMAGE
FROM ${NODE_IMAGE} AS assets

WORKDIR /wiki

USER root

RUN apk add yarn g++ make cmake python3 --no-cache && \
    chown -R node:node /wiki

USER node

COPY ./client ./client
COPY ./dev ./dev
COPY ./patches ./patches
COPY ./package.json ./package.json
COPY ./.babelrc ./.babelrc
COPY ./.eslintignore ./.eslintignore
COPY ./.eslintrc.yml ./.eslintrc.yml
COPY ./yarn.lock ./yarn.lock

RUN yarn cache clean
#install all dependencies including DevDependencies
RUN yarn install --frozen-lockfile --non-interactive  --ignore-scripts
RUN yarn build
RUN rm -rf /wiki/node_modules
RUN yarn --production --frozen-lockfile --non-interactive  --ignore-scripts
# apply custom patches stored in patches directory to dependencies
RUN yarn patch-package

# ===============
# --- Release ---
# ===============
ARG NODE_IMAGE
FROM ${NODE_IMAGE}
LABEL maintainer="capgemini"

ARG VERSION
ARG RELEASE_DATE

ENV VERSION=$VERSION
ENV RELEASE_DATE=$RELEASE_DATE

ADD keycloak-host-full-chain-cert.pem /usr/local/share/ca-certificates/keycloak-host-full-chain-cert.pem

USER root

RUN apk add --no-cache ca-certificates bash curl git openssh gnupg sqlite && \
    chmod 644 /usr/local/share/ca-certificates/keycloak-host-full-chain-cert.pem && \
    update-ca-certificates && \
    mkdir -p /wiki && \
    mkdir -p /logs && \
    mkdir -p /wiki/data/content && \
    chown -R node:node /wiki /logs

USER node

WORKDIR /wiki

COPY --chown=node:node --from=assets /wiki/assets ./assets
COPY --chown=node:node --from=assets /wiki/node_modules ./node_modules
COPY --chown=node:node ./server ./server
COPY --chown=node:node --from=assets /wiki/server/views ./server/views
COPY --chown=node:node ./dev/build/config.yml ./config.yml
COPY --chown=node:node ./package.json ./package.json
COPY --chown=node:node ./LICENSE ./LICENSE


VOLUME ["/wiki/data/content"]

EXPOSE 3000
EXPOSE 3443

# HEALTHCHECK --interval=30s --timeout=30s --start-period=30s --retries=3 CMD curl -f http://localhost:3000/healthz

CMD ["node", "server"]
