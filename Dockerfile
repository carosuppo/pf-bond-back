# ---- deps ----
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

# ---- dev ----
FROM node:22-alpine AS dev
RUN apk add --no-cache openssl
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY package*.json ./
COPY . .
EXPOSE 3000
