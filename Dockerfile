FROM node:22-alpine

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

RUN npx prisma generate

RUN npm run build

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
