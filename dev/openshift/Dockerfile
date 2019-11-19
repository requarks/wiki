FROM requarks/wiki:2

# For mounting config.yml as configmap, some directory operations should be done.

WORKDIR /wiki

RUN mkdir config && \
    mv config.yml config/config.yml && \
    ln -s config/config.yml config.yml

# For offline installation, create sideload directory,then
# mount en.json and locales.json
RUN mkdir -p data/sideload
