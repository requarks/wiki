# Based of https://github.com/microsoft/vscode-dev-containers/blob/main/containers/javascript-node/.devcontainer/base.Dockerfile

# [Choice] Node.js version (use -bullseye variants on local arm64/Apple Silicon): 16, 14, 12, 16-bullseye, 14-bullseye, 12-bullseye, 16-buster, 14-buster, 12-buster
ARG VARIANT=18-bullseye
FROM node:${VARIANT}

ENV DEBIAN_FRONTEND=noninteractive

# Copy library scripts to execute
ADD https://raw.githubusercontent.com/microsoft/vscode-dev-containers/main/containers/javascript-node/.devcontainer/library-scripts/common-debian.sh /tmp/library-scripts/
ADD https://raw.githubusercontent.com/microsoft/vscode-dev-containers/main/containers/javascript-node/.devcontainer/library-scripts/node-debian.sh /tmp/library-scripts/
ADD https://raw.githubusercontent.com/microsoft/vscode-dev-containers/main/containers/javascript-node/.devcontainer/library-scripts/meta.env /tmp/library-scripts/

# [Option] Install zsh
ARG INSTALL_ZSH="true"
# [Option] Upgrade OS packages to their latest versions
ARG UPGRADE_PACKAGES="true"

# Install needed packages, yarn, nvm and setup non-root user. Use a separate RUN statement to add your own dependencies.
ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=$USER_UID
ARG NPM_GLOBAL=/usr/local/share/npm-global
ENV NVM_DIR=/usr/local/share/nvm
ENV NVM_SYMLINK_CURRENT=true \
    PATH=${NPM_GLOBAL}/bin:${NVM_DIR}/current/bin:${PATH}
RUN apt-get update \
    # Remove imagemagick due to https://security-tracker.debian.org/tracker/CVE-2019-10131
    && apt-get purge -y imagemagick imagemagick-6-common \
    # Install common packages, non-root user, update yarn and install nvm
    && bash /tmp/library-scripts/common-debian.sh "${INSTALL_ZSH}" "${USERNAME}" "${USER_UID}" "${USER_GID}" "${UPGRADE_PACKAGES}" "true" "true" \
    # Install yarn, nvm
    && rm -rf /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    && bash /tmp/library-scripts/node-debian.sh "${NVM_DIR}" "none" "${USERNAME}" \
    # Configure global npm install location, use group to adapt to UID/GID changes
    && if ! cat /etc/group | grep -e "^npm:" > /dev/null 2>&1; then groupadd -r npm; fi \
    && usermod -a -G npm ${USERNAME} \
    && umask 0002 \
    && mkdir -p ${NPM_GLOBAL} \
    && touch /usr/local/etc/npmrc \
    && chown ${USERNAME}:npm ${NPM_GLOBAL} /usr/local/etc/npmrc \
    && chmod g+s ${NPM_GLOBAL} \
    && npm config -g set prefix ${NPM_GLOBAL} \
    && sudo -u ${USERNAME} npm config -g set prefix ${NPM_GLOBAL} \
    # Install eslint
    && su ${USERNAME} -c "umask 0002 && npm install -g eslint" \
    && npm cache clean --force > /dev/null 2>&1 \
    # Install python-is-python3 on bullseye to prevent node-gyp regressions
    && . /etc/os-release \
    && if [ "${VERSION_CODENAME}" = "bullseye" ]; then apt-get -y install --no-install-recommends python-is-python3; fi \
    # Clean up
    && apt-get autoremove -y && apt-get clean -y && rm -rf /var/lib/apt/lists/* /root/.gnupg /tmp/library-scripts

# Enable PNPM
RUN sudo corepack enable \
    && corepack prepare pnpm@latest --activate

EXPOSE 3000

# Add Docker Source
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
RUN echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Add ngrok Source
RUN curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc > /dev/null && \
    echo "deb https://ngrok-agent.s3.amazonaws.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/ngrok.list

# Add Localazy Source
RUN curl -sS https://dist.localazy.com/debian/pubkey.gpg | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/localazy.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/trusted.gpg.d/localazy.gpg] https://maven.localazy.com/repository/apt/ stable main" | sudo tee /etc/apt/sources.list.d/localazy.list

# Install the packages we need
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive && apt-get install -qy \
    bash \
    build-essential \
    curl \
    docker-ce-cli \
    jq \
    less \
    git \
    gnupg2 \
    localazy \
    nano \
    netcat \
    ngrok \
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
