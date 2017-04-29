FROM node:latest

ENV WIKI_JS_DOCKER 1

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
RUN yarn add wiki.js@latest

EXPOSE 3000
CMD [ "node", "server" ]
