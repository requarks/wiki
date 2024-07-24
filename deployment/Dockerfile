FROM requarks/wiki:2.5.303@sha256:1aae39563cf15d8cfc6371b6d33805653d9348a1af944a8be4501db36f120b84

USER root

ARG ENV
ARG CERT_FILE

ADD ./config/${ENV}/certs/${CERT_FILE} /usr/local/share/ca-certificates/${CERT_FILE}
RUN chmod 644 /usr/local/share/ca-certificates/${CERT_FILE} && update-ca-certificates
