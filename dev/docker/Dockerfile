FROM requarks/wiki:latest

# Replace with your email address:
ENV WIKI_ADMIN_EMAIL admin@example.com

WORKDIR /var/wiki

# Replace your-config.yml with the path to your config file:
ADD your-config.yml config.yml

EXPOSE 3000
ENTRYPOINT [ "node", "server" ]
