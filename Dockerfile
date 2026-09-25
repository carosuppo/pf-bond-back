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

FROM node:22-alpine AS dev
RUN apk add --no-cache openssl
RUN npm install -g npm@11.6.1
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY package*.json ./
COPY . .
EXPOSE 3000

FROM deps AS build
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS production
RUN apk add --no-cache openssl
RUN npm install -g npm@11.6.1
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY package*.json ./
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/prisma.config.ts ./prisma.config.ts
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
