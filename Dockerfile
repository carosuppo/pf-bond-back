# ---- deps ----
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
# IMPORTANT: keep npm in sync with the version used to generate
# package-lock.json locally (see "packageManager" in package.json).
# If they differ, `npm ci` fails with "Missing: ... from lock file"
# because different npm versions lay out optional deps (e.g. @emnapi/*)
# differently in the lockfile.
RUN npm install -g npm@11.6.1
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

# ---- dev ----
FROM node:22-alpine AS dev
RUN apk add --no-cache openssl
# Same npm version as the deps stage (the container also runs `npm install`
# at startup via docker-compose, so it must match the lockfile too).
RUN npm install -g npm@11.6.1
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY package*.json ./
COPY . .
EXPOSE 3000
