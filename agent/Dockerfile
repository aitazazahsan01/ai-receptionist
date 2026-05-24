FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY agent/package.json agent/package-lock.json ./
RUN npm ci

FROM deps AS build
COPY agent/. .
