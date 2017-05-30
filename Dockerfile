FROM node:7-alpine

ENV WIKI_JS_DOCKER 1

RUN mkdir -p /usr/src/app \
    && apk add --no-cache openssh-client zlib-dev openssl-dev curl-dev expat-dev perl-dev python-dev pcre-dev asciidoc xmlto perl-error tcl tk openssl ca-certificates make build-base \
    && update-ca-certificates \
    && wget https://www.kernel.org/pub/software/scm/git/git-2.11.2.tar.xz \
    && tar -xf git-2.11.2.tar.xz \
    && cd git-2.11.2/ \
    && make -j1 prefix=/usr NO_GETTEXT=YesPlease NO_NSEC=YesPlease NO_SVN_TESTS=YesPlease USE_LIBPCRE=1 perl/perl.mak \
    && make prefix=/usr NO_GETTEXT=YesPlease NO_NSEC=YesPlease NO_SVN_TESTS=YesPlease USE_LIBPCRE=1 NO_REGEX=NeedsStartEnd install \
    && apk del zlib-dev openssl-dev curl-dev expat-dev perl-dev python-dev pcre-dev make build-base \
    && apk add --no-cache pcre libpcre16 libpcre32 libpcrecpp zlib openssl libcurl expat perl python \
    && cd .. && rm -Rf git-2.11.2.tar.xz git-2.11.2/

WORKDIR /usr/src/app
RUN npm install
COPY .docker/entrypoint.sh /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
