FROM node:lts-alpine

# install
WORKDIR /app
COPY package.json .
COPY package-lock.json .
RUN npm ci

# source code
COPY . .

# start
CMD ["npm", "start"]