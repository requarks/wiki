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

# Inject mermaid.js and Inter font into index.html
RUN sed -i 's|</head>|<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700\&display=swap" rel="stylesheet"><script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script><script>document.addEventListener("DOMContentLoaded",function(){mermaid.initialize({startOnLoad:false,theme:"default"});new MutationObserver(function(){document.querySelectorAll(".codeblock-mermaid:not([data-processed])").forEach(function(el){el.setAttribute("data-processed","1");var code=el.querySelector("code");if(code){var d=document.createElement("div");d.className="mermaid";d.textContent=code.textContent;el.replaceWith(d)}});try{mermaid.run({querySelector:".mermaid:not([data-id])"})}catch(e){}}).observe(document.body,{childList:true,subtree:true})});</script></head>|' ./assets/index.html

# Replace Wiki.js branding and logo
RUN sed -i 's/Wiki\.js/CultBR Wiki/g' ./assets/index.html
RUN cp ./assets/cultbr.svg ./assets/_assets/logo-wikijs.svg && \
    cp ./assets/cultbr.svg ./assets/_assets/logo-wikijs-full.svg && \
    mkdir -p ./data/assets

# Fix CJS modules: rename .js to .cjs and create ESM wrappers with 3-arg adapter
RUN find ./server/modules/authentication -name "authentication.js" -exec sh -c \
    'mv "{}" "$(dirname {})"/authentication.cjs && printf "import{createRequire}from\"module\";const require=createRequire(import.meta.url);const m=require(\"./authentication.cjs\");const w={...m,init(p,id,c){return m.init(p,{...c,key:id})}};export default w;\n" > "$(dirname {})"/authentication.mjs' \; && \
    find ./server/modules/storage -name "storage.js" -exec sh -c \
    'mv "{}" "$(dirname {})"/storage.cjs && printf "import{createRequire}from\"module\";const require=createRequire(import.meta.url);const m=require(\"./storage.cjs\");export default m;\n" > "$(dirname {})"/storage.mjs' \;

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
