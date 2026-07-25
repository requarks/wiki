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
