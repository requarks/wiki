# Based of https://github.com/devcontainers/images/blob/main/src/javascript-node/.devcontainer/Dockerfile

ARG VARIANT=26
FROM node:${VARIANT}

ARG USERNAME=node

ENV DEBIAN_FRONTEND=noninteractive

EXPOSE 3000

# Install the packages we need
RUN apt-get update && apt-get install -qy \
    bash \
    build-essential \
    curl \
    jq \
    less \
    git \
    gnupg2 \
    nano \
    netcat-openbsd \
    pandoc \
    unzip \
    wget

# Chromium, for the Puppeteer extension. Rendering a page on the server means driving a headless
# browser, and this is the copy Puppeteer is pointed at rather than one it downloads for itself:
# the distro keeps it patched, and it exists for arm64 as well as amd64.
#
# Its own RUN, and without recommends, because Chromium recommends a desktop stack -- an X server, a
# terminal emulator, usbmuxd -- that takes the package count from 61 to 177 and that nothing headless
# ever touches. The apt lists from the install above are still around, so no second update is needed.
RUN apt-get install -qy --no-install-recommends \
    chromium \
    fonts-liberation

# Where Puppeteer looks for a browser, and that it must not fetch a second one on install
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# avoid million NPM install messages
ENV npm_config_loglevel=warn
# disable NPM funding messages
ENV npm_config_fund=false

# Colorize the bash shell
RUN sed -i 's/#force_color_prompt=/force_color_prompt=/' /root/.bashrc

# Copy wait-for utility
COPY wait-for.sh /usr/local/bin/wait-for
RUN chmod +rx /usr/local/bin/wait-for

# Copy the startup file
COPY app-init.sh /docker-init.sh
RUN sed -i 's/\r$//' /docker-init.sh && \
    chmod +x /docker-init.sh

# Create workspace
RUN mkdir -p /workspace
WORKDIR /workspace

ENV NODE_ENV=development
