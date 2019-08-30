This is a fork of [Requarks Wiki.js](https://github.com/Requarks/wiki).
It includes an authentication method to use SSO via an openid keycloak server.
Note, if you want to use SSO you have to activate self registration for the keycloak provider in the wiki administration panel.
You also have to create a new group and assign that group to created users, because they will not be able to login without any assigned group.
