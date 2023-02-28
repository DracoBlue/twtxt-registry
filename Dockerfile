FROM --platform=linux/amd64 node:16.19.1-alpine3.17
RUN npm install -g npm
RUN mkdir -p /usr/src/app/
RUN chown node:node /usr/src/app
ADD --chown=node:node package*.json /usr/src/app/
ADD --chown=node:node src /usr/src/app/src
WORKDIR /usr/src/app
USER node
RUN npm install
ARG APP_VERSION
ENV APP_VERSION $APP_VERSION
ENV NODE_ENV "production"
ENV PORT 8080
CMD npm start

