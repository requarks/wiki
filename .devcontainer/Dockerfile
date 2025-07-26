# Based of https://github.com/devcontainers/images/blob/main/src/javascript-node/.devcontainer/Dockerfile

ARG VARIANT=24-bookworm
FROM node:${VARIANT}

ARG USERNAME=node
ARG NPM_GLOBAL=/usr/local/share/npm-global

ENV DEBIAN_FRONTEND=noninteractive

# Add NPM global to PATH.
ENV PATH=${NPM_GLOBAL}/bin:${PATH}

RUN \
    # Configure global npm install location, use group to adapt to UID/GID changes
    if ! cat /etc/group | grep -e "^npm:" > /dev/null 2>&1; then groupadd -r npm; fi \
    && usermod -a -G npm ${USERNAME} \
    && umask 0002 \
    && mkdir -p ${NPM_GLOBAL} \
    && touch /usr/local/etc/npmrc \
    && chown ${USERNAME}:npm ${NPM_GLOBAL} /usr/local/etc/npmrc \
    && chmod g+s ${NPM_GLOBAL} \
    && npm config -g set prefix ${NPM_GLOBAL} \
    && su ${USERNAME} -c "npm config -g set prefix ${NPM_GLOBAL}" \
    # Install eslint
    && su ${USERNAME} -c "umask 0002 && npm install -g eslint" \
    && npm cache clean --force > /dev/null 2>&1

# Enable PNPM
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable \
    && corepack prepare pnpm@latest --activate

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
# allow installing when the main user is root
ENV npm_config_unsafe_perm=true
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
