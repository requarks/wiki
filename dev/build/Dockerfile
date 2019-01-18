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
