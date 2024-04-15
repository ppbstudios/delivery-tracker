FROM node:lts-alpine3.13

RUN apk add --no-cache build-base python3
RUN npm install -g nodemon --unsafe

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY ./packages/apiserver ./
RUN npm install

EXPOSE 8082

ENV NODE_ENV=production PORT=8082

CMD npm install && nodemon server.js
#CMD ["nodemon", "server.js"]
