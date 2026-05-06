FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY apps/backend/package.json apps/backend/package-lock.json ./
RUN npm ci

FROM deps AS build
COPY apps/backend/. .
RUN npx prisma generate
RUN npm run build

