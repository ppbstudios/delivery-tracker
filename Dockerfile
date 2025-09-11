FROM node:22-alpine

RUN apk add --no-cache build-base python3
RUN npm install -g nodemon@3.0.2

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY ./packages/apiserver ./
RUN npm install

EXPOSE 8082

ENV NODE_ENV=production PORT=8082

CMD npm install && nodemon server.js
#CMD ["nodemon", "server.js"]
