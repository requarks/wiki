FROM node:26
LABEL maintainer="requarks.io"

RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -qy --no-install-recommends \
    bash \
    build-essential \
    chromium \
    curl \
    fonts-liberation \
    git \
    gnupg \
    openssh-client \
    pandoc \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /wiki && \
    mkdir -p /logs && \
    mkdir -p /wiki/data/content && \
    chown -R node:node /wiki /logs

WORKDIR /wiki

COPY --chown=node:node ./assets ./assets
COPY --chown=node:node ./blocks/compiled ./blocks/compiled
COPY --chown=node:node ./backend ./backend
COPY --chown=node:node ./dev/build/config.yml ./config.yml
COPY --chown=node:node ./LICENSE ./LICENSE

USER node

ENV NODE_ENV=production

# The browser the Puppeteer extension drives, installed above rather than downloaded by Puppeteer: the
# distro keeps it patched, it exists for arm64 as well as amd64, and the image does not carry two copies
# of Chromium. `PUPPETEER_SKIP_DOWNLOAD` has to be set before the install below for that to hold.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /wiki/backend
RUN npm ci --omit=dev

# The Puppeteer extension, which server-side page rendering needs. Added here rather than declared in
# `backend/package.json` because it is an optional extension: an installation that renders its pages in
# the editor -- which is all of them, on any normal save -- has no use for a browser on the server, and
# a source checkout should not have to fetch one to install the backend. Pinned like every other
# dependency, so an image build is reproducible.
RUN npm install --no-save puppeteer@25.4.0

WORKDIR /wiki

VOLUME ["/wiki/data/content"]

EXPOSE 3000
EXPOSE 3443

CMD ["node", "server"]
