FROM requarks/wiki:beta

USER root

RUN chgrp -R 0 /wiki /logs && \
    chmod -R g=u /wiki /logs

USER 1001
