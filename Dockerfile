FROM node:6-alpine

ENV WIKI_JS_DOCKER 1

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
RUN npm install wiki.js@latest

EXPOSE 3000
CMD [ "node", "server" ]
