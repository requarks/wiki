# ====================
# --- Build Assets ---
# ====================
FROM node:10.15-alpine AS assets

RUN apk update && \
    apk add yarn g++ make python --no-cache && \
    rm -rf /var/cache/apk/* && \
    mkdir -p /wiki

WORKDIR /wiki

COPY ./client ./client
COPY ./dev ./dev
COPY ./package.json ./package.json
COPY ./.babelrc ./.babelrc
COPY ./.eslintignore ./.eslintignore
COPY ./.eslintrc.yml ./.eslintrc.yml

RUN yarn --cache-folder /codefresh/volume/yarn
RUN yarn build
RUN rm -rf /wiki/node_modules
RUN yarn --production

# =========================
# --- Publish to GitHub ---
# =========================

FROM alpine AS publishing

RUN apk --update add git jq openssh hub tar && \
    rm -rf /var/cache/apk/*

WORKDIR /wiki

COPY --from=assets /wiki/assets ./assets
COPY --from=assets /wiki/node_modules ./node_modules
COPY ./server ./server
COPY --from=assets /wiki/server/views ./server/views
COPY ./config.sample.yml ./config.sample.yml
COPY ./package.json ./package.json
COPY ./LICENSE ./LICENSE

RUN BUILDNUM=$(jq -r '.version' package.json)

WORKDIR /

RUN tar -czf wiki-js.tar.gz /wiki
RUN mv wiki-js.tar.gz /wiki

WORKDIR /wiki

RUN hub init -g "Requarks/wiki"
RUN hub create -p -a wiki-js.tar.gz -m "See [CHANGELOG](https://github.com/Requarks/wiki/blob/master/CHANGELOG.md) for release notes" -t $CF_REVISION $BUILDNUM

# ===============
# --- Release ---
# ===============
FROM node:10.15-alpine
LABEL maintainer="requarks.io"

RUN apk update && \
    apk add bash curl git openssh supervisor --no-cache && \
    rm -rf /var/cache/apk/* && \
    mkdir -p /wiki && \
    mkdir -p /logs

WORKDIR /wiki

COPY --from=assets /wiki/assets ./assets
COPY --from=assets /wiki/node_modules ./node_modules
COPY ./server ./server
COPY --from=assets /wiki/server/views ./server/views
COPY ./dev/build/config.yml ./config.yml
COPY ./dev/docker/wait.sh ./wait.sh
COPY ./package.json ./package.json
COPY ./LICENSE ./LICENSE

EXPOSE 3000

CMD ["node", "server"]
