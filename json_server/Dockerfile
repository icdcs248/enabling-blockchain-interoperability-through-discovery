FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY main.js ./

COPY spec_files ./spec_files

EXPOSE 3000

CMD [ "npm", "start" ]