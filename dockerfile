#Use the official Node.js 16 image as the base image
FROM node:16-alpine
# Install Git
RUN apk add --no-cache git
#Set the working directory in the container
WORKDIR /app

#Copy the contents of the 'dev' folder into the container
COPY . /app/

RUN yarn global add -D  webpack webpack-cli

RUN yarn

RUN yarn build

#Expose the port on which Wiki.js is running
EXPOSE 3000

#Start Wiki.js when the container is run
CMD ["node", "server"]
