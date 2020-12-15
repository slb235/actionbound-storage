FROM node:12

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx webpack --mode=production

EXPOSE 3000
CMD node index.js
