FROM node:24
LABEL maintainer="requarks.io"

RUN apt-get update && apt-get install -qy --no-install-recommends \
    bash \
    build-essential \
    curl \
    git \
    gnupg \
    openssh-client \
    pandoc \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /wiki && \
    mkdir -p /logs && \
    mkdir -p /wiki/data/content && \
    chown -R node:node /wiki /logs
RUN corepack enable && \
    corepack prepare pnpm@latest --activate

WORKDIR /wiki

COPY --chown=node:node ./assets ./assets
COPY --chown=node:node ./blocks/compiled ./blocks/compiled
COPY --chown=node:node ./server ./server
COPY --chown=node:node ./dev/build/config.yml ./config.yml
COPY --chown=node:node ./LICENSE ./LICENSE

USER node

ENV NODE_ENV=production

WORKDIR /wiki/server
RUN pnpm install --prod --frozen-lockfile

# Set extensions as installed
RUN touch node_modules/sharp/wiki_installed.txt

WORKDIR /wiki

VOLUME ["/wiki/data/content"]

EXPOSE 3000
EXPOSE 3443

CMD ["node", "server"]
