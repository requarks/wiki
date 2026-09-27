FROM node:26
LABEL maintainer="requarks.io"

RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -qy --no-install-recommends \
    bash \
    build-essential \
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
    mkdir -p /wiki/data/repo && \
    chown -R node:node /wiki /logs

WORKDIR /wiki

COPY --chown=node:node ./assets ./assets
COPY --chown=node:node ./blocks/compiled ./blocks/compiled
COPY --chown=node:node ./backend ./backend
COPY --chown=node:node ./dev/build/config.yml ./config.yml
COPY --chown=node:node ./LICENSE ./LICENSE

USER node

ENV NODE_ENV=production

# The browser the Puppeteer extension drives is the one Puppeteer installs for itself, not the distro's:
# Puppeteer speaks the protocol of the single Chrome release it was built against, and a distro package
# moves on with every security update while Puppeteer stays pinned, so each rebuild widened the gap until
# every render failed. Installed by Puppeteer, the pin below decides both halves of the pair.
#
# Only the headless shell, which is all a renderer needs; the full browser is skipped.
# The cache is a fixed path rather than under $HOME so that it is found whatever user the container is
# run as -- an arbitrary UID on OpenShift has no home directory of its own.
ENV PUPPETEER_CACHE_DIR=/wiki/.cache/puppeteer
ENV PUPPETEER_CHROME_SKIP_DOWNLOAD=true

WORKDIR /wiki/backend
RUN npm ci --omit=dev

# The Puppeteer extension, which server-side page rendering needs. Added here rather than declared in
# `backend/package.json` because it is an optional extension: an installation that renders its pages in
# the editor -- which is all of them, on any normal save -- has no use for a browser on the server, and
# a source checkout should not have to fetch one to install the backend.
#
# The version is read from the extension definition, which is also what the admin area installs when an
# operator adds Puppeteer to an instance by hand: one place to bump, and an image that cannot drift from
# what a hand-installed instance gets. An empty read fails the build rather than quietly installing
# whatever is newest.
#
# Puppeteer's postinstall downloads the browser, and `browsers install` makes sure of it: npm may be
# configured not to run install scripts, and when the browser is already there it only prints its path.
RUN PUPPETEER_VERSION="$(sed -n 's/^installVersion: *//p' modules/extensions/puppeteer/definition.yml)" && \
    test -n "$PUPPETEER_VERSION" && \
    npm install --no-save "puppeteer@${PUPPETEER_VERSION}" && \
    npx puppeteer browsers install chrome-headless-shell

# The system libraries that browser needs, which are no longer arriving as the dependencies of a distro
# package. Each Chrome for Testing build lists its own in `deb.deps`, per architecture, and this is the
# `apt-get satisfy` that `browsers install --install-deps` would run -- done here as root, rather than
# running Puppeteer as root, so that nothing in the cache ends up owned by root.
USER root
RUN DEPS="$(find "$PUPPETEER_CACHE_DIR" -name deb.deps)" && \
    test "$(printf '%s\n' "$DEPS" | grep -c .)" -eq 1 && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get satisfy -qy --no-install-recommends "$(paste -sd, "$DEPS")" && \
    rm -rf /var/lib/apt/lists/*
USER node

# Launch the browser the way the renderer does and navigate once, which is the step a mismatched or
# half-installed browser fails at. A pair that cannot render fails the image build, not every render
# on every instance running the image.
#
# Only on a native build. A multi-platform build runs the other architecture under QEMU user-mode
# emulation, where Chrome starts, accepts the DevTools connection and then dies on the first protocol
# call ("Target closed") however sound the install is -- so there the check is that the binary is an
# ELF for the architecture being built, which is the mistake an older pin makes silently (the x64 build
# installed on arm64). e_machine, at offset 18, is 0x3e for x86-64 and 0xb7 for aarch64.
ARG BUILDARCH
ARG TARGETARCH
RUN if [ -z "$TARGETARCH" ] || [ "$TARGETARCH" = "$BUILDARCH" ]; then \
      node --input-type=module -e " \
        import puppeteer from 'puppeteer'; \
        const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox', '--disable-dev-shm-usage'] }); \
        const page = await browser.newPage(); \
        await page.goto('data:text/html,<p>ok</p>'); \
        if ((await page.\$eval('p', (e) => e.textContent)) !== 'ok') throw new Error('The browser did not render.'); \
        console.log('Puppeteer drives ' + (await browser.version())); \
        await browser.close();"; \
    else \
      node --input-type=module -e " \
        import { openSync, readSync } from 'node:fs'; \
        import puppeteer from 'puppeteer'; \
        const file = await puppeteer.executablePath({ headless: 'shell' }); \
        const header = Buffer.alloc(20); \
        readSync(openSync(file), header, 0, 20, 0); \
        const machine = header.readUInt16LE(18); \
        const expected = { x64: 0x3e, arm64: 0xb7 }[process.arch]; \
        if (machine !== expected) throw new Error(file + ' is not a ' + process.arch + ' binary (e_machine 0x' + machine.toString(16) + ').'); \
        console.log('Emulated build, not launched: ' + file + ' is ' + process.arch);"; \
    fi

WORKDIR /wiki

VOLUME ["/wiki/data/content"]
VOLUME ["/wiki/data/repo"]

EXPOSE 3000
EXPOSE 3443

# Web Storage off, which is what it was before Node 26 turned it on by default.
#
# Nothing here uses `localStorage`, but `lib0` -- under yjs, which is what makes an editing session
# collaborative -- probes for it as it loads, the way a library that runs in both a browser and node
# has to. Without `--localstorage-file` that probe is answered with an experimental warning rather
# than a value, so the first line of every container's log was a warning about a feature the server
# does not use. Off, the global is absent and the probe takes its node path in silence.
CMD ["node", "--no-experimental-webstorage", "backend"]
