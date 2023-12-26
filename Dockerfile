FROM node:lts-alpine
WORKDIR /app
RUN npm install -g npm@latest
COPY package.json .
COPY package-lock.json .
RUN npm ci
COPY . .
RUN chown -R node:node /app
USER node
CMD ["npm", "start"]