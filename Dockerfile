FROM --platform=linux/amd64 node:16.19.1-alpine3.17
RUN mkdir -p /usr/src/app/
ADD package*.json /usr/src/app/
ADD src /usr/src/app/src
WORKDIR /usr/src/app
RUN npm install
USER node
ARG APP_VERSION
ENV APP_VERSION $APP_VERSION
ENV NODE_ENV "production"
ENV PORT 8080
CMD npm start

