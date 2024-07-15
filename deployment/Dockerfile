FROM requarks/wiki:2.5.303@sha256:1aae39563cf15d8cfc6371b6d33805653d9348a1af944a8be4501db36f120b84

USER root

ARG ENV

ADD ./config/${ENV}/certs/keycloak-host-full-chain-cert.pem /usr/local/share/ca-certificates/keycloak-host-full-chain-cert.pem
RUN chmod 644 /usr/local/share/ca-certificates/keycloak-host-full-chain-cert.pem && update-ca-certificates
