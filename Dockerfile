FROM node:lts-alpine

ARG OCI_API_CONFIG
ARG OCI_API_KEY
ARG OCI_API_KEY_PUB

# install
WORKDIR /app
COPY package.json .
COPY package-lock.json .
RUN npm ci

# OCI Auth
RUN mkdir .oci
RUN echo $OCI_API_KEY > .oci/oci_api_key.pem
RUN echo $OCI_API_KEY_PUB > .oci/oci_api_key_public.pem
RUN echo $OCI_API_CONFIG > .oci/config
RUN echo chmod 400 .oci/oci_api_key.pem

# source code
COPY . .

# start
CMD ["npm", "start"]